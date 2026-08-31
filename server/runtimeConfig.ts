import { loadMultiUserAuthEnvironment, type MultiUserAuthEnvironment } from './auth/config';

export type AppMode = 'local' | 'multi-user';

export interface RuntimeConfig {
  mode: AppMode;
  host: string;
  port: number;
  unsafeAllowRemoteNoAuth: boolean;
  isLoopbackHost: boolean;
  auth: MultiUserAuthEnvironment | null;
  appOrigin: string | null;
  quotaMonthlyUnits: number | null;
}

export interface RuntimeConfigEnv {
  [key: string]: string | undefined;
  NODE_ENV?: string;
  PORT?: string;
  OMNILINK_MODE?: string;
  OMNILINK_HOST?: string;
  OMNILINK_BIND_HOST?: string;
  OMNILINK_UNSAFE_ALLOW_REMOTE_NO_AUTH?: string;
  OMNILINK_APP_ORIGIN?: string;
  OMNILINK_AI_QUOTA_MONTHLY_UNITS?: string;
  OMNILINK_OIDC_ISSUER?: string;
  OMNILINK_OIDC_DISCOVERY_URL?: string;
  OMNILINK_OIDC_AUDIENCE?: string;
  OMNILINK_OIDC_CLIENT_ID?: string;
  OMNILINK_OIDC_JWKS_URI?: string;
  OMNILINK_OIDC_REDIRECT_URI?: string;
  OMNILINK_OIDC_CLIENT_SECRET?: string;
  OMNILINK_OIDC_TOKEN_ENDPOINT_AUTH_METHOD?: string;
  OMNILINK_SESSION_SECRET?: string;
  OMNILINK_SESSION_STORE?: string;
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

function parseBoolean(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function isLoopback(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.trim().toLowerCase());
}

/**
 * Resolve listener settings and fail closed for the unauthenticated local mode.
 * Pass an environment object explicitly in tests; production callers can omit it.
 */
export function loadRuntimeConfig(env: RuntimeConfigEnv = process.env): RuntimeConfig {
  const mode = (env.OMNILINK_MODE ?? 'local').trim().toLowerCase();
  if (mode !== 'local' && mode !== 'multi-user') {
    throw new Error(`Invalid OMNILINK_MODE "${mode}". Expected "local" or "multi-user".`);
  }

  const host = (env.OMNILINK_HOST ?? env.OMNILINK_BIND_HOST ?? '127.0.0.1').trim();
  if (!host) throw new Error('OMNILINK_HOST must not be empty.');

  const port = Number(env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT "${env.PORT ?? ''}". Expected an integer between 1 and 65535.`);
  }

  const unsafeAllowRemoteNoAuth = parseBoolean(env.OMNILINK_UNSAFE_ALLOW_REMOTE_NO_AUTH);
  const isLoopbackHost = isLoopback(host);
  const auth = mode === 'multi-user' ? loadMultiUserAuthEnvironment(env) : null;
  const appOrigin = mode === 'multi-user' ? requireOrigin(env.OMNILINK_APP_ORIGIN) : null;
  const quotaMonthlyUnits = mode === 'multi-user'
    ? parsePositiveNumber(env.OMNILINK_AI_QUOTA_MONTHLY_UNITS, 'OMNILINK_AI_QUOTA_MONTHLY_UNITS')
    : null;

  if (!isLoopbackHost && mode !== 'multi-user' && !unsafeAllowRemoteNoAuth) {
    throw new Error(
      `Refusing remote bind "${host}" without authentication. ` +
        'Set OMNILINK_MODE=multi-user with the complete OIDC configuration, or set ' +
        'OMNILINK_UNSAFE_ALLOW_REMOTE_NO_AUTH=true for temporary development testing.',
    );
  }

  return { mode, host, port, unsafeAllowRemoteNoAuth, isLoopbackHost, auth, appOrigin, quotaMonthlyUnits };
}

export function describeUnsafeRemoteWarning(config: RuntimeConfig): string | null {
  if (config.mode === 'local' && !config.isLoopbackHost && config.unsafeAllowRemoteNoAuth) {
    return `WARNING: the server is exposed on ${config.host} without authentication. ` +
      'Do not use this setting on an untrusted network.';
  }
  return null;
}

function requireOrigin(value: string | undefined): string {
  if (!value?.trim()) throw new Error('Multi-user mode requires OMNILINK_APP_ORIGIN.');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('OMNILINK_APP_ORIGIN must be an http(s) origin without credentials, path, query, or fragment.');
  }
  if (url.protocol !== 'https:' && !isLoopback(url.hostname)) {
    throw new Error('Multi-user OMNILINK_APP_ORIGIN must use HTTPS except for loopback development.');
  }
  return url.origin;
}

function parsePositiveNumber(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Multi-user mode requires a positive ${name}.`);
  return parsed;
}
