import type { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { OmniLinkDB } from '../db';
import type { RuntimeConfig } from '../runtimeConfig';
import { readResponseJson } from '../outboundUrlPolicy';
import {
  LOCAL_REQUEST_CONTEXT,
  canAccessPolicy,
  type EndpointPolicy,
  type RequestContext,
} from '../securityBoundary';
import {
  createOidcVerifier,
  discoverOidcProvider,
  discoverOidcProviderFromUrl,
  type OidcProviderMetadata,
  type OidcVerifier,
} from './oidc';
import { generateOidcNonce, generateOAuthState, generatePkcePair, verifyOAuthState } from './pkce';
import { SERVICE_TOKEN_SCOPES, type ServiceTokenScope } from './credentials';

const SESSION_COOKIE = '__Host-omnilink_session';
const OIDC_STATE_COOKIE = '__Host-omnilink_oidc_state';
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const OIDC_TRANSACTION_TTL_MS = 10 * 60 * 1000;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface AuthStack {
  middleware: RequestHandler[];
  router: Router;
}

/** Build the mode-aware security boundary. Multi-user initialization performs discovery before listen(). */
export async function createAuthStack(runtime: RuntimeConfig, db: OmniLinkDB): Promise<AuthStack> {
  const router = express.Router();
  if (runtime.mode === 'local') {
    router.get(['/auth/session', '/api/auth/session'], (_req, res) => {
      res.json({ authenticated: true, context: LOCAL_REQUEST_CONTEXT });
    });
    router.post('/auth/logout', (_req, res) => res.status(204).end());
    return {
      middleware: [
        (req, _res, next) => { req.securityContext = LOCAL_REQUEST_CONTEXT; next(); },
        authorizeRequest,
      ],
      router,
    };
  }

  if (!runtime.auth || !runtime.appOrigin) throw new Error('Multi-user authentication configuration is unavailable.');
  const metadata = runtime.auth.issuer
    ? await discoverOidcProvider(runtime.auth.issuer)
    : await discoverOidcProviderFromUrl(runtime.auth.discoveryUrl!);
  const verifier = createOidcVerifier({
    issuer: metadata.issuer,
    audience: runtime.auth.audience,
    clientId: runtime.auth.clientId,
    jwksUri: runtime.auth.jwksUri || metadata.jwksUri,
    authorizationEndpoint: metadata.authorizationEndpoint,
    tokenEndpoint: metadata.tokenEndpoint,
    redirectUri: runtime.auth.redirectUri,
  });

  registerBrowserRoutes(router, runtime, db, metadata, verifier);
  registerTokenRoutes(router, db);

  return {
    middleware: [
      createCorsMiddleware(runtime.appOrigin),
      createContextResolver(db),
      createCsrfMiddleware(runtime.appOrigin),
      authorizeRequest,
    ],
    router,
  };
}

export function createContextResolver(db: OmniLinkDB): RequestHandler {
  return (req, res, next) => {
    // Keep the SPA shell and static assets public so AuthGate can render the
    // sign-in screen before an authenticated session exists.
    if (isPublicFrontendPath(req.path) || isPublicAuthPath(req.path) || req.path === '/health' || req.path === '/api/health') return next();
    const authorization = req.get('authorization');
    if (authorization) {
      const match = /^Bearer ([^\s]+)$/.exec(authorization);
      if (!match) return unauthorized(res);
      const requiredScope = req.endpointPolicy as ServiceTokenScope | undefined;
      const token = db.getServiceToken(match[1], requiredScope);
      if (!token) return unauthorized(res);
      req.securityContext = {
        actor: { id: token.id, kind: 'service' },
        workspace: { id: token.workspaceId, role: 'owner' },
        authMethod: 'service-token',
        mode: 'multi-user',
      };
      req.serviceTokenScopes = token.scopes as ServiceTokenScope[];
      return next();
    }

    const sessionId = parseCookies(req.get('cookie'))[SESSION_COOKIE];
    const session = sessionId ? db.getSession(sessionId) : null;
    if (!session) return unauthorized(res);
    const membership = db.getMembership(session.userId, session.workspaceId);
    if (!membership) return unauthorized(res);
    db.touchSession(sessionId, session.workspaceId);
    req.securityContext = {
      actor: { id: session.userId, kind: 'user' },
      workspace: { id: session.workspaceId, role: membership.role },
      authMethod: 'session',
      mode: 'multi-user',
    };
    next();
  };
}

function authorizeRequest(req: Request, res: Response, next: NextFunction): void {
  if (isPublicFrontendPath(req.path) || isPublicAuthPath(req.path) || req.path === '/health' || req.path === '/api/health') return next();
  if (!req.securityContext || !req.endpointPolicy) {
    res.status(500).json({ error: 'Security boundary is not initialized.' });
    return;
  }
  if (!canAccessPolicy(req.securityContext, req.endpointPolicy)) {
    res.status(403).json({ error: 'Insufficient workspace role.' });
    return;
  }
  next();
}

function isPublicFrontendPath(pathname: string): boolean {
  return !pathname.startsWith('/api/') && !pathname.startsWith('/auth/');
}

export function createCsrfMiddleware(appOrigin: string): RequestHandler {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method) || isPublicAuthPath(req.path) || req.securityContext?.authMethod !== 'session') return next();
    const source = req.get('origin') || refererOrigin(req.get('referer'));
    if (source !== appOrigin) {
      res.status(403).json({ error: 'Cross-site request rejected.' });
      return;
    }
    next();
  };
}

function createCorsMiddleware(appOrigin: string): RequestHandler {
  return (req, res, next) => {
    const origin = req.get('origin');
    if (origin === appOrigin) {
      res.setHeader('Access-Control-Allow-Origin', appOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      if (origin && origin !== appOrigin) res.status(403).end();
      else res.status(204).end();
      return;
    }
    next();
  };
}

function registerBrowserRoutes(router: Router, runtime: RuntimeConfig, db: OmniLinkDB, metadata: OidcProviderMetadata, verifier: OidcVerifier): void {
  const config = runtime.auth!;
  const redirectUri = config.redirectUri;
  if (!redirectUri) throw new Error('Multi-user mode requires OMNILINK_OIDC_REDIRECT_URI.');

  router.get('/auth/login', (req, res) => {
    const state = generateOAuthState();
    const nonce = generateOidcNonce();
    const pkce = generatePkcePair();
    db.createOidcTransaction({
      state,
      nonce,
      codeVerifier: pkce.codeVerifier,
      expiresAt: new Date(Date.now() + OIDC_TRANSACTION_TTL_MS).toISOString(),
    });
    const target = new URL(metadata.authorizationEndpoint);
    target.searchParams.set('client_id', config.clientId);
    target.searchParams.set('redirect_uri', redirectUri);
    target.searchParams.set('response_type', 'code');
    target.searchParams.set('scope', 'openid profile email');
    target.searchParams.set('state', state);
    target.searchParams.set('nonce', nonce);
    target.searchParams.set('code_challenge', pkce.codeChallenge);
    target.searchParams.set('code_challenge_method', pkce.codeChallengeMethod);
    res.setHeader('Set-Cookie', opaqueCookie(OIDC_STATE_COOKIE, signState(state, config.sessionSecret), OIDC_TRANSACTION_TTL_MS));
    res.redirect(302, target.toString());
  });

  router.get('/auth/callback', async (req, res, next) => {
    try {
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const state = typeof req.query.state === 'string' ? req.query.state : '';
      if (!code || !state || code.length > 4096 || state.length > 512 || req.query.error) return unauthorized(res);
      const browserState = verifySignedState(parseCookies(req.get('cookie'))[OIDC_STATE_COOKIE], config.sessionSecret);
      if (!browserState || !verifyOAuthState(browserState, state)) return unauthorized(res);
      const transaction = db.consumeOidcTransaction(state);
      if (!transaction) return unauthorized(res);
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
        code_verifier: transaction.codeVerifier,
      });
      const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };
      if (config.tokenEndpointAuthMethod === 'client_secret_post') body.set('client_secret', config.clientSecret!);
      if (config.tokenEndpointAuthMethod === 'client_secret_basic') {
        headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`, 'utf8').toString('base64')}`;
      }
      const tokenResponse = await fetch(metadata.tokenEndpoint, {
        method: 'POST',
        headers,
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      if (!tokenResponse.ok) return unauthorized(res);
      let tokenPayload: { id_token?: string };
      try {
        tokenPayload = await readResponseJson<{ id_token?: string }>(tokenResponse, 256 * 1024);
      } catch {
        return unauthorized(res);
      }
      if (!tokenPayload.id_token) return unauthorized(res);
      const claims = await verifier.verifyIdToken(tokenPayload.id_token, { expectedNonce: transaction.nonce });
      const identity = db.upsertOidcUser({
        issuer: claims.iss,
        subject: claims.sub,
        email: claims.email,
        name: claims.name || claims.preferred_username,
      });
      const created = db.createSession({
        userId: identity.user.id,
        workspaceId: identity.membership.workspaceId,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      });
      res.setHeader('Set-Cookie', [
        sessionCookie(created.sessionId, SESSION_TTL_MS),
        opaqueCookie(OIDC_STATE_COOKIE, '', 0),
      ]);
      res.redirect(302, runtime.appOrigin!);
    } catch (error) {
      next(error);
    }
  });

  const sessionResponse = (req: Request, res: Response) => res.json({ authenticated: true, context: req.securityContext });
  router.get('/auth/session', sessionResponse);
  router.get('/api/auth/session', sessionResponse);
  router.post('/auth/logout', (req, res) => {
    const sessionId = parseCookies(req.get('cookie'))[SESSION_COOKIE];
    if (sessionId) db.revokeSession(sessionId, req.securityContext?.workspace.id);
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    res.status(204).end();
  });
}

function registerTokenRoutes(router: Router, db: OmniLinkDB): void {
  router.get('/api/auth/tokens', (req, res) => {
    if (!requireInteractiveOwner(req, res)) return;
    const context = req.securityContext!;
    res.json({ tokens: db.listServiceTokens(context.actor.id, context.workspace.id) });
  });
  router.post('/api/auth/tokens', (req, res) => {
    if (!requireInteractiveOwner(req, res)) return;
    const context = req.securityContext!;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const scopes = Array.isArray(req.body?.scopes) ? req.body.scopes : [];
    if (!name || scopes.length === 0 || scopes.some((scope: unknown) => !SERVICE_TOKEN_SCOPES.includes(scope as ServiceTokenScope))) {
      res.status(400).json({ error: 'A name and valid explicit scopes are required.' });
      return;
    }
    const expiresAt = typeof req.body?.expiresAt === 'string' ? req.body.expiresAt : undefined;
    if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) {
      res.status(400).json({ error: 'expiresAt must be a future ISO timestamp.' });
      return;
    }
    const created = db.createServiceToken({ userId: context.actor.id, workspaceId: context.workspace.id, name, scopes, expiresAt });
    res.status(201).json({ token: created.token, serviceToken: { ...created, token: undefined } });
  });
  router.delete('/api/auth/tokens/:id', (req, res) => {
    if (!requireInteractiveOwner(req, res)) return;
    const context = req.securityContext!;
    const revoked = db.revokeServiceToken(req.params.id, context.actor.id, context.workspace.id);
    if (!revoked) res.status(404).json({ error: 'Service token not found.' });
    else res.status(204).end();
  });
}

function requireInteractiveOwner(req: Request, res: Response): boolean {
  if (req.securityContext?.authMethod !== 'session' || req.securityContext.workspace.role !== 'owner') {
    res.status(403).json({ error: 'Interactive workspace owner session required.' });
    return false;
  }
  return true;
}

export function sessionCookie(value: string, maxAgeMs: number): string {
  return opaqueCookie(SESSION_COOKIE, value, maxAgeMs);
}

function opaqueCookie(name: string, value: string, maxAgeMs: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}`;
}

function signState(state: string, secret: string): string {
  const signature = createHmac('sha256', secret).update(state, 'utf8').digest('base64url');
  return `${state}.${signature}`;
}

function verifySignedState(value: string | undefined, secret: string): string | null {
  if (!value) return null;
  const separator = value.lastIndexOf('.');
  if (separator < 1) return null;
  const state = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = createHmac('sha256', secret).update(state, 'utf8').digest('base64url');
  const actualBytes = Buffer.from(signature, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes) ? state : null;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of (header || '').split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 1) continue;
    const key = pair.slice(0, separator).trim();
    try { result[key] = decodeURIComponent(pair.slice(separator + 1).trim()); } catch { /* reject malformed value by omission */ }
  }
  return result;
}

function isPublicAuthPath(path: string): boolean {
  return path === '/auth/login' || path === '/auth/callback';
}

function refererOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try { return new URL(value).origin; } catch { return null; }
}

function unauthorized(res: Response): void {
  res.status(401).json({ error: 'Authentication required.' });
}

export function policyToServiceScope(policy: EndpointPolicy): ServiceTokenScope | null {
  return policy === 'health:read' ? null : policy;
}
