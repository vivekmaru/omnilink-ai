import { LinkItem, DuplicateCheckResult, PlatformType } from '../types';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'ref_src',
  'ref_url',
  'source',
  'fbclid',
  'gclid',
  'igsh',
  'si',
  'feature',
  'context',
  'share_id',
  't', // timestamp on youtube (optional, but keep clean)
  'ved',
  'usqp',
]);

/**
 * Normalizes a URL for robust canonical duplicate detection.
 * Handles protocol stripping/unification, www prefix removal, tracking query param stripping,
 * trailing slash trimming, and platform-specific canonicalization (e.g. YouTube, Reddit, GitHub).
 */
export function normalizeUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  let normalized = trimmed;
  // Ensure protocol for parsing
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized;
  }

  try {
    const parsed = new URL(normalized);
    let host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let pathname = parsed.pathname.replace(/\/+$/, ''); // Strip trailing slashes
    if (pathname === '/') pathname = '';

    // Handle YouTube canonicalization (youtu.be/ID vs youtube.com/watch?v=ID)
    if (host === 'youtu.be' && pathname) {
      const videoId = pathname.replace(/^\/+/, '');
      return `youtube.com/watch?v=${videoId}`;
    }
    if ((host === 'youtube.com' || host === 'm.youtube.com') && pathname.includes('/watch')) {
      const v = parsed.searchParams.get('v');
      if (v) {
        return `youtube.com/watch?v=${v}`;
      }
    }

    // Handle Reddit comment/post canonicalization
    if (host === 'reddit.com' || host === 'old.reddit.com') {
      // e.g. /r/LocalLLaMA/comments/1f8a81z/slug/ -> /r/LocalLLaMA/comments/1f8a81z
      const redditMatch = pathname.match(/^(\/r\/[^/]+\/comments\/[^/]+)/i);
      if (redditMatch) {
        pathname = redditMatch[1].toLowerCase();
        return `reddit.com${pathname}`;
      }
    }

    // Handle GitHub repository canonicalization (strip .git suffix)
    if (host === 'github.com' || host === 'gitlab.com') {
      pathname = pathname.replace(/\.git$/i, '').toLowerCase();
    }

    // Filter tracking query parameters
    const cleanParams = new URLSearchParams();
    parsed.searchParams.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!TRACKING_PARAMS.has(lowerKey)) {
        cleanParams.append(key, value);
      }
    });

    // Sort params for deterministic equality
    cleanParams.sort();
    const queryStr = cleanParams.toString() ? `?${cleanParams.toString()}` : '';

    return `${host}${pathname}${queryStr}`.toLowerCase();
  } catch {
    // Fallback naive string cleanup
    return trimmed
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '');
  }
}

/**
 * Checks whether two URLs point to the same content.
 */
export function areUrlsEqual(urlA: string, urlB: string): { isMatch: boolean; matchType?: 'exact' | 'normalized' } {
  if (!urlA || !urlB) return { isMatch: false };
  const trimmedA = urlA.trim();
  const trimmedB = urlB.trim();

  if (trimmedA === trimmedB) {
    return { isMatch: true, matchType: 'exact' };
  }

  const normA = normalizeUrl(trimmedA);
  const normB = normalizeUrl(trimmedB);

  if (normA && normB && normA === normB) {
    return { isMatch: true, matchType: 'normalized' };
  }

  return { isMatch: false };
}

/**
 * Finds if a given URL already exists in a collection of links.
 */
export function checkDuplicateInLinks(targetUrl: string, links: LinkItem[]): DuplicateCheckResult {
  const trimmed = targetUrl.trim();
  const normalizedTarget = normalizeUrl(trimmed);

  if (!trimmed || !links || links.length === 0) {
    return {
      isDuplicate: false,
      existingLink: null,
      normalizedUrl: normalizedTarget,
    };
  }

  // 1. Exact match check first
  const exactMatch = links.find((l) => l.url.trim() === trimmed);
  if (exactMatch) {
    return {
      isDuplicate: true,
      matchType: 'exact',
      existingLink: exactMatch,
      normalizedUrl: normalizedTarget,
    };
  }

  // 2. Normalized match check
  if (normalizedTarget) {
    const normMatch = links.find((l) => normalizeUrl(l.url) === normalizedTarget);
    if (normMatch) {
      return {
        isDuplicate: true,
        matchType: 'normalized',
        existingLink: normMatch,
        normalizedUrl: normalizedTarget,
      };
    }
  }

  return {
    isDuplicate: false,
    existingLink: null,
    normalizedUrl: normalizedTarget,
  };
}

/**
 * Detects the platform of a URL (github, reddit_post, paper, youtube, instagram_short, twitter_x, article, other)
 */
export function detectPlatform(url: string): PlatformType {
  const lower = url.toLowerCase();
  if (lower.includes('github.com')) return 'github';
  if (lower.includes('reddit.com/r/') && (lower.includes('/comments/') || lower.includes('/s/'))) {
    if (lower.includes('comment')) return 'reddit_post';
    return 'reddit_post';
  }
  if (lower.includes('reddit.com')) return 'reddit_post';
  if (lower.includes('instagram.com/reel') || lower.includes('instagram.com/p/') || lower.includes('tiktok.com')) return 'instagram_short';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter_x';
  if (lower.includes('arxiv.org') || lower.includes('biorxiv.org') || lower.includes('.pdf')) return 'paper';
  if (
    lower.includes('medium.com') ||
    lower.includes('dev.to') ||
    lower.includes('substack.com') ||
    lower.includes('blog') ||
    lower.includes('article') ||
    lower.includes('news')
  ) {
    return 'article';
  }
  return 'article';
}

/**
 * Parses mobile Share Target query parameters (handles cases where URL is passed in url, text, or title).
 */
export function parseShareTargetParams(search: string): { url?: string; title?: string; notes?: string } {
  if (!search) return {};
  const params = new URLSearchParams(search);
  let rawUrl = params.get('url') || params.get('link') || '';
  let rawTitle = params.get('title') || '';
  let rawText = params.get('text') || params.get('notes') || '';

  // If url param is empty, extract first http/https URL from text or title
  if (!rawUrl) {
    const combined = `${rawText} ${rawTitle}`;
    const match = combined.match(/https?:\/\/[^\s]+/i);
    if (match) {
      rawUrl = match[0];
      // Strip URL from text so notes contain only the commentary
      rawText = rawText.replace(rawUrl, '').trim();
    }
  }

  // If title was actually a raw URL and url is empty, fix mapping
  if (!rawUrl && /^https?:\/\//i.test(rawTitle)) {
    rawUrl = rawTitle;
    rawTitle = '';
  }

  return {
    url: rawUrl.trim() || undefined,
    title: rawTitle.trim() || undefined,
    notes: rawText.trim() || undefined,
  };
}
