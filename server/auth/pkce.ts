import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * RFC 7636 code challenge method supported by OmniLink.
 *
 * `plain` is deliberately not supported. S256 keeps the authorization-code
 * verifier out of the browser's authorization request and is required by
 * modern OIDC providers.
 */
export const PKCE_CODE_CHALLENGE_METHOD = 'S256' as const;

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: typeof PKCE_CODE_CHALLENGE_METHOD;
}

/** Encode bytes using the unpadded base64url form required by OAuth/OIDC. */
export function encodeBase64Url(value: Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}

/**
 * Generate a high-entropy PKCE verifier and its S256 challenge.
 *
 * The default 32 random bytes result in a 43-character verifier. RFC 7636
 * allows 43-128 characters; callers may supply a byte count between 32 and
 * 96 when a provider imposes a different length preference.
 */
export function generatePkcePair(randomByteLength = 32): PkcePair {
  if (!Number.isInteger(randomByteLength) || randomByteLength < 32 || randomByteLength > 96) {
    throw new RangeError('PKCE verifier entropy must be between 32 and 96 bytes.');
  }

  const codeVerifier = encodeBase64Url(randomBytes(randomByteLength));
  const codeChallenge = encodeBase64Url(createHash('sha256').update(codeVerifier, 'ascii').digest());

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: PKCE_CODE_CHALLENGE_METHOD,
  };
}

/** Generate a cryptographically random OAuth state value. */
export function generateOAuthState(randomByteLength = 32): string {
  return generateOpaqueValue(randomByteLength);
}

/** Generate a cryptographically random OIDC nonce value. */
export function generateOidcNonce(randomByteLength = 32): string {
  return generateOpaqueValue(randomByteLength);
}

/** Backwards-friendly alias for callers that call this simply a nonce. */
export const generateNonce = generateOidcNonce;

/** Backwards-friendly alias for OAuth client code. */
export const generateState = generateOAuthState;

function generateOpaqueValue(randomByteLength: number): string {
  if (!Number.isInteger(randomByteLength) || randomByteLength < 16 || randomByteLength > 96) {
    throw new RangeError('OAuth state and nonce entropy must be between 16 and 96 bytes.');
  }
  return encodeBase64Url(randomBytes(randomByteLength));
}

/**
 * Verify an authorization response's state value without leaking comparison
 * information through timing. A missing, malformed, or differently-sized
 * value is always rejected.
 */
export function verifyOAuthState(expected: string, actual: string): boolean {
  return secureStringEqual(expected, actual);
}

/** Verify an OIDC nonce returned in a validated ID token. */
export function verifyOidcNonce(expected: string, actual: string): boolean {
  return secureStringEqual(expected, actual);
}

/** Aliases make the helpers easy to use from a generic OAuth adapter. */
export const verifyState = verifyOAuthState;
export const verifyNonce = verifyOidcNonce;

/**
 * Verify a provider's S256 challenge against the verifier returned by the
 * token endpoint. This is useful when an adapter needs to validate a stored
 * authorization transaction before exchanging a code.
 */
export function verifyPkceChallenge(codeVerifier: string, expectedCodeChallenge: string): boolean {
  if (!isValidCodeVerifier(codeVerifier) || !isValidCodeChallenge(expectedCodeChallenge)) {
    return false;
  }

  const actualChallenge = encodeBase64Url(createHash('sha256').update(codeVerifier, 'ascii').digest());
  return secureStringEqual(actualChallenge, expectedCodeChallenge);
}

function isValidCodeVerifier(value: string): boolean {
  return value.length >= 43 && value.length <= 128 && /^[A-Za-z0-9._~-]+$/.test(value);
}

function isValidCodeChallenge(value: string): boolean {
  // S256 always produces 32 bytes, represented as 43 base64url characters.
  return value.length === 43 && /^[A-Za-z0-9_-]+$/.test(value);
}

function secureStringEqual(left: string, right: string): boolean {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length === 0 || right.length === 0) {
    return false;
  }

  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}

