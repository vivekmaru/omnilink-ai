import {
  createLocalJWKSet,
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  customFetch,
  type JSONWebKeySet,
  type JWTPayload,
  type RemoteJWKSetOptions,
} from 'jose';
import { verifyOidcNonce } from './pkce';

export const OIDC_ALLOWED_ALGORITHMS = [
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
  'EdDSA',
] as const;

export type OidcSigningAlgorithm = (typeof OIDC_ALLOWED_ALGORITHMS)[number];
export type OidcAudience = string | readonly string[];

export interface OidcProviderConfig {
  /** Exact issuer URL expected in the ID token's `iss` claim. */
  issuer: string;
  /** API audience, normally the OIDC client ID. */
  audience: OidcAudience;
  /** Public JWKS endpoint used to validate ID-token signatures. */
  jwksUri: string;
  clientId?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userInfoEndpoint?: string;
  redirectUri?: string;
  allowedAlgorithms?: readonly OidcSigningAlgorithm[];
}

export interface OidcProviderMetadata {
  issuer: string;
  jwksUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint?: string;
  responseTypesSupported?: string[];
  scopesSupported?: string[];
}

export interface OidcIdTokenClaims extends JWTPayload {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  nonce?: string;
  azp?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
}

export interface VerifyIdTokenOptions {
  expectedNonce?: string;
  clockToleranceSeconds?: number;
}

export interface OidcVerifier {
  verifyIdToken(token: string, options?: VerifyIdTokenOptions): Promise<OidcIdTokenClaims>;
}

export interface OidcVerifierConfig extends OidcProviderConfig {
  /** Optional in-memory JWKS for tests or a deployment-managed key cache. */
  jwks?: JSONWebKeySet;
  /** Optional fetch implementation for a proxy, test server, or controlled runtime. */
  jwksFetch?: OidcFetch;
}

export class OidcConfigurationError extends Error {
  readonly code = 'OIDC_CONFIGURATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'OidcConfigurationError';
  }
}

export class OidcTokenVerificationError extends Error {
  readonly code = 'OIDC_TOKEN_VERIFICATION_ERROR';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'OidcTokenVerificationError';
  }
}

export type OidcFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Validate and normalise an OIDC provider configuration before constructing a
 * verifier. This does not perform network I/O; call `discoverOidcProvider`
 * when metadata is not already supplied by the deployment configuration.
 */
export function validateOidcProviderConfig(config: OidcProviderConfig): OidcProviderConfig {
  const issuer = validateEndpointUrl(config.issuer, 'issuer');
  const jwksUri = validateEndpointUrl(config.jwksUri, 'jwksUri');
  const audience = normaliseAudience(config.audience);

  if (!Array.isArray(config.allowedAlgorithms) || config.allowedAlgorithms.length === 0) {
    throw new OidcConfigurationError('At least one OIDC signing algorithm is required.');
  }
  for (const algorithm of config.allowedAlgorithms) {
    if (!OIDC_ALLOWED_ALGORITHMS.includes(algorithm)) {
      throw new OidcConfigurationError(`Unsupported OIDC signing algorithm "${String(algorithm)}".`);
    }
  }

  if (config.clientId !== undefined && (typeof config.clientId !== 'string' || config.clientId.trim().length === 0 || config.clientId.length > 512)) {
    throw new OidcConfigurationError('OIDC clientId must be a non-empty string of at most 512 characters.');
  }
  for (const [name, value] of Object.entries({
    authorizationEndpoint: config.authorizationEndpoint,
    tokenEndpoint: config.tokenEndpoint,
    userInfoEndpoint: config.userInfoEndpoint,
    redirectUri: config.redirectUri,
  })) {
    if (value !== undefined) validateEndpointUrl(value, name);
  }

  return {
    ...config,
    issuer,
    jwksUri,
    audience,
    allowedAlgorithms: [...config.allowedAlgorithms],
  };
}

/**
 * Create a verifier backed by either an injected JWKS (tests or a persisted
 * cache) or jose's remote JWKS resolver. The resolver caches keys and limits
 * refreshes to avoid making the identity provider a per-request dependency.
 */
export function createOidcVerifier(config: OidcVerifierConfig): OidcVerifier {
  const validated = validateOidcProviderConfig({
    ...config,
    allowedAlgorithms: config.allowedAlgorithms ?? OIDC_ALLOWED_ALGORITHMS,
  });
  let keySet;
  if (config.jwks) {
    keySet = createLocalJWKSet(config.jwks);
  } else {
    const remoteOptions: RemoteJWKSetOptions = {
      timeoutDuration: 5_000,
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60 * 1_000,
    };
    if (config.jwksFetch) {
      // jose's fetch signature is narrower than the platform RequestInit type.
      remoteOptions[customFetch] = config.jwksFetch as RemoteJWKSetOptions[typeof customFetch];
    }
    keySet = createRemoteJWKSet(new URL(validated.jwksUri), remoteOptions);
  }

  return {
    async verifyIdToken(token, options = {}): Promise<OidcIdTokenClaims> {
      if (typeof token !== 'string' || token.length < 32 || token.length > 16_384) {
        throw new OidcTokenVerificationError('OIDC ID token is malformed.');
      }

      let protectedHeader: ReturnType<typeof decodeProtectedHeader>;
      try {
        protectedHeader = decodeProtectedHeader(token);
      } catch (error) {
        throw new OidcTokenVerificationError('OIDC ID token has an invalid JOSE header.', { cause: error });
      }

      if (!protectedHeader.alg || !validated.allowedAlgorithms?.includes(protectedHeader.alg as OidcSigningAlgorithm)) {
        throw new OidcTokenVerificationError('OIDC ID token uses a disallowed signing algorithm.');
      }

      try {
        const audience: string | string[] = Array.isArray(validated.audience)
          ? Array.from(validated.audience)
          : validated.audience as string;
        const result = await jwtVerify<OidcIdTokenClaims>(token, keySet, {
          issuer: validated.issuer,
          audience,
          algorithms: [...(validated.allowedAlgorithms ?? OIDC_ALLOWED_ALGORITHMS)],
          requiredClaims: ['iss', 'sub', 'aud', 'exp'],
          clockTolerance: options.clockToleranceSeconds ?? 5,
        });
        const claims = result.payload;

        if (!claims.sub || typeof claims.sub !== 'string' || claims.sub.length > 512) {
          throw new OidcTokenVerificationError('OIDC ID token is missing a valid subject.');
        }
        if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) {
          throw new OidcTokenVerificationError('OIDC ID token has an invalid expiration.');
        }
        if (validated.clientId && claims.azp && claims.azp !== validated.clientId) {
          throw new OidcTokenVerificationError('OIDC ID token authorized party does not match the configured client.');
        }
        if (Array.isArray(claims.aud) && claims.aud.length > 1 && (!claims.azp || claims.azp !== validated.clientId)) {
          throw new OidcTokenVerificationError('OIDC ID token with multiple audiences requires the configured client as azp.');
        }
        if (options.expectedNonce !== undefined) {
          if (!claims.nonce || !verifyOidcNonce(options.expectedNonce, claims.nonce)) {
            throw new OidcTokenVerificationError('OIDC ID token nonce does not match the authorization transaction.');
          }
        }

        return claims;
      } catch (error) {
        if (error instanceof OidcTokenVerificationError) throw error;
        throw new OidcTokenVerificationError('OIDC ID token verification failed.', { cause: error });
      }
    },
  };
}

/** Construct the RFC 8414 discovery URL for an issuer. */
export function oidcDiscoveryUrl(issuer: string): string {
  const validatedIssuer = validateEndpointUrl(issuer, 'issuer');
  const url = new URL(validatedIssuer);
  if (url.search || url.hash) throw new OidcConfigurationError('OIDC issuer must not contain a query or fragment.');
  const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  url.pathname = `${path}.well-known/openid-configuration`;
  return url.toString();
}

/**
 * Fetch and validate provider metadata. Discovery responses are bounded and
 * redirects are disabled because issuer configuration is security-sensitive.
 */
export async function discoverOidcProvider(issuer: string, fetchImpl: OidcFetch = fetch): Promise<OidcProviderMetadata> {
  const expectedIssuer = validateEndpointUrl(issuer, 'issuer');
  return discoverOidcProviderFromUrl(oidcDiscoveryUrl(expectedIssuer), expectedIssuer, fetchImpl);
}

/** Discover from an explicitly configured metadata URL while still binding to the document issuer. */
export async function discoverOidcProviderFromUrl(
  discoveryUrl: string,
  expectedIssuer?: string,
  fetchImpl: OidcFetch = fetch,
): Promise<OidcProviderMetadata> {
  const validatedDiscoveryUrl = validateEndpointUrl(discoveryUrl, 'discoveryUrl');
  const normalizedExpectedIssuer = expectedIssuer ? validateEndpointUrl(expectedIssuer, 'issuer') : undefined;
  const response = await fetchWithTimeout(fetchImpl, validatedDiscoveryUrl);
  if (!response.ok) throw new OidcConfigurationError(`OIDC discovery failed with HTTP ${response.status}.`);

  let metadata: unknown;
  try {
    metadata = JSON.parse(await readBoundedResponse(response, 256 * 1024));
  } catch (error) {
    if (error instanceof OidcConfigurationError) throw error;
    throw new OidcConfigurationError('OIDC discovery returned invalid JSON.');
  }
  if (!metadata || typeof metadata !== 'object') {
    throw new OidcConfigurationError('OIDC discovery returned an invalid document.');
  }

  const document = metadata as Record<string, unknown>;
  if (typeof document.issuer !== 'string') {
    throw new OidcConfigurationError('OIDC discovery is missing issuer.');
  }
  const discoveredIssuer = validateEndpointUrl(document.issuer, 'issuer');
  if (normalizedExpectedIssuer && discoveredIssuer !== normalizedExpectedIssuer) {
    throw new OidcConfigurationError('OIDC discovery issuer does not match configured issuer.');
  }
  const jwksUri = requireMetadataUrl(document.jwks_uri, 'jwks_uri');
  const authorizationEndpoint = requireMetadataUrl(document.authorization_endpoint, 'authorization_endpoint');
  const tokenEndpoint = requireMetadataUrl(document.token_endpoint, 'token_endpoint');
  const userInfoEndpoint = document.userinfo_endpoint === undefined
    ? undefined
    : requireMetadataUrl(document.userinfo_endpoint, 'userinfo_endpoint');

  return {
    issuer: discoveredIssuer,
    jwksUri,
    authorizationEndpoint,
    tokenEndpoint,
    userInfoEndpoint,
    responseTypesSupported: asStringArray(document.response_types_supported),
    scopesSupported: asStringArray(document.scopes_supported),
  };
}

async function fetchWithTimeout(fetchImpl: OidcFetch, url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    return await fetchImpl(url, { method: 'GET', redirect: 'error', signal: controller.signal });
  } catch (error) {
    throw new OidcConfigurationError(`OIDC discovery request failed: ${error instanceof Error ? error.message : 'network error'}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function readBoundedResponse(response: Response, maxBytes: number): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new OidcConfigurationError('OIDC discovery response exceeds the configured size limit.');
  }
  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new OidcConfigurationError('OIDC discovery response exceeds the configured size limit.');
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      total += chunk.length;
      if (total > maxBytes) throw new OidcConfigurationError('OIDC discovery response exceeds the configured size limit.');
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}

function normaliseAudience(audience: OidcAudience): string | string[] {
  const values = (Array.isArray(audience) ? audience : [audience])
    .map((entry) => typeof entry === 'string' ? entry.trim() : '')
    .filter(Boolean);
  if (values.length === 0) throw new OidcConfigurationError('OIDC audience/client ID is required.');
  return values.length === 1 ? values[0] : [...new Set(values)];
}

function validateEndpointUrl(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OidcConfigurationError(`OIDC ${field} is required.`);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new OidcConfigurationError(`OIDC ${field} must be an absolute URL.`);
  }
  const isLocalHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !isLocalHttp) {
    throw new OidcConfigurationError(`OIDC ${field} must use HTTPS (HTTP is allowed only for loopback development).`);
  }
  if (url.username || url.password || url.hash) {
    throw new OidcConfigurationError(`OIDC ${field} must not contain credentials or a fragment.`);
  }
  // Preserve configured issuer spelling exactly. OIDC compares `iss`
  // byte-for-byte, while URL serialization would add a trailing slash.
  return value.trim();
}

function requireMetadataUrl(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new OidcConfigurationError(`OIDC discovery is missing ${field}.`);
  return validateEndpointUrl(value, field);
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is string => typeof entry === 'string');
}
