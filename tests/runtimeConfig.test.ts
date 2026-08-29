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

  it('keeps future multi-user mode loopback-only until auth exists', () => {
    expect(() => loadRuntimeConfig({
      OMNILINK_MODE: 'multi-user',
      OMNILINK_HOST: '0.0.0.0',
    })).toThrow(/Refusing remote bind/);
  });
});
