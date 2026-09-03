import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OmniLinkDB } from '../server/db';
import { createContextResolver, createCsrfMiddleware } from '../server/auth/http';

const cleanups: Array<() => void> = [];

function database(): OmniLinkDB {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnilink-auth-middleware-'));
  const db = new OmniLinkDB(path.join(dir, 'auth.db'));
  cleanups.push(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  return db;
}

function responseStub() {
  const response: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return response;
}

afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

describe('mode-aware request context resolution', () => {
  it('allows the unauthenticated SPA shell but still protects API routes', () => {
    const db = database();
    const next = vi.fn();
    createContextResolver(db)({ path: '/', method: 'GET', get: () => undefined } as any, responseStub(), next);
    expect(next).toHaveBeenCalledOnce();

    const apiResponse = responseStub();
    createContextResolver(db)({ path: '/api/links', method: 'GET', get: () => undefined } as any, apiResponse, vi.fn());
    expect(apiResponse.statusCode).toBe(401);
  });

  it('resolves sessions and bearer tokens to their persisted workspace', () => {
    const db = database();
    const identity = db.upsertOidcUser({ issuer: 'https://id.example.test', subject: 'one' });
    const session = db.createSession({
      userId: identity.user.id,
      workspaceId: identity.membership.workspaceId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const sessionReq: any = {
      path: '/api/links', method: 'GET', endpointPolicy: 'repository:read',
      get: (name: string) => name.toLowerCase() === 'cookie' ? `__Host-omnilink_session=${session.sessionId}` : undefined,
    };
    const next = vi.fn();
    createContextResolver(db)(sessionReq, responseStub(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(sessionReq.securityContext).toMatchObject({
      actor: { id: identity.user.id, kind: 'user' },
      workspace: { id: identity.membership.workspaceId, role: 'owner' },
      authMethod: 'session',
    });

    const token = db.createServiceToken({
      userId: identity.user.id,
      workspaceId: identity.membership.workspaceId,
      name: 'Reader',
      scopes: ['repository:read'],
    });
    const tokenReq: any = {
      path: '/api/links', method: 'GET', endpointPolicy: 'repository:read',
      get: (name: string) => name.toLowerCase() === 'authorization' ? `Bearer ${token.token}` : undefined,
    };
    createContextResolver(db)(tokenReq, responseStub(), vi.fn());
    expect(tokenReq.securityContext).toMatchObject({
      actor: { id: token.id, kind: 'service' },
      workspace: { id: identity.membership.workspaceId },
      authMethod: 'service-token',
    });
  });

  it('rejects missing scopes, expired/revoked credentials, and non-bearer syntax', () => {
    const db = database();
    const identity = db.upsertOidcUser({ issuer: 'https://id.example.test', subject: 'two' });
    const token = db.createServiceToken({
      userId: identity.user.id,
      workspaceId: identity.membership.workspaceId,
      name: 'Reader',
      scopes: ['repository:read'],
    });
    const req: any = {
      path: '/api/links', method: 'POST', endpointPolicy: 'repository:write',
      get: (name: string) => name.toLowerCase() === 'authorization' ? `Bearer ${token.token}` : undefined,
    };
    const res = responseStub();
    createContextResolver(db)(req, res, vi.fn());
    expect(res.statusCode).toBe(401);
    expect(db.revokeServiceToken(token.id, identity.user.id, identity.membership.workspaceId)).toBe(true);
  });

  it('rejects cross-site session mutations while allowing bearer clients', () => {
    const middleware = createCsrfMiddleware('https://app.example.test');
    const sessionReq: any = {
      method: 'POST', path: '/api/links', securityContext: { authMethod: 'session' },
      get: (name: string) => name.toLowerCase() === 'origin' ? 'https://evil.example.test' : undefined,
    };
    const res = responseStub();
    middleware(sessionReq, res, vi.fn());
    expect(res.statusCode).toBe(403);

    const serviceReq: any = { ...sessionReq, securityContext: { authMethod: 'service-token' } };
    const next = vi.fn();
    middleware(serviceReq, responseStub(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
