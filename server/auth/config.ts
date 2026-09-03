import { OidcConfigurationError, type OidcAudience } from './oidc';

export interface MultiUserAuthEnvironment {
  issuer?: string;
  discoveryUrl?: string;
  audience: OidcAudience;
  clientId: string;
  clientSecret?: string;
  tokenEndpointAuthMethod: 'none' | 'client_secret_post' | 'client_secret_basic';
  jwksUri?: string;
  redirectUri?: string;
  sessionSecret: string;
  sessionStore: 'sqlite';
}

export type AuthEnvironment = Record<string, string | undefined>;

/**
 * Read the provider-neutral multi-user environment contract. This function is
 * intentionally strict: a process must not silently start in a partially
 * configured authenticated mode and then fall back to local/no-auth behavior.
 */
export function loadMultiUserAuthEnvironment(env: AuthEnvironment = process.env): MultiUserAuthEnvironment {
  const issuer = optionalValue(env.OMNILINK_OIDC_ISSUER);
  const discoveryUrl = optionalValue(env.OMNILINK_OIDC_DISCOVERY_URL);
  if (!issuer && !discoveryUrl) {
    throw new OidcConfigurationError('Multi-user mode requires OMNILINK_OIDC_ISSUER or OMNILINK_OIDC_DISCOVERY_URL.');
  }

  const audienceValues = parseList(env.OMNILINK_OIDC_AUDIENCE);
  const clientId = optionalValue(env.OMNILINK_OIDC_CLIENT_ID) ?? audienceValues[0];
  if (!clientId) {
    throw new OidcConfigurationError('Multi-user mode requires OMNILINK_OIDC_AUDIENCE or OMNILINK_OIDC_CLIENT_ID.');
  }

  const audience = audienceValues.length > 0
    ? audienceValues.length === 1 ? audienceValues[0] : audienceValues
    : clientId;
  const sessionSecret = env.OMNILINK_SESSION_SECRET ?? '';
  if (sessionSecret.length < 32) {
    throw new OidcConfigurationError('OMNILINK_SESSION_SECRET must contain at least 32 characters.');
  }

  const sessionStore = (env.OMNILINK_SESSION_STORE ?? 'sqlite').trim().toLowerCase();
  if (sessionStore !== 'sqlite') {
    throw new OidcConfigurationError(`Unsupported session store "${sessionStore}". Configure sqlite for multi-user mode.`);
  }

  const clientSecret = optionalValue(env.OMNILINK_OIDC_CLIENT_SECRET);
  const requestedAuthMethod = optionalValue(env.OMNILINK_OIDC_TOKEN_ENDPOINT_AUTH_METHOD);
  const tokenEndpointAuthMethod = (requestedAuthMethod ?? (clientSecret ? 'client_secret_post' : 'none')) as MultiUserAuthEnvironment['tokenEndpointAuthMethod'];
  if (!['none', 'client_secret_post', 'client_secret_basic'].includes(tokenEndpointAuthMethod)) {
    throw new OidcConfigurationError('OMNILINK_OIDC_TOKEN_ENDPOINT_AUTH_METHOD must be none, client_secret_post, or client_secret_basic.');
  }
  if (tokenEndpointAuthMethod !== 'none' && !clientSecret) {
    throw new OidcConfigurationError('The configured OIDC token endpoint authentication method requires OMNILINK_OIDC_CLIENT_SECRET.');
  }

  return {
    issuer,
    discoveryUrl,
    audience,
    clientId,
    clientSecret,
    tokenEndpointAuthMethod,
    jwksUri: optionalValue(env.OMNILINK_OIDC_JWKS_URI),
    redirectUri: optionalValue(env.OMNILINK_OIDC_REDIRECT_URI),
    sessionSecret,
    sessionStore: 'sqlite',
  };
}

/** Return false rather than throwing when runtime startup wants a probe. */
export function isMultiUserAuthConfigured(env: AuthEnvironment = process.env): boolean {
  try {
    loadMultiUserAuthEnvironment(env);
    return true;
  } catch {
    return false;
  }
}

function optionalValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
