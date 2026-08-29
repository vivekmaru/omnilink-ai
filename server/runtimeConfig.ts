export type AppMode = 'local' | 'multi-user';

export interface RuntimeConfig {
  mode: AppMode;
  host: string;
  port: number;
  unsafeAllowRemoteNoAuth: boolean;
  isLoopbackHost: boolean;
}

export interface RuntimeConfigEnv {
  NODE_ENV?: string;
  PORT?: string;
  OMNILINK_MODE?: string;
  OMNILINK_HOST?: string;
  OMNILINK_BIND_HOST?: string;
  OMNILINK_UNSAFE_ALLOW_REMOTE_NO_AUTH?: string;
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
  if (!isLoopbackHost && !unsafeAllowRemoteNoAuth) {
    throw new Error(
      `Refusing remote bind "${host}" without authentication. ` +
        'Remote binding will remain disabled until authentication middleware is implemented. Set ' +
        'OMNILINK_UNSAFE_ALLOW_REMOTE_NO_AUTH=true for temporary development testing.',
    );
  }

  return { mode, host, port, unsafeAllowRemoteNoAuth, isLoopbackHost };
}

export function describeUnsafeRemoteWarning(config: RuntimeConfig): string | null {
  if (!config.isLoopbackHost && config.unsafeAllowRemoteNoAuth) {
    return `WARNING: the server is exposed on ${config.host} without authentication. ` +
      'Do not use this setting on an untrusted network.';
  }
  return null;
}
