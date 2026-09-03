import { describe, expect, it } from 'vitest';
import { describeUnsafeRemoteWarning, loadRuntimeConfig } from '../server/runtimeConfig';

describe('runtime configuration', () => {
  it('defaults to loopback local mode', () => {
    const config = loadRuntimeConfig({});
    expect(config).toMatchObject({ mode: 'local', host: '127.0.0.1', port: 4000, isLoopbackHost: true });
  });

  it('rejects remote listeners in unauthenticated local mode', () => {
    expect(() => loadRuntimeConfig({ OMNILINK_HOST: '0.0.0.0' })).toThrow(/Refusing remote bind/);
  });

  it('allows an explicit unsafe override and reports a warning', () => {
    const config = loadRuntimeConfig({ OMNILINK_HOST: '0.0.0.0', OMNILINK_UNSAFE_ALLOW_REMOTE_NO_AUTH: 'true' });
    expect(config.unsafeAllowRemoteNoAuth).toBe(true);
    expect(describeUnsafeRemoteWarning(config)).toMatch(/without authentication/);
  });

  it('refuses multi-user startup until the complete auth and quota policy exists', () => {
    expect(() => loadRuntimeConfig({
      OMNILINK_MODE: 'multi-user',
      OMNILINK_HOST: '0.0.0.0',
    })).toThrow(/OIDC_ISSUER/);
  });

  it('allows remote multi-user binding only with complete guarded configuration', () => {
    const config = loadRuntimeConfig({
      OMNILINK_MODE: 'multi-user',
      OMNILINK_HOST: '0.0.0.0',
      OMNILINK_OIDC_ISSUER: 'https://identity.example.test',
      OMNILINK_OIDC_CLIENT_ID: 'omnilink',
      OMNILINK_OIDC_REDIRECT_URI: 'https://app.example.test/auth/callback',
      OMNILINK_SESSION_SECRET: 'a'.repeat(32),
      OMNILINK_SESSION_STORE: 'sqlite',
      OMNILINK_APP_ORIGIN: 'https://app.example.test',
      OMNILINK_AI_QUOTA_MONTHLY_UNITS: '100000',
    });
    expect(config).toMatchObject({ mode: 'multi-user', host: '0.0.0.0', appOrigin: 'https://app.example.test' });
    expect(config.auth?.clientId).toBe('omnilink');
  });

  it('requires HTTPS for non-loopback multi-user application origins', () => {
    const base = {
      OMNILINK_MODE: 'multi-user',
      OMNILINK_HOST: '0.0.0.0',
      OMNILINK_OIDC_ISSUER: 'https://identity.example.test',
      OMNILINK_OIDC_CLIENT_ID: 'omnilink',
      OMNILINK_OIDC_REDIRECT_URI: 'http://127.0.0.1:4000/auth/callback',
      OMNILINK_SESSION_SECRET: 'a'.repeat(32),
      OMNILINK_SESSION_STORE: 'sqlite',
      OMNILINK_AI_QUOTA_MONTHLY_UNITS: '100000',
    };
    expect(() => loadRuntimeConfig({ ...base, OMNILINK_APP_ORIGIN: 'http://links.example.test' })).toThrow(/must use HTTPS/);
    expect(loadRuntimeConfig({ ...base, OMNILINK_APP_ORIGIN: 'http://127.0.0.1:4000' }).appOrigin).toBe('http://127.0.0.1:4000');
  });
});
