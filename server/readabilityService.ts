import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

export interface ReaderArticle {
  title: string;
  byline?: string;
  excerpt?: string;
  siteName?: string;
  contentHtml: string;
  contentMarkdown: string;
  readingTimeMinutes: number;
  wordCount: number;
  extractedAt: string;
}

export class ReadabilityService {
  private static turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  });

  static {
    // Configure turndown rules to preserve useful pre/code blocks and tables
    this.turndown.addRule('preCode', {
      filter: ['pre'],
      replacement: function (content, node) {
        const pre = node as HTMLElement;
        const code = pre.querySelector('code');
        const lang = code?.className?.replace(/language-/, '') || '';
        return `\n\`\`\`${lang}\n${pre.textContent?.trim() || content.trim()}\n\`\`\`\n`;
      },
    });
  }

  // Fetch full page and extract clean reader-mode text and markdown
  static async extractFromUrl(url: string, timeoutMs: number = 10000): Promise<ReaderArticle | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`[ReadabilityService] HTTP ${res.status} when fetching ${url}`);
        return null;
      }

      const html = await res.text();
      return this.extractFromHtml(html, url);
    } catch (err: any) {
      console.warn(`[ReadabilityService] Failed to extract from URL ${url}:`, err.message);
      return null;
    }
  }

  // Extract article from HTML string
  static extractFromHtml(html: string, url?: string): ReaderArticle | null {
    try {
      const dom = new JSDOM(html, { url: url || 'https://example.com' });
      const document = dom.window.document;

      // Remove script, style, iframe, nav, footer, ads before parsing
      const unwanted = document.querySelectorAll('script, style, noscript, iframe, nav, footer, header, svg, .ad, .ads, [aria-hidden="true"]');
      unwanted.forEach((el) => el.remove());

      const reader = new Readability(document, {
        charThreshold: 100,
        keepClasses: false,
      });

      const parsed = reader.parse();

      if (!parsed || !parsed.content) {
        // Fallback: Extract raw paragraphs from body
        const body = document.body;
        if (!body) return null;

        const title = document.title || 'Untitled Article';
        const paragraphs = Array.from(body.querySelectorAll('p, h1, h2, h3, h4, h5, pre, code, blockquote'))
          .map((p) => p.textContent?.trim())
          .filter((t): t is string => Boolean(t && t.length > 20));

        if (paragraphs.length === 0) return null;

        const rawText = paragraphs.join('\n\n');
        const wordCount = rawText.split(/\s+/).length;
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));

        return {
          title,
          excerpt: paragraphs[0]?.slice(0, 200),
          contentHtml: paragraphs.map((p) => `<p>${p}</p>`).join('\n'),
          contentMarkdown: paragraphs.join('\n\n'),
          readingTimeMinutes: readingTime,
          wordCount,
          extractedAt: new Date().toISOString(),
        };
      }

      const markdown = this.turndown.turndown(parsed.content);
      const text = parsed.textContent || '';
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const readingTime = Math.max(1, Math.ceil(wordCount / 200));

      return {
        title: parsed.title || document.title || 'Untitled',
        byline: parsed.byline || undefined,
        excerpt: parsed.excerpt || undefined,
        siteName: parsed.siteName || undefined,
        contentHtml: parsed.content,
        contentMarkdown: markdown,
        readingTimeMinutes: readingTime,
        wordCount,
        extractedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      console.warn('[ReadabilityService] DOM Readability parse failed:', err.message);
      return null;
    }
  }
}
