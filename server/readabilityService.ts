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

  // --- Specialized Platform Scrapers ---

  // 1. Reddit Thread & Comments Scraper
  static async extractReddit(url: string, timeoutMs: number = 8000): Promise<ReaderArticle | null> {
    try {
      // Extract post ID from various Reddit URL patterns
      // Patterns: reddit.com/r/sub/comments/id/slug, redd.it/id, reddit.com/comments/id
      const postMatch = url.match(/reddit\.com\/r\/([^\/]+)\/comments\/([a-z0-9]+)/i)
        || url.match(/redd\.it\/([a-z0-9]+)/i)
        || url.match(/reddit\.com\/comments\/([a-z0-9]+)/i);

      if (!postMatch) return null;

      const subreddit = postMatch[1] && postMatch[2] ? postMatch[1] : 'Reddit';
      const postId = postMatch[2] || postMatch[1];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Fetch submission from Pullpush archive API
      const subRes = await fetch(`https://api.pullpush.io/reddit/submission/search/?ids=${postId}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      clearTimeout(timeoutId);

      if (subRes.ok) {
        const subJson = await subRes.json();
        const post = subJson.data?.[0];

        if (post && post.title) {
          const subName = post.subreddit || subreddit;
          const authorName = post.author || 'Anonymous';
          const postScore = post.score || 0;
          const selftext = (post.selftext || '').trim();

          // Fetch top upvoted community comments
          let topComments: Array<{ author: string; score: number; body: string }> = [];
          try {
            const comController = new AbortController();
            const comTimeout = setTimeout(() => comController.abort(), 4000);
            const comRes = await fetch(
              `https://api.pullpush.io/reddit/comment/search/?link_id=${postId}&sort=desc&sort_type=score&size=10`,
              { signal: comController.signal, headers: { Accept: 'application/json' } }
            );
            clearTimeout(comTimeout);

            if (comRes.ok) {
              const comJson = await comRes.json();
              topComments = (comJson.data || [])
                .map((c: any) => ({
                  author: c.author || 'commenter',
                  score: c.score || 0,
                  body: (c.body || '').trim(),
                }))
                .filter((c: any) => c.body && c.body !== '[deleted]' && c.body !== '[removed]');
            }
          } catch {
            // Non-blocking comment fetch fallback
          }

          let markdown = `# ${post.title}\n\n`;
          markdown += `**Subreddit:** r/${subName} | **Author:** u/${authorName} | **Score:** ${postScore} points | **Comments:** ${post.num_comments || topComments.length}\n\n`;

          if (selftext) {
            markdown += `## Original Discussion Post:\n${selftext}\n\n`;
          }

          if (topComments.length > 0) {
            markdown += `## Top Community Solutions & Upvoted Comments:\n`;
            for (const c of topComments) {
              markdown += `### u/${c.author} (${c.score} points):\n${c.body}\n\n`;
            }
          }

          const wordCount = markdown.split(/\s+/).filter(Boolean).length;
          const readingTime = Math.max(2, Math.ceil(wordCount / 200));

          return {
            title: `${post.title} (r/${subName})`,
            byline: `u/${authorName} on r/${subName}`,
            excerpt: selftext.slice(0, 250) || `Reddit discussion on r/${subName} with ${topComments.length} top community answers.`,
            siteName: `Reddit - r/${subName}`,
            contentHtml: `<div class="reddit-thread"><h1>${post.title}</h1><p><strong>r/${subName}</strong> - u/${authorName}</p><div>${selftext}</div></div>`,
            contentMarkdown: markdown,
            readingTimeMinutes: readingTime,
            wordCount,
            extractedAt: new Date().toISOString(),
          };
        }
      }
    } catch (err: any) {
      console.warn('[ReadabilityService] Reddit extraction fallback attempt:', err.message);
    }

    // Fallback: Reddit oEmbed
    try {
      const oeRes = await fetch(`https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`);
      if (oeRes.ok) {
        const oe = await oeRes.json();
        const title = oe.title || 'Reddit Discussion';
        const author = oe.author_name ? `u/${oe.author_name}` : 'Reddit Community';
        const md = `# ${title}\n\n**Source:** Reddit (${author})\n\n[Visit original Reddit conversation](${url})`;

        return {
          title,
          byline: author,
          excerpt: `Reddit discussion by ${author}: ${title}`,
          siteName: 'Reddit',
          contentHtml: `<h1>${title}</h1><p>By ${author}</p>`,
          contentMarkdown: md,
          readingTimeMinutes: 2,
          wordCount: 50,
          extractedAt: new Date().toISOString(),
        };
      }
    } catch {
      // Ignore
    }

    return null;
  }

  // 2. GitHub Repository Scraper (README + Architecture)
  static async extractGitHub(url: string, timeoutMs: number = 8000): Promise<ReaderArticle | null> {
    try {
      const repoMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\/?$|\/blob\/|\/tree\/)/i);
      if (!repoMatch) return null;

      const owner = repoMatch[1];
      const repo = repoMatch[2].replace(/\.git$/, '');

      // Try fetching README from main or master branch
      const branches = ['HEAD', 'main', 'master'];
      let readmeText = '';

      for (const branch of branches) {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs / 2);
          const res = await fetch(rawUrl, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            readmeText = await res.text();
            if (readmeText && readmeText.length > 50) break;
          }
        } catch {
          // Try next branch
        }
      }

      if (readmeText) {
        const markdown = `# ${owner}/${repo}\n\n**GitHub Repository:** [https://github.com/${owner}/${repo}](https://github.com/${owner}/${repo})\n\n---\n\n${readmeText}`;
        const wordCount = markdown.split(/\s+/).filter(Boolean).length;
        const readingTime = Math.max(3, Math.ceil(wordCount / 220));

        return {
          title: `${owner}/${repo}: Open-Source Repository`,
          byline: owner,
          excerpt: readmeText.slice(0, 300).replace(/[#*`_]/g, '').trim(),
          siteName: 'GitHub',
          contentHtml: `<h1>${owner}/${repo}</h1><pre>${readmeText.slice(0, 1000)}</pre>`,
          contentMarkdown: markdown,
          readingTimeMinutes: readingTime,
          wordCount,
          extractedAt: new Date().toISOString(),
        };
      }
    } catch (err: any) {
      console.warn('[ReadabilityService] GitHub README fetch notice:', err.message);
    }
    return null;
  }

  // 3. YouTube Video Metadata Scraper
  static async extractYouTube(url: string, timeoutMs: number = 6000): Promise<ReaderArticle | null> {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const title = data.title || 'YouTube Video';
        const channel = data.author_name || 'YouTube Creator';
        const markdown = `# ${title}\n\n**Creator / Channel:** [${channel}](${data.author_url || url})\n**Platform:** YouTube Video\n\n[Watch Video on YouTube](${url})`;

        return {
          title: `${title} - ${channel}`,
          byline: channel,
          excerpt: `YouTube video by ${channel}: ${title}`,
          siteName: 'YouTube',
          contentHtml: `<h1>${title}</h1><p>By ${channel}</p>`,
          contentMarkdown: markdown,
          readingTimeMinutes: 8,
          wordCount: 60,
          extractedAt: new Date().toISOString(),
        };
      }
    } catch {
      // Fallback
    }
    return null;
  }

  // 4. ArXiv Academic Paper Scraper
  static async extractArXiv(url: string, timeoutMs: number = 8000): Promise<ReaderArticle | null> {
    try {
      const arxivMatch = url.match(/arxiv\.org\/abs\/([^\/\?#]+)/i);
      if (!arxivMatch) return null;

      const arxivId = arxivMatch[1];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`https://arxiv.org/abs/${arxivId}`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const html = await res.text();
        const dom = new JSDOM(html);
        const doc = dom.window.document;

        const titleRaw = doc.querySelector('h1.title')?.textContent || '';
        const title = titleRaw.replace(/^Title:\s*/i, '').trim() || `ArXiv:${arxivId}`;
        const authors = doc.querySelector('div.authors')?.textContent?.replace(/^Authors:\s*/i, '').trim() || '';
        const abstract = doc.querySelector('blockquote.abstract')?.textContent?.replace(/^Abstract:\s*/i, '').trim() || '';

        const markdown = `# ${title}\n\n**Authors:** ${authors}\n**ArXiv ID:** [${arxivId}](https://arxiv.org/abs/${arxivId})\n**PDF Download:** [https://arxiv.org/pdf/${arxivId}.pdf](https://arxiv.org/pdf/${arxivId}.pdf)\n\n## Abstract:\n${abstract}\n`;

        return {
          title: `${title} (ArXiv:${arxivId})`,
          byline: authors,
          excerpt: abstract.slice(0, 300),
          siteName: 'ArXiv.org',
          contentHtml: `<h1>${title}</h1><p>${authors}</p><blockquote>${abstract}</blockquote>`,
          contentMarkdown: markdown,
          readingTimeMinutes: 12,
          wordCount: markdown.split(/\s+/).filter(Boolean).length,
          extractedAt: new Date().toISOString(),
        };
      }
    } catch {
      // Fallback
    }
    return null;
  }

  // Fetch full page and extract clean reader-mode text and markdown
  static async extractFromUrl(url: string, timeoutMs: number = 10000): Promise<ReaderArticle | null> {
    if (!url || typeof url !== 'string') return null;
    const lower = url.toLowerCase();

    // 1. Platform-Specific Scrapers for High-Density Extraction
    if (lower.includes('reddit.com') || lower.includes('redd.it')) {
      const redditData = await this.extractReddit(url, timeoutMs);
      if (redditData) return redditData;
    }

    if (lower.includes('github.com') && !lower.includes('gist.github.com')) {
      const githubData = await this.extractGitHub(url, timeoutMs);
      if (githubData) return githubData;
    }

    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      const ytData = await this.extractYouTube(url, timeoutMs);
      if (ytData) return ytData;
    }

    if (lower.includes('arxiv.org/abs/')) {
      const arxivData = await this.extractArXiv(url, timeoutMs);
      if (arxivData) return arxivData;
    }

    // 2. Standard Web Page Readability Scraper
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
