import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OutboundUrlPolicyError, assertSafeOutboundUrl, createSafeConnectionLookup, readResponseText, safeFetch } from '../server/outboundUrlPolicy';

describe('outbound URL policy', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    'ftp://example.com/file',
    'http://user:password@example.com',
    'http://127.0.0.1/admin',
    'http://10.0.0.1/metadata',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/admin',
    'http://[fd00::1]/internal',
    'http://[fec0::1]/deprecated-site-local',
    'http://[100::1]/discard-only',
    'http://[2002:0a00:0001::]/6to4-private-v4',
    'http://[64:ff9b::0a00:0001]/translated-private-v4',
  ])('rejects unsafe URL %s before fetch', async (url) => {
    await expect(assertSafeOutboundUrl(url)).rejects.toBeInstanceOf(OutboundUrlPolicyError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('resolves hostnames and validates each redirect hop', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 302, headers: { location: 'https://93.184.216.34/next' } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const response = await safeFetch('https://93.184.216.34/start');
    expect(await response.text()).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('blocks a redirect to a private address and enforces redirect limits', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response('', { status: 302, headers: { location: 'http://127.0.0.1/admin' } }));
    await expect(safeFetch('https://93.184.216.34/start')).rejects.toMatchObject({ code: 'blocked-host' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('', { status: 302, headers: { location: 'https://93.184.216.34/loop' } }));
    await expect(safeFetch('https://93.184.216.34/start', { maxRedirects: 1 })).rejects.toMatchObject({ code: 'redirect-limit' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('limits streamed response bodies', async () => {
    const response = new Response('0123456789');
    await expect(readResponseText(response, 5)).rejects.toMatchObject({ code: 'response-too-large' });
  });

  it('revalidates and pins DNS inside the connection dispatcher', async () => {
    const privateLookup = vi.fn().mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    const lookup = createSafeConnectionLookup(privateLookup as any)!;
    const result = await new Promise<{ error: NodeJS.ErrnoException | null; addresses: unknown[] }>((resolve) => {
      lookup(new URL('https://public.example'), {}, (error, addresses) => resolve({ error, addresses }));
    });
    expect(result.error?.code).toBe('EACCES');
    expect(result.addresses).toEqual([]);

    const publicLookup = vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    const publicConnectionLookup = createSafeConnectionLookup(publicLookup as any)!;
    const publicResult = await new Promise<{ error: NodeJS.ErrnoException | null; addresses: Array<{ address: string }> }>((resolve) => {
      publicConnectionLookup(new URL('https://public.example'), {}, (error, addresses) => resolve({ error, addresses }));
    });
    expect(publicResult.error).toBeNull();
    expect(publicResult.addresses).toEqual([expect.objectContaining({ address: '93.184.216.34' })]);
  });
});
