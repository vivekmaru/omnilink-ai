import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

/** Scopes understood by the HTTP, extension, mobile-share, and MCP adapters. */
export const SERVICE_TOKEN_SCOPES = [
  'repository:read',
  'repository:write',
  'repository:delete',
  'ai:execute',
  'repository:admin',
] as const;

export type ServiceTokenScope = (typeof SERVICE_TOKEN_SCOPES)[number];
export type CredentialTime = Date | number | string;

export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
export const DEFAULT_SERVICE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90;
const TOKEN_PREFIX = 'olst_';
const TOKEN_ENTROPY_BYTES = 32;

export interface SessionRecord {
  /** SHA-256 digest of the opaque ID; never persist the plaintext ID. */
  idHash: string;
  actorId: string;
  workspaceId: string;
  role: 'owner' | 'editor' | 'viewer';
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface GeneratedSession {
  /** Plaintext ID to put in the HttpOnly session cookie once. */
  sessionId: string;
  /** Alias for adapters that use token terminology. */
  token: string;
  record: SessionRecord;
}

export type CredentialInvalidReason =
  | 'malformed'
  | 'not-found'
  | 'mismatch'
  | 'expired'
  | 'revoked'
  | 'scope-denied';

export interface CredentialVerification {
  valid: boolean;
  reason?: CredentialInvalidReason;
}

export interface SessionCreationOptions {
  actorId: string;
  workspaceId: string;
  role?: SessionRecord['role'];
  /** Absolute expiration; defaults to the standard two-week session TTL. */
  expiresAt?: CredentialTime;
  /** Creation timestamp; primarily useful for deterministic tests. */
  createdAt?: CredentialTime;
  ttlSeconds?: number;
}

/**
 * Create an opaque, high-entropy server session ID and its persistence record.
 * The record contains only a digest, so a database read cannot be used as a
 * ready-to-use browser credential.
 */
export function createSession(options: SessionCreationOptions): GeneratedSession {
  const actorId = requireIdentifier(options.actorId, 'actorId');
  const workspaceId = requireIdentifier(options.workspaceId, 'workspaceId');
  const role = options.role ?? 'owner';
  const createdAt = parseTime(options.createdAt ?? Date.now(), 'createdAt');
  const expiresAt = resolveExpiry(createdAt, options.expiresAt, options.ttlSeconds, DEFAULT_SESSION_TTL_SECONDS);
  const sessionId = encodeRandomCredential();

  return {
    sessionId,
    token: sessionId,
    record: {
      idHash: hashCredential(sessionId),
      actorId,
      workspaceId,
      role,
      createdAt: new Date(createdAt).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      revokedAt: null,
    },
  };
}

/** Hash an opaque session ID for a database lookup. */
export function hashSessionId(sessionId: string): string {
  return hashCredential(sessionId);
}

/**
 * Verify a presented session ID against a stored record. Callers should use
 * the returned context only when `valid` is true and should update last-used
 * metadata separately in their persistence adapter.
 */
export function verifySession(
  sessionId: string,
  record: SessionRecord | null | undefined,
  now: CredentialTime = Date.now(),
): CredentialVerification {
  if (!isCredentialString(sessionId)) return { valid: false, reason: 'malformed' };
  if (!record) return { valid: false, reason: 'not-found' };
  if (!secureDigestEqual(hashCredential(sessionId), record.idHash)) return { valid: false, reason: 'mismatch' };
  if (record.revokedAt && parseTime(record.revokedAt, 'revokedAt') <= parseTime(now, 'now')) {
    return { valid: false, reason: 'revoked' };
  }
  if (parseTime(record.expiresAt, 'expiresAt') <= parseTime(now, 'now')) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true };
}

/** Alias used by adapters that prefer an `is...Valid` naming convention. */
export const verifySessionId = verifySession;

export interface ServiceTokenRecord {
  id: string;
  workspaceId: string;
  tokenPrefix: string;
  /** SHA-256 digest of the complete token; plaintext is never persisted. */
  tokenHash: string;
  scopes: ServiceTokenScope[];
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

export interface GeneratedServiceToken {
  /** Plaintext token; display/store this only at creation time. */
  token: string;
  record: ServiceTokenRecord;
}

export interface ServiceTokenCreationOptions {
  workspaceId: string;
  scopes: readonly ServiceTokenScope[];
  expiresAt?: CredentialTime;
  createdAt?: CredentialTime;
  ttlSeconds?: number;
  id?: string;
}

/**
 * Generate a revocable workspace-scoped bearer token. The random component is
 * 256 bits and the returned persistence record contains only its digest and a
 * short display prefix.
 */
export function createServiceToken(options: ServiceTokenCreationOptions): GeneratedServiceToken {
  const workspaceId = requireIdentifier(options.workspaceId, 'workspaceId');
  const scopes = normaliseScopes(options.scopes);
  const createdAt = parseTime(options.createdAt ?? Date.now(), 'createdAt');
  const expiresAt = resolveExpiry(createdAt, options.expiresAt, options.ttlSeconds, DEFAULT_SERVICE_TOKEN_TTL_SECONDS);
  const token = `${TOKEN_PREFIX}${encodeRandomCredential()}`;
  const id = options.id ? requireIdentifier(options.id, 'id') : `svc_${randomUUID()}`;

  return {
    token,
    record: {
      id,
      workspaceId,
      tokenPrefix: token.slice(0, TOKEN_PREFIX.length + 10),
      tokenHash: hashCredential(token),
      scopes,
      createdAt: new Date(createdAt).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      revokedAt: null,
      lastUsedAt: null,
    },
  };
}

/** Hash a complete service token for a constant-time persistence lookup. */
export function hashServiceToken(token: string): string {
  return hashCredential(token);
}

export interface VerifyServiceTokenOptions {
  requiredScope?: ServiceTokenScope;
  now?: CredentialTime;
}

/** Verify token digest, revocation, expiry, and an optional required scope. */
export function verifyServiceToken(
  token: string,
  record: ServiceTokenRecord | null | undefined,
  options: VerifyServiceTokenOptions = {},
): CredentialVerification {
  if (!isServiceTokenString(token)) return { valid: false, reason: 'malformed' };
  if (!record) return { valid: false, reason: 'not-found' };
  if (!secureDigestEqual(hashCredential(token), record.tokenHash)) return { valid: false, reason: 'mismatch' };

  const now = parseTime(options.now ?? Date.now(), 'now');
  if (record.revokedAt && parseTime(record.revokedAt, 'revokedAt') <= now) {
    return { valid: false, reason: 'revoked' };
  }
  if (parseTime(record.expiresAt, 'expiresAt') <= now) {
    return { valid: false, reason: 'expired' };
  }
  if (options.requiredScope && !record.scopes.includes(options.requiredScope)) {
    return { valid: false, reason: 'scope-denied' };
  }
  return { valid: true };
}

/** Return true when a token has the requested scope (without mutating state). */
export function hasServiceTokenScope(record: ServiceTokenRecord, scope: ServiceTokenScope): boolean {
  return record.scopes.includes(scope);
}

function normaliseScopes(scopes: readonly ServiceTokenScope[]): ServiceTokenScope[] {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new TypeError('At least one service-token scope is required.');
  }

  const unique = [...new Set(scopes)];
  for (const scope of unique) {
    if (!SERVICE_TOKEN_SCOPES.includes(scope)) {
      throw new TypeError(`Unsupported service-token scope "${String(scope)}".`);
    }
  }
  return unique;
}

function encodeRandomCredential(): string {
  return randomBytes(TOKEN_ENTROPY_BYTES).toString('base64url');
}

function hashCredential(value: string): string {
  if (!isCredentialString(value)) throw new TypeError('Credential must be a non-empty string.');
  return createHash('sha256').update(value, 'utf8').digest('base64url');
}

function secureDigestEqual(left: string, right: string): boolean {
  if (!isCredentialString(left) || !isCredentialString(right)) return false;
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function isCredentialString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512;
}

function isServiceTokenString(value: unknown): value is string {
  return isCredentialString(value) && value.startsWith(TOKEN_PREFIX) && value.length === TOKEN_PREFIX.length + 43;
}

function requireIdentifier(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 255) {
    throw new TypeError(`${field} must be a non-empty string of at most 255 characters.`);
  }
  return value;
}

function resolveExpiry(createdAt: number, expiresAt: CredentialTime | undefined, ttlSeconds: number | undefined, defaultTtlSeconds: number): number {
  const resolved = expiresAt === undefined
    ? createdAt + (ttlSeconds ?? defaultTtlSeconds) * 1000
    : parseTime(expiresAt, 'expiresAt');
  if (!Number.isFinite(resolved) || resolved <= createdAt) {
    throw new RangeError('Credential expiration must be later than its creation time.');
  }
  return resolved;
}

function parseTime(value: CredentialTime, field: string): number {
  const parsed = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(parsed)) throw new TypeError(`${field} must be a valid timestamp.`);
  return parsed;
}

