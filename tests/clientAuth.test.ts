import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiAuthenticationError, ApiService } from '../src/services/api';
import {
  getMcpAuthorizationHeaders,
  resolveMcpServiceToken,
} from '../server/mcpServer';

describe('client authentication seams', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, String(value)); },
      removeItem: (key: string) => { values.delete(key); },
    });
  });

  afterEach(() => {
    ApiService.clearWorkspaceNamespace();
    ApiService.clearServiceToken();
    vi.restoreAllMocks();
  });

  it('namespaces browser caches and clears the previous workspace on identity switch', () => {
    localStorage.setItem('omnilink_local_cache_v1', JSON.stringify([]));
    ApiService.setWorkspaceNamespace('local-default');
    expect(localStorage.getItem('omnilink_local_cache_v1')).toBeNull();
    expect(ApiService.getLocalCache()).toEqual([]);

    ApiService.setLocalCache([]);
    expect(localStorage.getItem('omnilink_local_cache_v1:local-default')).toBe('[]');

    ApiService.setWorkspaceNamespace('workspace-a');
    ApiService.setLocalCache([]);
    expect(localStorage.getItem('omnilink_local_cache_v1:local-default')).toBeNull();
    expect(localStorage.getItem('omnilink_local_cache_v1:workspace-a')).toBe('[]');

    ApiService.setWorkspaceNamespace('workspace-b');
    expect(ApiService.getLocalCache()).toEqual([]);
    expect(localStorage.getItem('omnilink_local_cache_v1:workspace-a')).toBeNull();
  });

  it('does not repopulate a cleared namespace from an in-flight response', async () => {
    ApiService.setWorkspaceNamespace('workspace-a');
    let resolveFetch!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })));

    const pending = ApiService.fetchLinks();
    ApiService.setWorkspaceNamespace('workspace-b');
    resolveFetch(new Response(JSON.stringify({ links: [], total: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(pending).resolves.toMatchObject({ links: [], total: 0 });
    expect(localStorage.getItem('omnilink_local_cache_v1:workspace-a')).toBeNull();
    expect(localStorage.getItem('omnilink_local_cache_v1:workspace-b')).toBeNull();
  });

  it('adds an explicitly injected bearer token without persisting or URL-encoding it', async () => {
    let requestInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestInit = init;
      return new Response(JSON.stringify({ answer: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    ApiService.setServiceToken('  service-token-value  ');
    await ApiService.askRepository('test question');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('service-token-value');
    expect(requestInit?.credentials).toBe('same-origin');
    expect(new Headers(requestInit?.headers).get('Authorization')).toBe('Bearer service-token-value');
  });

  it('does not silently use offline behavior after an auth rejection', async () => {
    ApiService.setWorkspaceNamespace('workspace-a');
    ApiService.setLocalCache([]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unauthorized', { status: 401 })));
    await expect(ApiService.askRepository('test question')).rejects.toBeInstanceOf(ApiAuthenticationError);
    expect(ApiService.getWorkspaceNamespace()).toBeNull();
    expect(localStorage.getItem('omnilink_local_cache_v1:workspace-a')).toBeNull();
  });

  it('resolves MCP credentials from the service-token environment variable', () => {
    expect(resolveMcpServiceToken({ OMNILINK_SERVICE_TOKEN: '  mcp-token  ' })).toBe('mcp-token');
    expect(resolveMcpServiceToken({ OMNILINK_API_TOKEN: 'legacy-token' })).toBe('legacy-token');
    expect(getMcpAuthorizationHeaders('mcp-token')).toEqual({ Authorization: 'Bearer mcp-token' });
    expect(getMcpAuthorizationHeaders(null)).toEqual({});
  });
});
