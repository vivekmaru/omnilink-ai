import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OutboundUrlPolicyError,
  assertResponseMediaType,
  assertSafeOutboundUrl,
  createSafeConnectionLookup,
  getOutboundRequestMetrics,
  readResponseHtml,
  readResponseJson,
  readResponseText,
  readResponseXml,
  resetOutboundRequestMetrics,
  safeFetch,
} from '../server/outboundUrlPolicy';

describe('outbound URL policy', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    resetOutboundRequestMetrics();
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

  it('applies the central default timeout and composes it with a caller signal', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    fetchMock.mockImplementation(async (_url: URL, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return new Response('ok');
    });

    await safeFetch('https://93.184.216.34/');
    expect(timeoutSpy).toHaveBeenCalledWith(15_000);

    const controller = new AbortController();
    const callerReason = new DOMException('caller stopped', 'AbortError');
    fetchMock.mockImplementationOnce((_url: URL, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    }));
    const pending = safeFetch('https://93.184.216.34/', { signal: controller.signal });
    controller.abort(callerReason);
    await expect(pending).rejects.toBe(callerReason);
  });

  it('keeps the timeout active while a helper reads the response body', async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream<Uint8Array>({ cancel }));
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    const fetched = await safeFetch('https://93.184.216.34/', { timeoutMs: 10 });
    await expect(readResponseText(fetched)).rejects.toMatchObject({ code: 'request-timeout' });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(getOutboundRequestMetrics().timedOutRequests).toBe(1);
  });

  it('bounds a stalled DNS preflight with the same request timeout', async () => {
    const stalledLookup = vi.fn().mockReturnValue(new Promise(() => undefined));
    await expect(safeFetch('https://stalled.example/', {
      lookup: stalledLookup as any,
      timeoutMs: 10,
    })).rejects.toMatchObject({ code: 'request-timeout' });
    expect(fetch).not.toHaveBeenCalled();
    expect(getOutboundRequestMetrics().timedOutRequests).toBe(1);
  });

  it('preserves caller cancellation during direct DNS validation', async () => {
    const controller = new AbortController();
    const callerReason = new DOMException('caller stopped', 'AbortError');
    const stalledLookup = vi.fn().mockReturnValue(new Promise(() => undefined));
    const pending = assertSafeOutboundUrl('https://stalled.example/', controller.signal, stalledLookup as any);
    controller.abort(callerReason);
    await expect(pending).rejects.toBe(callerReason);
  });

  it.each([0.5, 2_147_483_648])('rejects unsupported timeout value %s as a policy error', async (timeoutMs) => {
    await expect(safeFetch('https://93.184.216.34/', { timeoutMs }))
      .rejects.toMatchObject({ code: 'invalid-url' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('records network failures without recording request data', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError('connection reset'));
    await expect(safeFetch('https://93.184.216.34/private-query?token=secret'))
      .rejects.toThrow('connection reset');

    const metrics = getOutboundRequestMetrics();
    expect(metrics.networkFailures).toBe(1);
    expect(JSON.stringify(metrics)).not.toContain('secret');
  });

  it.each([
    ['EACCES', 'blockedRequests'],
    ['ENOTFOUND', 'dnsFailures'],
  ] as const)('classifies connection-time %s failures in security metrics', async (code, metric) => {
    const cause = Object.assign(new Error('connection lookup rejected'), { code });
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new TypeError('fetch failed', { cause }),
    );

    await expect(safeFetch('https://93.184.216.34/')).rejects.toThrow('fetch failed');
    expect(getOutboundRequestMetrics()[metric]).toBe(1);
    expect(getOutboundRequestMetrics().networkFailures).toBe(0);
  });

  it('blocks a redirect to a private address and enforces redirect limits', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response('', { status: 302, headers: { location: 'http://127.0.0.1/admin' } }));
    await expect(safeFetch('https://93.184.216.34/start')).rejects.toMatchObject({ code: 'blocked-host' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getOutboundRequestMetrics().blockedRequests).toBe(1);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('', { status: 302, headers: { location: 'https://93.184.216.34/loop' } }));
    await expect(safeFetch('https://93.184.216.34/start', { maxRedirects: 1 })).rejects.toMatchObject({ code: 'redirect-limit' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('limits streamed response bodies', async () => {
    const response = new Response('0123456789');
    await expect(readResponseText(response, 5)).rejects.toMatchObject({ code: 'response-too-large' });
  });

  it('rejects oversized declared and streamed bodies and records only aggregate metrics', async () => {
    const declared = new Response('tiny', { headers: { 'content-length': '999' } });
    await expect(readResponseText(declared, 5)).rejects.toMatchObject({ code: 'response-too-large' });

    const streamed = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(4));
        controller.enqueue(new Uint8Array(4));
        controller.close();
      },
    }));
    await expect(readResponseText(streamed, 5)).rejects.toMatchObject({ code: 'response-too-large' });

    expect(getOutboundRequestMetrics()).toEqual(expect.objectContaining({ oversizedResponses: 2 }));
    expect(Object.keys(getOutboundRequestMetrics())).not.toEqual(expect.arrayContaining(['url', 'headers', 'body', 'query']));
  });

  it.each([
    ['application/json; charset=utf-8', 'json'],
    ['application/problem+json', 'json'],
    ['text/html; charset=UTF-8', 'html'],
    ['application/xhtml+xml', 'html'],
    ['application/rss+xml', 'xml'],
    ['text/xml', 'xml'],
    ['text/plain; charset=utf-8', 'text'],
  ] as const)('allows media type %s as %s', (contentType, kind) => {
    const response = new Response('', { headers: { 'content-type': contentType } });
    expect(assertResponseMediaType(response, [kind])).toBe(contentType.split(';')[0].toLowerCase());
  });

  it('rejects missing or mismatched parser media types and cancels the body', async () => {
    const cancel = vi.fn();
    const wrongType = new Response(new ReadableStream<Uint8Array>({ cancel }), {
      headers: { 'content-type': 'image/svg+xml' },
    });
    expect(() => assertResponseMediaType(wrongType, ['html'])).toThrowError(expect.objectContaining({ code: 'unsupported-media-type' }));
    await vi.waitFor(() => expect(cancel).toHaveBeenCalled());
    expect(() => assertResponseMediaType(new Response('{}'), ['json'])).toThrowError(expect.objectContaining({ code: 'unsupported-media-type' }));
    expect(getOutboundRequestMetrics().rejectedMediaTypes).toBe(2);
  });

  it('provides parser-specific body helpers', async () => {
    await expect(readResponseJson<{ ok: boolean }>(new Response('{"ok":true}', {
      headers: { 'content-type': 'application/json' },
    }))).resolves.toEqual({ ok: true });
    await expect(readResponseHtml(new Response('<p>ok</p>', {
      headers: { 'content-type': 'text/html' },
    }))).resolves.toBe('<p>ok</p>');
    await expect(readResponseXml(new Response('<rss/>', {
      headers: { 'content-type': 'application/rss+xml' },
    }))).resolves.toBe('<rss/>');
  });

  it('rejects mixed public/private DNS results and DNS failures', async () => {
    const mixedLookup = vi.fn().mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);
    await expect(assertSafeOutboundUrl('https://mixed.example', undefined, mixedLookup as any))
      .rejects.toMatchObject({ code: 'blocked-host' });

    const failedLookup = vi.fn().mockRejectedValue(new Error('resolver unavailable'));
    await expect(assertSafeOutboundUrl('https://missing.example', undefined, failedLookup as any))
      .rejects.toMatchObject({ code: 'dns-failure' });
  });

  it('records a DNS failure discovered at a redirect hop', async () => {
    const lookup = vi.fn()
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockRejectedValueOnce(new Error('resolver unavailable'));
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Response('', {
      status: 302,
      headers: { location: 'https://missing.example/next' },
    }));

    await expect(safeFetch('https://public.example/start', { lookup: lookup as any }))
      .rejects.toMatchObject({ code: 'dns-failure' });
    expect(getOutboundRequestMetrics().dnsFailures).toBe(1);
  });

  it('rejects HTTPS downgrade redirects', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Response('', {
      status: 302,
      headers: { location: 'http://93.184.216.34/insecure' },
    }));
    await expect(safeFetch('https://93.184.216.34/secure')).rejects.toMatchObject({ code: 'invalid-url' });
  });

  it('strips credentials across origins but retains them for same-origin redirects', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 302, headers: { location: '/same' } }))
      .mockResolvedValueOnce(new Response('', { status: 302, headers: { location: 'https://93.184.216.35/other' } }))
      .mockResolvedValueOnce(new Response('ok'));

    await safeFetch('https://93.184.216.34/start', {
      headers: { authorization: 'Bearer secret', cookie: 'session=secret', 'x-safe': 'yes' },
    });
    const sameOriginHeaders = fetchMock.mock.calls[1][1].headers as Headers;
    expect(sameOriginHeaders.get('authorization')).toBe('Bearer secret');
    expect(sameOriginHeaders.get('cookie')).toBe('session=secret');
    const crossOriginHeaders = fetchMock.mock.calls[2][1].headers as Headers;
    expect(crossOriginHeaders.get('authorization')).toBeNull();
    expect(crossOriginHeaders.get('cookie')).toBeNull();
    expect(crossOriginHeaders.get('x-safe')).toBe('yes');
  });

  it('rejects credentials introduced by a redirect URL', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Response('', {
      status: 302,
      headers: { location: 'https://user:password@93.184.216.34/private' },
    }));
    await expect(safeFetch('https://93.184.216.34/start')).rejects.toMatchObject({ code: 'invalid-url' });
    expect(fetch).toHaveBeenCalledTimes(1);
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
