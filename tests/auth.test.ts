import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import {
  createOidcVerifier,
  discoverOidcProvider,
  OidcTokenVerificationError,
} from '../server/auth/oidc';
import {
  createServiceToken,
  createSession,
  verifyServiceToken,
  verifySession,
} from '../server/auth/credentials';
import { generatePkcePair, verifyPkceChallenge } from '../server/auth/pkce';
import { parseCookies, sessionCookie } from '../server/auth/http';

describe('OIDC and credential security primitives', () => {
  it('requires bounded JSON discovery responses while retaining loopback development', async () => {
    const metadata = {
      issuer: 'http://127.0.0.1:4444',
      jwks_uri: 'http://127.0.0.1:4444/jwks',
      authorization_endpoint: 'http://127.0.0.1:4444/authorize',
      token_endpoint: 'http://127.0.0.1:4444/token',
    };
    const jsonFetch = async () => new Response(JSON.stringify(metadata), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    await expect(discoverOidcProvider(metadata.issuer, jsonFetch)).resolves.toMatchObject({
      issuer: metadata.issuer,
      tokenEndpoint: metadata.token_endpoint,
    });

    const htmlFetch = async () => new Response(JSON.stringify(metadata), {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
    await expect(discoverOidcProvider(metadata.issuer, htmlFetch)).rejects.toThrow(/invalid JSON/);

    const oversizedFetch = async () => new Response(JSON.stringify(metadata), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(256 * 1024 + 1) },
    });
    await expect(discoverOidcProvider(metadata.issuer, oversizedFetch)).rejects.toThrow(/invalid JSON/);
  });

  it('generates and verifies RFC 7636 S256 PKCE pairs', () => {
    const pair = generatePkcePair();
    expect(pair.codeChallengeMethod).toBe('S256');
    expect(verifyPkceChallenge(pair.codeVerifier, pair.codeChallenge)).toBe(true);
    expect(verifyPkceChallenge(`${pair.codeVerifier}x`, pair.codeChallenge)).toBe(false);
  });

  it('validates signature, issuer, audience, expiry, and nonce', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'key-1';
    jwk.alg = 'RS256';
    const verifier = createOidcVerifier({
      issuer: 'https://identity.example.test',
      audience: 'omnilink',
      clientId: 'omnilink',
      jwksUri: 'https://identity.example.test/jwks',
      jwks: { keys: [jwk] },
    });
    const now = Math.floor(Date.now() / 1000);
    const valid = await new SignJWT({ nonce: 'nonce-1' })
      .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
      .setIssuer('https://identity.example.test')
      .setAudience('omnilink')
      .setSubject('subject-1')
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(privateKey);
    await expect(verifier.verifyIdToken(valid, { expectedNonce: 'nonce-1' })).resolves.toMatchObject({ sub: 'subject-1' });
    await expect(verifier.verifyIdToken(valid, { expectedNonce: 'wrong' })).rejects.toBeInstanceOf(OidcTokenVerificationError);

    const wrongAudience = await new SignJWT({ nonce: 'nonce-1' })
      .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
      .setIssuer('https://identity.example.test')
      .setAudience('another-client')
      .setSubject('subject-1')
      .setExpirationTime(now + 300)
      .sign(privateKey);
    await expect(verifier.verifyIdToken(wrongAudience, { expectedNonce: 'nonce-1' })).rejects.toBeInstanceOf(OidcTokenVerificationError);

    const expired = await new SignJWT({ nonce: 'nonce-1' })
      .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
      .setIssuer('https://identity.example.test')
      .setAudience('omnilink')
      .setSubject('subject-1')
      .setExpirationTime(now - 60)
      .sign(privateKey);
    await expect(verifier.verifyIdToken(expired, { expectedNonce: 'nonce-1', clockToleranceSeconds: 0 })).rejects.toBeInstanceOf(OidcTokenVerificationError);
  });

  it('requires the configured client as azp for multi-audience ID tokens', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'key-multi';
    jwk.alg = 'RS256';
    const verifier = createOidcVerifier({
      issuer: 'https://identity.example.test',
      audience: ['omnilink', 'shared-api'],
      clientId: 'omnilink',
      jwksUri: 'https://identity.example.test/jwks',
      jwks: { keys: [jwk] },
    });
    const now = Math.floor(Date.now() / 1000);
    const withoutAuthorizedParty = await new SignJWT({ nonce: 'nonce-1' })
      .setProtectedHeader({ alg: 'RS256', kid: 'key-multi' })
      .setIssuer('https://identity.example.test')
      .setAudience(['omnilink', 'shared-api'])
      .setSubject('subject-1')
      .setExpirationTime(now + 300)
      .sign(privateKey);
    await expect(verifier.verifyIdToken(withoutAuthorizedParty, { expectedNonce: 'nonce-1' })).rejects.toBeInstanceOf(OidcTokenVerificationError);

    const valid = await new SignJWT({ nonce: 'nonce-1', azp: 'omnilink' })
      .setProtectedHeader({ alg: 'RS256', kid: 'key-multi' })
      .setIssuer('https://identity.example.test')
      .setAudience(['omnilink', 'shared-api'])
      .setSubject('subject-1')
      .setExpirationTime(now + 300)
      .sign(privateKey);
    await expect(verifier.verifyIdToken(valid, { expectedNonce: 'nonce-1' })).resolves.toMatchObject({ azp: 'omnilink' });
  });

  it('hashes opaque sessions and enforces expiry and revocation', () => {
    const created = createSession({ actorId: 'user-1', workspaceId: 'workspace-1', createdAt: 1_000, expiresAt: 2_000 });
    expect(created.record.idHash).not.toContain(created.sessionId);
    expect(verifySession(created.sessionId, created.record, 1_500)).toEqual({ valid: true });
    expect(verifySession(created.sessionId, created.record, 2_000)).toMatchObject({ valid: false, reason: 'expired' });
    expect(verifySession(created.sessionId, { ...created.record, revokedAt: new Date(1_200).toISOString() }, 1_500)).toMatchObject({ valid: false, reason: 'revoked' });
  });

  it('creates one-time service-token secrets with scope, expiry, and revocation checks', () => {
    const created = createServiceToken({ workspaceId: 'workspace-1', scopes: ['repository:read'], createdAt: 1_000, expiresAt: 2_000 });
    expect(created.token).toMatch(/^olst_/);
    expect(created.record.tokenHash).not.toContain(created.token);
    expect(verifyServiceToken(created.token, created.record, { requiredScope: 'repository:read', now: 1_500 })).toEqual({ valid: true });
    expect(verifyServiceToken(created.token, created.record, { requiredScope: 'repository:write', now: 1_500 })).toMatchObject({ valid: false, reason: 'scope-denied' });
    expect(verifyServiceToken(created.token, created.record, { now: 2_000 })).toMatchObject({ valid: false, reason: 'expired' });
  });

  it('emits the required browser cookie flags and parses opaque values', () => {
    const header = sessionCookie('opaque-session', 60_000);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    expect(header).toContain('SameSite=Lax');
    expect(parseCookies('other=x; __Host-omnilink_session=opaque-session')).toMatchObject({ '__Host-omnilink_session': 'opaque-session' });
  });
});
