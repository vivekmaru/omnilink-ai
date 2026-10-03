import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { OmniLinkDB } from '../server/db';
import { createAuthStack } from '../server/auth/http';
import { AttemptLimiter, hashPassword, normalizeEmail, verifyPassword } from '../server/auth/password';
import { loadRuntimeConfig } from '../server/runtimeConfig';
import { attachEndpointPolicy } from '../server/securityBoundary';

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

const PASSWORD_ENV = {
  OMNILINK_MODE: 'multi-user',
  OMNILINK_AUTH_PROVIDER: 'password',
  OMNILINK_HOST: '0.0.0.0',
  OMNILINK_SESSION_SECRET: 's'.repeat(32),
  OMNILINK_AI_QUOTA_MONTHLY_UNITS: '1000',
};

function database(): OmniLinkDB {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnilink-password-'));
  const db = new OmniLinkDB(path.join(dir, 'auth.db'));
  cleanups.push(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  return db;
}

/** Start the real auth stack on an ephemeral port; the app origin is the listener itself. */
async function startServer(env: Record<string, string> = {}) {
  const db = database();
  const app = express();
  const server: Server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const runtime = loadRuntimeConfig({ ...PASSWORD_ENV, OMNILINK_APP_ORIGIN: origin, ...env });
  const stack = await createAuthStack(runtime, db);
  app.use(express.json());
  app.use(attachEndpointPolicy);
  app.use(...stack.middleware, stack.router);
  app.get('/api/links', (req, res) => res.json({ workspace: req.securityContext?.workspace.id }));

  const call = (pathname: string, init: { method?: string; body?: unknown; cookie?: string; origin?: string | null } = {}) => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    if (init.cookie) headers.Cookie = init.cookie;
    if (init.origin !== null && init.method === 'POST') headers.Origin = init.origin ?? origin;
    return fetch(origin + pathname, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  };
  return { db, call, origin };
}

function sessionCookieFrom(response: Response): string {
  const header = response.headers.get('set-cookie') ?? '';
  const match = /__Host-omnilink_session=([^;]+)/.exec(header);
  if (!match) throw new Error(`No session cookie in ${header}`);
  return `__Host-omnilink_session=${match[1]}`;
}

describe('password provider configuration', () => {
  it('starts multi-user password mode without any OIDC settings and defaults to first-user sign-up', () => {
    const config = loadRuntimeConfig({ ...PASSWORD_ENV, OMNILINK_APP_ORIGIN: 'https://links.example.test' });
    expect(config.mode).toBe('multi-user');
    expect(config.auth).toEqual({ provider: 'password', signup: 'first-user', sessionSecret: 's'.repeat(32), sessionStore: 'sqlite' });
  });

  it('rejects unknown providers, sign-up policies and short session secrets', () => {
    const base = { ...PASSWORD_ENV, OMNILINK_APP_ORIGIN: 'https://links.example.test' };
    expect(() => loadRuntimeConfig({ ...base, OMNILINK_AUTH_PROVIDER: 'ldap' })).toThrow(/OMNILINK_AUTH_PROVIDER/);
    expect(() => loadRuntimeConfig({ ...base, OMNILINK_PASSWORD_SIGNUP: 'everyone' })).toThrow(/OMNILINK_PASSWORD_SIGNUP/);
    expect(() => loadRuntimeConfig({ ...base, OMNILINK_SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
  });
});

describe('password hashing helpers', () => {
  it('verifies only the original password and rejects malformed hashes', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    await expect(verifyPassword('correct horse battery', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong horse battery', hash)).resolves.toBe(false);
    await expect(verifyPassword('anything', 'not-a-hash')).resolves.toBe(false);
  });

  it('normalizes emails and rejects invalid ones', () => {
    expect(normalizeEmail('  Viv@Example.COM ')).toBe('viv@example.com');
    expect(normalizeEmail('no-at-sign')).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });

  it('blocks a key after the limit until its window expires', () => {
    let now = 0;
    const limiter = new AttemptLimiter(2, 1000, 10, () => now);
    limiter.record('a');
    expect(limiter.isBlocked('a')).toBe(false);
    limiter.record('a');
    expect(limiter.isBlocked('a')).toBe(true);
    now = 1001;
    expect(limiter.isBlocked('a')).toBe(false);
  });
});

describe('password sign-up and sign-in over HTTP', () => {
  it('bootstraps the owner on a fresh install, then closes sign-up and signs in', async () => {
    const { db, call } = await startServer();
    await expect((await call('/auth/providers')).json()).resolves.toEqual({ provider: 'password', signupOpen: true, needsSetup: true });
    expect((await call('/api/links')).status).toBe(401);

    const signup = await call('/auth/password/signup', {
      method: 'POST',
      body: { name: 'Viv', email: 'Owner@Example.test', password: 'a long enough password' },
    });
    expect(signup.status).toBe(201);
    const cookie = sessionCookieFrom(signup);
    const session = await (await call('/auth/session', { cookie })).json();
    expect(session).toMatchObject({ authenticated: true, context: { workspace: { role: 'owner' }, authMethod: 'session' } });
    await expect((await call('/api/links', { cookie })).json()).resolves.toEqual({ workspace: session.context.workspace.id });

    await expect((await call('/auth/providers')).json()).resolves.toEqual({ provider: 'password', signupOpen: false, needsSetup: false });
    const second = await call('/auth/password/signup', { method: 'POST', body: { email: 'other@example.test', password: 'another long password' } });
    expect(second.status).toBe(403);
    expect(db.countPasswordUsers()).toBe(1);

    const wrong = await call('/auth/password/login', { method: 'POST', body: { email: 'owner@example.test', password: 'not the password' } });
    expect(wrong.status).toBe(401);
    const unknown = await call('/auth/password/login', { method: 'POST', body: { email: 'nobody@example.test', password: 'whatever it is' } });
    expect(unknown.status).toBe(401);
    expect(await unknown.json()).toEqual(await wrong.json());

    const login = await call('/auth/password/login', { method: 'POST', body: { email: 'owner@example.test', password: 'a long enough password' } });
    expect(login.status).toBe(200);
    const loginCookie = sessionCookieFrom(login);
    await expect((await call('/api/links', { cookie: loginCookie })).json()).resolves.toEqual({ workspace: session.context.workspace.id });

    const logout = await call('/auth/logout', { method: 'POST', cookie: loginCookie });
    expect(logout.status).toBe(204);
    expect((await call('/api/links', { cookie: loginCookie })).status).toBe(401);
  });

  it('gives each open sign-up its own workspace and rejects duplicates and weak passwords', async () => {
    const { call } = await startServer({ OMNILINK_PASSWORD_SIGNUP: 'open' });
    const weak = await call('/auth/password/signup', { method: 'POST', body: { email: 'a@example.test', password: 'short' } });
    expect(weak.status).toBe(400);

    const a = await call('/auth/password/signup', { method: 'POST', body: { email: 'a@example.test', password: 'password for a!!' } });
    const b = await call('/auth/password/signup', { method: 'POST', body: { email: 'b@example.test', password: 'password for b!!' } });
    expect([a.status, b.status]).toEqual([201, 201]);
    const workspaceA = (await (await call('/api/links', { cookie: sessionCookieFrom(a) })).json()).workspace;
    const workspaceB = (await (await call('/api/links', { cookie: sessionCookieFrom(b) })).json()).workspace;
    expect(workspaceA).not.toBe(workspaceB);

    const duplicate = await call('/auth/password/signup', { method: 'POST', body: { email: 'A@example.test', password: 'some other password' } });
    expect(duplicate.status).toBe(409);
  });

  it('rejects cross-site and origin-less password posts', async () => {
    const { call } = await startServer();
    const foreign = await call('/auth/password/signup', {
      method: 'POST', origin: 'https://evil.example.test', body: { email: 'a@example.test', password: 'a long enough password' },
    });
    expect(foreign.status).toBe(403);
    const missing = await call('/auth/password/login', { method: 'POST', origin: null, body: { email: 'a@example.test', password: 'x' } });
    expect(missing.status).toBe(403);
  });

  it('throttles repeated failures for one account', async () => {
    const { call } = await startServer({ OMNILINK_PASSWORD_SIGNUP: 'open' });
    await call('/auth/password/signup', { method: 'POST', body: { email: 'a@example.test', password: 'a long enough password' } });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await call('/auth/password/login', { method: 'POST', body: { email: 'a@example.test', password: `wrong ${attempt}` } })).status).toBe(401);
    }
    const blocked = await call('/auth/password/login', { method: 'POST', body: { email: 'a@example.test', password: 'a long enough password' } });
    expect(blocked.status).toBe(429);
  });
});
