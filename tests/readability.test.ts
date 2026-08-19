import { describe, it, expect } from 'vitest';
import { ReadabilityService } from '../server/readabilityService';

describe('Readability & Content Archiver Suite', () => {
  it('strips unwanted script, style, and navigation tags while extracting clean article content', () => {
    const dirtyHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Designing Resilient Microservices with gRPC</title>
          <style>.ad-banner { display: block; }</style>
          <script>console.log("analytics tracking");</script>
        </head>
        <body>
          <header><nav><a href="/">Home</a><a href="/pricing">Pricing</a></nav></header>
          <div class="ad-banner">Buy our stuff now!</div>
          <main>
            <article>
              <h1>Designing Resilient Microservices with gRPC</h1>
              <p class="byline">By Alex Rivera</p>
              <p>gRPC leverages HTTP/2 transport and Protocol Buffers for high-throughput, low-latency microservice communications.</p>
              <h2>Connection Pooling</h2>
              <p>Maintaining persistent TCP connections prevents costly handshake latencies across internal mesh networks.</p>
              <pre><code class="language-go">conn, err := grpc.DialContext(ctx, target, grpc.WithInsecure())</code></pre>
            </article>
          </main>
          <footer>Copyright 2026 Tech Weekly</footer>
        </body>
      </html>
    `;

    const article = ReadabilityService.extractFromHtml(dirtyHtml, 'https://techweekly.dev/grpc-microservices');
    expect(article).not.toBeNull();
    expect(article?.title).toContain('Designing Resilient Microservices with gRPC');
    expect(article?.contentMarkdown).toContain('Connection Pooling');
    expect(article?.contentMarkdown).toContain('```');
    expect(article?.contentMarkdown).not.toContain('analytics tracking');
    expect(article?.wordCount).toBeGreaterThan(20);
    expect(article?.readingTimeMinutes).toBeGreaterThanOrEqual(1);
  });

  it('exposes extractHackerNews, extractReddit, extractGitHub, extractYouTube, and extractArXiv methods', () => {
    expect(typeof ReadabilityService.extractHackerNews).toBe('function');
    expect(typeof ReadabilityService.extractReddit).toBe('function');
    expect(typeof ReadabilityService.extractGitHub).toBe('function');
    expect(typeof ReadabilityService.extractYouTube).toBe('function');
    expect(typeof ReadabilityService.extractArXiv).toBe('function');
    expect(typeof ReadabilityService.extractFromUrl).toBe('function');
  });
});
