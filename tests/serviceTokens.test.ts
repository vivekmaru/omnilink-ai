import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiHttpError, ApiService } from '../src/services/api';
import { canManageServiceTokens } from '../src/components/AuthGate';
import { tokenStatus } from '../src/components/ServiceTokensModal';
import type { ServiceToken, SessionContext } from '../src/types';

const baseToken: ServiceToken = {
  id: 'svc_1',
  name: 'Extension',
  tokenPrefix: 'olst_abcdefg',
  scopes: ['repository:read'],
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2027-01-01T00:00:00.000Z',
};

function session(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    actor: { id: 'user-1', kind: 'user' },
    workspace: { id: 'ws-1', role: 'owner' },
    authMethod: 'session',
    mode: 'multi-user',
    ...overrides,
  };
}

describe('service token client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lists tokens from the auth API', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ tokens: [baseToken] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(ApiService.listServiceTokens()).resolves.toEqual([baseToken]);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/tokens', expect.objectContaining({ credentials: 'same-origin' }));
  });

  it('creates a token and returns the one-time secret', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ token: 'olst_secret', serviceToken: baseToken }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await ApiService.createServiceToken({ name: 'Extension', scopes: ['repository:read'] });
    expect(result.token).toBe('olst_secret');
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ name: 'Extension', scopes: ['repository:read'] });
  });

  it('surfaces the server validation message on a failed create', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'A name and valid explicit scopes are required.' }), { status: 400 })));
    await expect(ApiService.createServiceToken({ name: 'x', scopes: [] })).rejects.toThrow(ApiHttpError);
    await expect(ApiService.createServiceToken({ name: 'x', scopes: [] })).rejects.toThrow('A name and valid explicit scopes are required.');
  });

  it('revokes a token by encoded id', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await ApiService.revokeServiceToken('svc/1');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/tokens/svc%2F1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('rejects a revoke the server could not find', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Service token not found.' }), { status: 404 })));
    await expect(ApiService.revokeServiceToken('svc_missing')).rejects.toThrow('Service token not found.');
  });
});

describe('service token UI rules', () => {
  it('only lets interactive owner sessions manage tokens', () => {
    expect(canManageServiceTokens(session())).toBe(true);
    expect(canManageServiceTokens(session({ workspace: { id: 'ws-1', role: 'editor' } }))).toBe(false);
    expect(canManageServiceTokens(session({ authMethod: 'local' }))).toBe(false);
    expect(canManageServiceTokens(session({ authMethod: 'service-token' }))).toBe(false);
    expect(canManageServiceTokens(null)).toBe(false);
  });

  it('derives active, expired and revoked status', () => {
    const now = Date.parse('2026-06-01T00:00:00.000Z');
    expect(tokenStatus(baseToken, now)).toBe('active');
    expect(tokenStatus({ ...baseToken, expiresAt: '2026-05-01T00:00:00.000Z' }, now)).toBe('expired');
    expect(tokenStatus({ ...baseToken, revokedAt: '2026-02-01T00:00:00.000Z' }, now)).toBe('revoked');
  });
});
