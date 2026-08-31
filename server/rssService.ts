import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { RssFeed, RssFeedItem, RssDiscoveryResult, LinkItem, LinkSummary, PlatformType } from '../src/types';
import { ModelOrchestrator } from './modelOrchestrator';
import { AiQuotaExceededError } from './aiUsage';
import { ReadabilityService } from './readabilityService';
import { LOCAL_WORKSPACE_ID } from './db';
import { readResponseText, safeFetch } from './outboundUrlPolicy';

type StoredRssFeed = RssFeed & { workspaceId: string };

// Storage paths
const DATA_DIR = path.join(process.cwd(), 'data');
const RSS_FEEDS_FILE = path.join(DATA_DIR, 'rss_feeds.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Curated Subscriptions Seed
export const CURATED_DEV_FEEDS: Array<Omit<RssFeed, 'id' | 'createdAt' | 'updatedAt' | 'totalFetchedCount'>> = [
  {
    url: 'https://blog.cloudflare.com/rss/',
    siteUrl: 'https://blog.cloudflare.com',
    title: 'Cloudflare Blog',
    description: 'Insights on systems, networking, edge computing, cyber security, and AI infrastructure.',
    category: 'Dev & Tech',
    defaultTags: ['cloudflare', 'networking', 'security', 'edge-computing', 'engineering'],
    autoAiExtract: true,
    pollIntervalMinutes: 30,
    enabled: true,
    faviconUrl: 'https://www.google.com/s2/favicons?domain=blog.cloudflare.com&sz=128',
  },
  {
    url: 'https://github.blog/engineering/feed/',
    siteUrl: 'https://github.blog/engineering',
    title: 'GitHub Engineering',
    description: 'Technical articles, architectural deep dives, and scaling stories from GitHub engineers.',
    category: 'Dev & Tech',
    defaultTags: ['github', 'git', 'infrastructure', 'devops', 'architecture'],
    autoAiExtract: true,
    pollIntervalMinutes: 30,
    enabled: true,
    faviconUrl: 'https://www.google.com/s2/favicons?domain=github.blog&sz=128',
  },
  {
    url: 'https://netflixtechblog.com/feed',
    siteUrl: 'https://netflixtechblog.com',
    title: 'Netflix TechBlog',
    description: 'Learn about Netflix’s world-class engineering, distributed microservices, and culture.',
    category: 'Dev & Tech',
    defaultTags: ['netflix', 'distributed-systems', 'microservices', 'cloud', 'architecture'],
    autoAiExtract: true,
    pollIntervalMinutes: 60,
    enabled: true,
    faviconUrl: 'https://www.google.com/s2/favicons?domain=netflixtechblog.com&sz=128',
  },
  {
    url: 'https://hnrss.org/best',
    siteUrl: 'https://news.ycombinator.com',
    title: 'Hacker News (Best Stories)',
    description: 'Top-rated tech news, computer science discussions, and startup breakthroughs from Hacker News.',
    category: 'Dev & Tech',
    defaultTags: ['hackernews', 'tech-news', 'startups', 'discussions'],
    autoAiExtract: true,
    pollIntervalMinutes: 15,
    enabled: true,
    faviconUrl: 'https://www.google.com/s2/favicons?domain=news.ycombinator.com&sz=128',
  },
  {
    url: 'https://blog.google/technology/ai/rss/',
    siteUrl: 'https://blog.google/technology/ai/',
    title: 'Google AI & DeepMind News',
    description: 'The latest developments in artificial intelligence, Gemini, and foundation model research.',
    category: 'AI & Machine Learning',
    defaultTags: ['google-ai', 'gemini', 'deep-learning', 'machine-learning', 'research'],
    autoAiExtract: true,
    pollIntervalMinutes: 30,
    enabled: true,
    faviconUrl: 'https://www.google.com/s2/favicons?domain=blog.google&sz=128',
  },
  {
    url: 'https://vercel.com/atom',
    siteUrl: 'https://vercel.com/blog',
    title: 'Vercel Engineering Blog',
    description: 'Frontend performance, Next.js, React Server Components, and edge deployment innovations.',
    category: 'Dev & Tech',
    defaultTags: ['vercel', 'nextjs', 'react', 'frontend', 'web-dev'],
    autoAiExtract: true,
    pollIntervalMinutes: 60,
    enabled: true,
    faviconUrl: 'https://www.google.com/s2/favicons?domain=vercel.com&sz=128',
  },
  {
    url: 'https://blog.bytebytego.com/feed',
    siteUrl: 'https://blog.bytebytego.com',
    title: 'ByteByteGo System Design',
    description: 'Clear diagrams and architectural explanations of high-scale software engineering systems.',
    category: 'Dev & Tech',
    defaultTags: ['system-design', 'architecture', 'distributed-systems', 'databases'],
    autoAiExtract: true,
    pollIntervalMinutes: 60,
    enabled: true,
    faviconUrl: 'https://www.google.com/s2/favicons?domain=bytebytego.com&sz=128',
  },
  {
    url: 'https://newsletter.pragmaticengineer.com/feed',
    siteUrl: 'https://newsletter.pragmaticengineer.com',
    title: 'The Pragmatic Engineer',
    description: 'In-depth analysis for software engineers and engineering managers in Big Tech and startups.',
    category: 'Dev & Tech',
    defaultTags: ['engineering-management', 'career', 'big-tech', 'software-engineering'],
    autoAiExtract: true,
    pollIntervalMinutes: 60,
    enabled: true,
    faviconUrl: 'https://www.google.com/s2/favicons?domain=pragmaticengineer.com&sz=128',
  },
];

// Helper: Decode common HTML entities
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8230;/g, '…')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

// Helper: Strip HTML tags to get clean plain text
export function stripHtml(html: string): string {
  if (!html) return '';
  // Remove script and style tags completely
  const clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<pre\b[^<]*(?:(?!<\/pre>)<[^<]*)*<\/pre>/gi, '') // skip huge raw code blocks in snippet
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return decodeHtmlEntities(clean);
}

// Helper: Extract text from CDATA or standard node
function extractTagContent(xml: string, tagName: string): string {
  // Check CDATA first: <tagName><![CDATA[...]]></tagName>
  const cdataRegex = new RegExp(`<${tagName}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tagName}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch && cdataMatch[1]) {
    return cdataMatch[1].trim();
  }

  // Standard tag: <tagName>...</tagName>
  const stdRegex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const stdMatch = xml.match(stdRegex);
  if (stdMatch && stdMatch[1]) {
    return stdMatch[1].trim();
  }

  return '';
}

// Helper: Extract multiple tags
function extractAllTagContents(xml: string, tagName: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tagName}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tagName}>`, 'gi');
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const val = (match[1] !== undefined ? match[1] : match[2]) || '';
    const clean = decodeHtmlEntities(val.trim());
    if (clean) results.push(clean);
  }
  return results;
}

// Helper: Parse XML / RSS 2.0 / Atom Feed String
export function parseFeedXml(xmlContent: string, feedUrl: string): {
  title: string;
  description: string;
  siteUrl: string;
  feedType: 'rss2' | 'atom' | 'rdf' | 'json' | 'unknown';
  items: RssFeedItem[];
} {
  let feedType: 'rss2' | 'atom' | 'rdf' | 'json' | 'unknown' = 'unknown';
  let feedTitle = '';
  let feedDescription = '';
  let siteUrl = '';
  const items: RssFeedItem[] = [];

  // Check if Atom Feed: <feed xmlns="http://www.w3.org/2005/Atom"> or <feed>
  if (/<feed[\s>]/i.test(xmlContent)) {
    feedType = 'atom';

    // Channel metadata
    feedTitle = decodeHtmlEntities(extractTagContent(xmlContent, 'title'));
    feedDescription = decodeHtmlEntities(extractTagContent(xmlContent, 'subtitle'));

    // Website link in Atom: <link rel="alternate" href="..."/> or <link href="..."/>
    const linkMatch = xmlContent.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
      || xmlContent.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i)
      || xmlContent.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/>/i);
    if (linkMatch && linkMatch[1]) {
      siteUrl = linkMatch[1];
    }

    // Extract entries: <entry>...</entry>
    const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    let entryMatch;
    while ((entryMatch = entryRegex.exec(xmlContent)) !== null) {
      const entryXml = entryMatch[1];
      const title = decodeHtmlEntities(extractTagContent(entryXml, 'title'));
      
      // Link
      let link = '';
      const entryLinkMatch = entryXml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
        || entryXml.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i)
        || entryXml.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (entryLinkMatch && entryLinkMatch[1]) {
        link = entryLinkMatch[1].trim();
      }

      // ID
      const guid = extractTagContent(entryXml, 'id') || link || title;

      // Author
      let author = '';
      const authorMatch = entryXml.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i);
      if (authorMatch && authorMatch[1]) {
        author = decodeHtmlEntities(stripHtml(authorMatch[1]));
      }

      // PubDate
      const pubDate = extractTagContent(entryXml, 'published')
        || extractTagContent(entryXml, 'updated')
        || extractTagContent(entryXml, 'dc:date');

      // Content / Summary
      const summaryXml = extractTagContent(entryXml, 'summary')
        || extractTagContent(entryXml, 'content');
      const contentSnippet = stripHtml(summaryXml).slice(0, 450);

      // Categories
      const categories: string[] = [];
      const catRegex = /<category[^>]*term=["']([^"']+)["']/gi;
      let catMatch;
      while ((catMatch = catRegex.exec(entryXml)) !== null) {
        if (catMatch[1]) categories.push(decodeHtmlEntities(catMatch[1].trim()));
      }

      // Image / Thumbnail
      let thumbnailUrl = '';
      const imgMatch = entryXml.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i)
        || entryXml.match(/<media:content[^>]*url=["']([^"']+)["']/i)
        || summaryXml.match(/<img[^>]*src=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1]) {
        thumbnailUrl = imgMatch[1];
      }

      if (title && link) {
        items.push({
          guid,
          title,
          link,
          pubDate,
          author,
          contentSnippet,
          categories,
          thumbnailUrl,
        });
      }
    }
  } else {
    // Standard RSS 2.0 or RSS 1.0 (RDF)
    feedType = /<rdf:RDF/i.test(xmlContent) ? 'rdf' : 'rss2';

    // Channel metadata
    const channelMatch = xmlContent.match(/<channel[\s>]([\s\S]*?)<\/channel>/i);
    const channelXml = channelMatch ? channelMatch[1] : xmlContent;

    feedTitle = decodeHtmlEntities(extractTagContent(channelXml, 'title'));
    feedDescription = decodeHtmlEntities(extractTagContent(channelXml, 'description'));
    
    // Website link: <link>http://...</link>
    const stdLink = extractTagContent(channelXml, 'link');
    if (stdLink) {
      siteUrl = stdLink;
    }

    // Extract items: <item>...</item>
    const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(xmlContent)) !== null) {
      const itemXml = itemMatch[1];
      const title = decodeHtmlEntities(extractTagContent(itemXml, 'title'));
      
      // Link
      let link = extractTagContent(itemXml, 'link');
      if (!link) {
        const linkHrefMatch = itemXml.match(/<link[^>]*href=["']([^"']+)["']/i);
        if (linkHrefMatch) link = linkHrefMatch[1];
      }
      link = link.trim();

      // Guid
      const guid = extractTagContent(itemXml, 'guid') || link || title;

      // Author: <dc:creator> or <author>
      let author = extractTagContent(itemXml, 'dc:creator') || extractTagContent(itemXml, 'author');
      author = decodeHtmlEntities(stripHtml(author));

      // PubDate
      const pubDate = extractTagContent(itemXml, 'pubDate')
        || extractTagContent(itemXml, 'dc:date')
        || extractTagContent(itemXml, 'date');

      // Description / Content
      const rawContent = extractTagContent(itemXml, 'content:encoded')
        || extractTagContent(itemXml, 'description');
      const contentSnippet = stripHtml(rawContent).slice(0, 450);

      // Categories
      const categories = extractAllTagContents(itemXml, 'category');

      // Thumbnail
      let thumbnailUrl = '';
      const thumbMatch = itemXml.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i)
        || itemXml.match(/<media:content[^>]*url=["']([^"']+)["']/i)
        || itemXml.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i)
        || rawContent.match(/<img[^>]*src=["']([^"']+)["']/i);
      if (thumbMatch && thumbMatch[1]) {
        thumbnailUrl = thumbMatch[1];
      }

      if (title && (link || guid.startsWith('http'))) {
        items.push({
          guid,
          title,
          link: link || guid,
          pubDate,
          author,
          contentSnippet,
          categories,
          thumbnailUrl,
        });
      }
    }
  }

  // Derive siteUrl from feedUrl if missing
  if (!siteUrl) {
    try {
      const parsed = new URL(feedUrl);
      siteUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {
      siteUrl = feedUrl;
    }
  }

  if (!feedTitle) {
    try {
      const parsed = new URL(feedUrl);
      feedTitle = parsed.hostname.replace(/^www\./, '');
    } catch {
      feedTitle = 'RSS Feed';
    }
  }

  return {
    title: feedTitle,
    description: feedDescription,
    siteUrl,
    feedType,
    items,
  };
}

// Feed Persistence & State Manager
export class RssFeedManager {
  private static feeds: StoredRssFeed[] = [];
  private static initialized = false;

  static loadFeeds(): StoredRssFeed[] {
    if (this.initialized && this.feeds.length > 0) {
      return this.feeds;
    }

    try {
      if (fs.existsSync(RSS_FEEDS_FILE)) {
        const raw = fs.readFileSync(RSS_FEEDS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.feeds = parsed.map((f) => {
            const scoped = { ...f, workspaceId: f.workspaceId || LOCAL_WORKSPACE_ID };
            if (f.url && f.url.includes('hnrss.org') && f.autoAiExtract === false) {
              return { ...scoped, autoAiExtract: true };
            }
            return scoped;
          });
          this.initialized = true;
          return this.feeds;
        }
      }
    } catch (err) {
      console.warn('Failed reading rss_feeds.json, initializing seeds:', err);
    }

    // Initialize with curated seed subscriptions
    const now = new Date().toISOString();
    this.feeds = CURATED_DEV_FEEDS.map((seed, idx) => ({
      ...seed,
      workspaceId: LOCAL_WORKSPACE_ID,
      id: `feed-seed-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
      totalFetchedCount: 0,
      createdAt: now,
      updatedAt: now,
    }));

    this.saveFeeds(this.feeds);
    this.initialized = true;
    return this.feeds;
  }

  static saveFeeds(feeds: StoredRssFeed[]): void {
    this.feeds = feeds;
    try {
      fs.writeFileSync(RSS_FEEDS_FILE, JSON.stringify(feeds, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write rss_feeds.json:', err);
    }
  }

  static getAll(workspaceId: string = LOCAL_WORKSPACE_ID): RssFeed[] {
    return this.loadFeeds().filter((feed) => feed.workspaceId === workspaceId);
  }

  static getById(id: string, workspaceId: string = LOCAL_WORKSPACE_ID): RssFeed | undefined {
    return this.loadFeeds().find((f) => f.id === id && f.workspaceId === workspaceId);
  }

  static addFeed(feedInput: {
    url: string;
    siteUrl?: string;
    title: string;
    description?: string;
    category?: string;
    defaultTags?: string[];
    autoAiExtract?: boolean;
    pollIntervalMinutes?: number;
    faviconUrl?: string;
  }, workspaceId: string = LOCAL_WORKSPACE_ID): RssFeed {
    const feeds = this.loadFeeds();
    
    // Check if feed URL already subscribed
    const existing = feeds.find((f) => f.workspaceId === workspaceId && f.url.toLowerCase() === feedInput.url.toLowerCase().trim());
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const newFeed: StoredRssFeed = {
      workspaceId,
      id: `feed-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      url: feedInput.url.trim(),
      siteUrl: feedInput.siteUrl || feedInput.url,
      title: feedInput.title.trim(),
      description: feedInput.description || '',
      category: feedInput.category || 'Dev & Tech',
      defaultTags: feedInput.defaultTags && feedInput.defaultTags.length > 0 ? feedInput.defaultTags : ['rss', 'engineering'],
      autoAiExtract: feedInput.autoAiExtract !== false,
      pollIntervalMinutes: feedInput.pollIntervalMinutes || 30,
      enabled: true,
      faviconUrl: feedInput.faviconUrl || `https://www.google.com/s2/favicons?domain=${feedInput.url}&sz=128`,
      totalFetchedCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    feeds.unshift(newFeed);
    this.saveFeeds(feeds);
    return newFeed;
  }

  static updateFeed(id: string, updates: Partial<RssFeed>, workspaceId: string = LOCAL_WORKSPACE_ID): RssFeed | null {
    const feeds = this.loadFeeds();
    const idx = feeds.findIndex((f) => f.id === id && f.workspaceId === workspaceId);
    if (idx === -1) return null;

    const updated: StoredRssFeed = {
      ...feeds[idx],
      ...updates,
      id, // Immutable
      workspaceId,
      updatedAt: new Date().toISOString(),
    };

    feeds[idx] = updated;
    this.saveFeeds(feeds);
    return updated;
  }

  static deleteFeed(id: string, workspaceId: string = LOCAL_WORKSPACE_ID): boolean {
    const feeds = this.loadFeeds();
    const initialLen = feeds.length;
    const filtered = feeds.filter((f) => f.id !== id || f.workspaceId !== workspaceId);
    if (filtered.length === initialLen) return false;

    this.saveFeeds(filtered);
    return true;
  }

  // Auto-discover RSS / Atom URL from any website or blog
  static async discoverFeed(targetUrl: string): Promise<RssDiscoveryResult> {
    let cleanUrl = targetUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    // Step 1: Attempt direct fetch of the URL
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const response = await safeFetch(cleanUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (OmniLink AI RSS Crawler)',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*',
        },
      });
      clearTimeout(timeout);

      const contentType = response.headers.get('content-type') || '';
      const text = await readResponseText(response);

      // If already XML/RSS/Atom content
      if (
        contentType.includes('xml') ||
        contentType.includes('rss') ||
        contentType.includes('atom') ||
        text.includes('<rss') ||
        text.includes('<feed') ||
        text.includes('<rdf:RDF')
      ) {
        const parsed = parseFeedXml(text, cleanUrl);
        return {
          discovered: true,
          feedUrl: cleanUrl,
          siteUrl: parsed.siteUrl,
          title: parsed.title,
          description: parsed.description,
          feedType: parsed.feedType,
          sampleItems: parsed.items.slice(0, 5),
        };
      }

      // Step 2: Parse HTML to find <link rel="alternate" type="application/rss+xml" ...>
      const feedLinkMatches: string[] = [];
      const linkTagRegex = /<link[^>]+(?:rel=["']alternate["'][^>]+type=["'](application\/(?:rss\+xml|atom\+xml|xml)|text\/xml)["']|type=["'](application\/(?:rss\+xml|atom\+xml|xml)|text\/xml)["'][^>]+rel=["']alternate["'])[^>]*>/gi;
      let tagMatch;
      while ((tagMatch = linkTagRegex.exec(text)) !== null) {
        const hrefMatch = tagMatch[0].match(/href=["']([^"']+)["']/i);
        if (hrefMatch && hrefMatch[1]) {
          feedLinkMatches.push(hrefMatch[1]);
        }
      }

      // If link tag found, resolve full URL
      for (const rawHref of feedLinkMatches) {
        try {
          const resolvedUrl = new URL(rawHref, cleanUrl).toString();
          const feedRes = await safeFetch(resolvedUrl, {
            headers: { 'User-Agent': 'OmniLink-AI/1.0 RSS Reader' },
          });
          if (feedRes.ok) {
            const feedXml = await readResponseText(feedRes);
            if (feedXml.includes('<rss') || feedXml.includes('<feed') || feedXml.includes('<rdf:RDF')) {
              const parsed = parseFeedXml(feedXml, resolvedUrl);
              return {
                discovered: true,
                feedUrl: resolvedUrl,
                siteUrl: parsed.siteUrl || cleanUrl,
                title: parsed.title,
                description: parsed.description,
                feedType: parsed.feedType,
                sampleItems: parsed.items.slice(0, 5),
              };
            }
          }
        } catch {
          // Continue trying next
        }
      }

      // Step 3: Probe common feed paths
      const parsedBase = new URL(cleanUrl);
      const origin = parsedBase.origin;
      const commonPaths = ['/feed', '/rss', '/rss.xml', '/atom.xml', '/feed.xml', '/index.xml', '/engineering/feed', '/blog/feed'];

      for (const p of commonPaths) {
        try {
          const candidate = `${origin}${p}`;
          const candidateRes = await safeFetch(candidate, {
            headers: { 'User-Agent': 'OmniLink-AI/1.0 RSS Reader' },
          });
          if (candidateRes.ok) {
            const candidateXml = await readResponseText(candidateRes);
            if (candidateXml.includes('<rss') || candidateXml.includes('<feed') || candidateXml.includes('<rdf:RDF')) {
              const parsed = parseFeedXml(candidateXml, candidate);
              return {
                discovered: true,
                feedUrl: candidate,
                siteUrl: parsed.siteUrl || origin,
                title: parsed.title,
                description: parsed.description,
                feedType: parsed.feedType,
                sampleItems: parsed.items.slice(0, 5),
              };
            }
          }
        } catch {
          // Probe next
        }
      }
    } catch (err: any) {
      console.warn('Feed discovery error:', err.message);
    }

    // Fallback if not found
    return {
      discovered: false,
      feedUrl: cleanUrl,
      siteUrl: cleanUrl,
      title: 'Unknown Feed',
      feedType: 'unknown',
      sampleItems: [],
    };
  }

  // Fetch and Sync a specific feed against the existing repository links
  static async syncFeed(
    feedId: string,
    existingLinks: LinkItem[],
    genAiClient?: GoogleGenAI | null,
    workspaceId: string = LOCAL_WORKSPACE_ID,
  ): Promise<{
    feed: RssFeed;
    newLinks: LinkItem[];
    error?: string;
  }> {
    const feed = this.getById(feedId, workspaceId);
    if (!feed) {
      throw new Error(`Feed with ID ${feedId} not found.`);
    }

    const existingUrls = new Set(existingLinks.map((l) => l.url.trim().toLowerCase()));
    const newLinks: LinkItem[] = [];

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await safeFetch(feed.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (OmniLink AI RSS Reader)',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await readResponseText(response);
      const parsed = parseFeedXml(xmlText, feed.url);

      // Ingest latest items (limit up to 15 newest items per sync run)
      const candidateItems = parsed.items.slice(0, 15);

      for (const item of candidateItems) {
        const normalizedUrl = item.link.trim();
        if (existingUrls.has(normalizedUrl.toLowerCase())) {
          continue; // Already in repository
        }

        // Detect if snippet is just Hacker News boilerplate (e.g. "Article URL: ... Comments URL: ... Points: 247")
        const isHnBoilerplate = /Article URL:.*Comments URL:/is.test(item.contentSnippet || '');
        const cleanSnippet = isHnBoilerplate ? '' : item.contentSnippet;

        // Generate clean initial summary
        let summary: LinkSummary = {
          tldr: cleanSnippet
            ? (cleanSnippet.slice(0, 200) + (cleanSnippet.length > 200 ? '...' : ''))
            : `Article from ${feed.title}: "${item.title}".`,
          keyTakeaways: [
            `Curated from ${feed.title} stream.`,
            `Category: ${feed.category}`,
          ],
        };

        // If categories from feed exist, incorporate
        const itemTags = Array.from(
          new Set([
            ...feed.defaultTags,
            feed.title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            ...(item.categories || []).map((c) => c.toLowerCase().replace(/[^a-z0-9-_]/g, '')).filter(Boolean),
          ])
        ).slice(0, 8);

        let readingTime = Math.max(2, Math.min(25, Math.ceil((cleanSnippet?.length || 500) / 300)));
        let aiScore = 85;

        // Platform detection
        let platform: PlatformType = 'article';
        if (normalizedUrl.includes('github.com') || normalizedUrl.includes('github.blog')) {
          platform = 'github';
        } else if (normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be')) {
          platform = 'youtube';
        } else if (normalizedUrl.includes('arxiv.org')) {
          platform = 'paper';
        }

        // Determine created timestamp
        let createdAt = new Date().toISOString();
        if (item.pubDate) {
          const parsedTime = Date.parse(item.pubDate);
          if (!isNaN(parsedTime)) {
            createdAt = new Date(parsedTime).toISOString();
          }
        }

        const newLink: LinkItem = {
          id: `link-rss-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          url: normalizedUrl,
          title: item.title || 'Untitled RSS Item',
          description: cleanSnippet || '',
          author: item.author || feed.title,
          platform,
          category: feed.category || 'Dev & Tech',
          tags: itemTags,
          summary,
          thumbnailUrl: item.thumbnailUrl || feed.faviconUrl || undefined,
          faviconUrl: feed.faviconUrl || `https://www.google.com/s2/favicons?domain=${normalizedUrl}&sz=128`,
          notes: `Auto-ingested from RSS Feed: ${feed.title}`,
          isFavorite: false,
          isArchived: false,
          readStatus: 'unread', // DIRECTLY INTO UNREAD LIST
          createdAt,
          updatedAt: new Date().toISOString(),
          readingTimeMinutes: readingTime,
          aiScore,
          feedId: feed.id,
          feedTitle: feed.title,
          isRssFeedItem: true,
        };

        newLinks.push(newLink);
        existingUrls.add(normalizedUrl.toLowerCase());
      }

      // If autoAiExtract is enabled and AI client is available, run ModelOrchestrator on new items
      if (feed.autoAiExtract && genAiClient && newLinks.length > 0) {
        const topItems = newLinks.slice(0, 8);
        for (const link of topItems) {
          try {
            // Attempt to fetch full article text for deep analysis
            let articleExcerpt = link.description || '';
            try {
              const snapshot = await ReadabilityService.extractFromUrl(link.url, 8000);
              if (snapshot) {
                link.readerSnapshot = snapshot;
                if (snapshot.byline && (!link.author || link.author === feed.title)) {
                  link.author = snapshot.byline;
                }
                if (snapshot.readingTimeMinutes) {
                  link.readingTimeMinutes = snapshot.readingTimeMinutes;
                }
                articleExcerpt = snapshot.contentMarkdown?.slice(0, 3500) || snapshot.excerpt || link.description || '';
              }
            } catch (snapErr) {
              // Reader extraction fallback
            }

            const prompt = `Analyze this newly ingested technical article/link from ${feed.title}:
Title: ${link.title}
URL: ${link.url}
Category: ${feed.category}
${articleExcerpt ? `Article Content / Excerpt:\n${articleExcerpt}` : ''}

Guidelines:
- Write an insightful, punchy 1-2 sentence TL;DR summarizing the actual ideas, technical thesis, or core story.
- NEVER return raw URLs, HN comment links, or 'Article URL:' boilerplate as the summary.
- Provide 3 actionable, high-signal bullet takeaways explaining what was built, learned, or argued.
- Provide 4-6 specific, descriptive lowercase tags.`;

            const schema = {
              type: Type.OBJECT,
              properties: {
                tldr: { type: Type.STRING, description: '1-2 sentence punchy summary of article ideas' },
                keyTakeaways: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 key takeaways',
                },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '4-6 lowercase tags',
                },
              },
              required: ['tldr', 'keyTakeaways'],
            };

            const orchRes = await ModelOrchestrator.executeStructuredPrompt<{
              tldr: string;
              keyTakeaways: string[];
              tags?: string[];
            }>(
              genAiClient,
              {
                taskType: 'rss_ingestion',
                url: link.url,
                platform: link.platform,
                contentLength: articleExcerpt.length + link.title.length,
                isBatchOperation: true,
              },
              prompt,
              schema
            );

            if (orchRes.data && orchRes.data.tldr) {
              link.summary = {
                tldr: orchRes.data.tldr,
                keyTakeaways: orchRes.data.keyTakeaways || link.summary.keyTakeaways,
              };
              if (orchRes.data.tags && orchRes.data.tags.length > 0) {
                link.tags = Array.from(new Set([...link.tags, ...orchRes.data.tags]));
              }
            }
          } catch (itemAiErr) {
            if (itemAiErr instanceof AiQuotaExceededError) throw itemAiErr;
            console.warn(`[RSS AI Auto-Extraction] Skipped for ${link.title}:`, itemAiErr);
          }
        }
      }

      // Update feed statistics
      const updatedFeed = this.updateFeed(feed.id, {
        lastFetchedAt: new Date().toISOString(),
        lastError: undefined,
        totalFetchedCount: feed.totalFetchedCount + newLinks.length,
        siteUrl: parsed.siteUrl || feed.siteUrl,
        title: feed.title || parsed.title,
      }, workspaceId);

      return {
        feed: updatedFeed || feed,
        newLinks,
      };
    } catch (err: any) {
      if (err instanceof AiQuotaExceededError) throw err;
      console.error(`RSS Sync error for ${feed.title} (${feed.url}):`, err.message);
      this.updateFeed(feed.id, {
        lastFetchedAt: new Date().toISOString(),
        lastError: err.message || 'Sync failed',
      }, workspaceId);
      return {
        feed,
        newLinks: [],
        error: err.message || 'Sync failed',
      };
    }
  }

  // Sync All Enabled Feeds
  static async syncAllEnabledFeeds(
    existingLinks: LinkItem[],
    genAiClient?: GoogleGenAI | null,
    workspaceId: string = LOCAL_WORKSPACE_ID,
  ): Promise<{
    processedCount: number;
    newLinks: LinkItem[];
    errors: string[];
  }> {
    const feeds = this.loadFeeds().filter((f) => f.enabled && f.workspaceId === workspaceId);
    const allNewLinks: LinkItem[] = [];
    const errors: string[] = [];

    // Current working links list to prevent duplicate insertion across multiple feeds
    let currentLinks = [...existingLinks];

    for (const feed of feeds) {
      try {
        const result = await this.syncFeed(feed.id, currentLinks, genAiClient, workspaceId);
        if (result.newLinks.length > 0) {
          allNewLinks.push(...result.newLinks);
          currentLinks.push(...result.newLinks);
        }
        if (result.error) {
          errors.push(`${feed.title}: ${result.error}`);
        }
      } catch (err: any) {
        if (err instanceof AiQuotaExceededError) throw err;
        errors.push(`${feed.title}: ${err.message}`);
      }
    }

    return {
      processedCount: feeds.length,
      newLinks: allNewLinks,
      errors,
    };
  }

  // Export Feeds to OPML XML
  static exportOpml(workspaceId: string = LOCAL_WORKSPACE_ID): string {
    const feeds = this.getAll(workspaceId);
    let opml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    opml += `<opml version="2.0">\n`;
    opml += `  <head>\n`;
    opml += `    <title>OmniLink AI Subscribed RSS Feeds</title>\n`;
    opml += `    <dateCreated>${new Date().toUTCString()}</dateCreated>\n`;
    opml += `    <docs>http://opml.org/spec2.opml</docs>\n`;
    opml += `  </head>\n`;
    opml += `  <body>\n`;

    // Group by category
    const byCategory: Record<string, RssFeed[]> = {};
    for (const f of feeds) {
      const cat = f.category || 'Dev & Tech';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(f);
    }

    for (const [category, catFeeds] of Object.entries(byCategory)) {
      opml += `    <outline text="${escapeXml(category)}" title="${escapeXml(category)}">\n`;
      for (const feed of catFeeds) {
        opml += `      <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.url)}" htmlUrl="${escapeXml(feed.siteUrl || feed.url)}" category="${escapeXml(category)}"/>\n`;
      }
      opml += `    </outline>\n`;
    }

    opml += `  </body>\n`;
    opml += `</opml>`;
    return opml;
  }

  // Import Feeds from OPML XML
  static importOpml(opmlText: string, workspaceId: string = LOCAL_WORKSPACE_ID): { importedCount: number; skippedCount: number; feeds: RssFeed[] } {
    const existingFeeds = this.getAll(workspaceId);
    const existingUrls = new Set(existingFeeds.map((f) => f.url.toLowerCase()));
    let importedCount = 0;
    let skippedCount = 0;

    // Regex to match <outline ... xmlUrl="..." ... />
    const outlineRegex = /<outline[^>]+xmlUrl=["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = outlineRegex.exec(opmlText)) !== null) {
      const tagStr = match[0];
      const xmlUrl = match[1].trim();

      if (!xmlUrl || existingUrls.has(xmlUrl.toLowerCase())) {
        skippedCount++;
        continue;
      }

      // Extract title/text
      let title = '';
      const titleMatch = tagStr.match(/title=["']([^"']+)["']/i) || tagStr.match(/text=["']([^"']+)["']/i);
      if (titleMatch && titleMatch[1]) {
        title = decodeHtmlEntities(titleMatch[1]);
      } else {
        try {
          title = new URL(xmlUrl).hostname;
        } catch {
          title = 'Imported Feed';
        }
      }

      // Extract htmlUrl
      let siteUrl = '';
      const htmlUrlMatch = tagStr.match(/htmlUrl=["']([^"']+)["']/i);
      if (htmlUrlMatch && htmlUrlMatch[1]) {
        siteUrl = htmlUrlMatch[1];
      }

      // Extract category
      let category = 'Dev & Tech';
      const catMatch = tagStr.match(/category=["']([^"']+)["']/i);
      if (catMatch && catMatch[1]) {
        category = decodeHtmlEntities(catMatch[1]);
      }

      this.addFeed({
        url: xmlUrl,
        siteUrl: siteUrl || xmlUrl,
        title,
        category,
        defaultTags: ['rss', 'imported'],
        autoAiExtract: true,
      }, workspaceId);

      existingUrls.add(xmlUrl.toLowerCase());
      importedCount++;
    }

    return {
      importedCount,
      skippedCount,
      feeds: this.getAll(workspaceId),
    };
  }
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
