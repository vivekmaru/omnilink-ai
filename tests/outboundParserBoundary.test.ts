import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadabilityService } from '../server/readabilityService';
import { RssFeedManager } from '../server/rssService';

describe('outbound parser boundaries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not pass non-HTML responses to Readability', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      '<html><body><article><p>This must not be parsed.</p></article></body></html>',
      { status: 200, headers: { 'Content-Type': 'image/svg+xml' } },
    )));

    await expect(ReadabilityService.extractFromUrl('https://93.184.216.34/article')).resolves.toBeNull();
  });

  it('does not treat XML-looking HTML responses as RSS feeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('<rss><channel><title>Disguised feed</title></channel></rss>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }))
      .mockResolvedValue(new Response('', {
        status: 404,
        headers: { 'Content-Type': 'application/rss+xml' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(RssFeedManager.discoverFeed('https://93.184.216.34')).resolves.toMatchObject({
      discovered: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(9);
  });

  it('continues common-path RSS probing when the site root MIME is unsupported', async () => {
    const feedXml = '<rss><channel><title>Recovered feed</title><link>https://example.com</link></channel></rss>';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('not a parseable site document', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }))
      .mockResolvedValueOnce(new Response(feedXml, {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(RssFeedManager.discoverFeed('https://93.184.216.34')).resolves.toMatchObject({
      discovered: true,
      feedUrl: 'https://93.184.216.34/feed',
      title: 'Recovered feed',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
