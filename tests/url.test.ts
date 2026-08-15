import { describe, it, expect } from 'vitest';
import { normalizeUrl, checkDuplicateInLinks, detectPlatform } from '../src/utils/url';
import { LinkItem } from '../src/types';

describe('URL Normalization & Deduplication Suite', () => {
  it('strips tracking parameters and normalizes protocol/trailing slashes', () => {
    const rawUrl = 'HTTPS://WWW.GitHub.com/facebook/react/?utm_source=twitter&utm_medium=social&ref=producthunt#getting-started';
    const normalized = normalizeUrl(rawUrl);
    expect(normalized).toBe('github.com/facebook/react');
  });

  it('normalizes mobile youtube and youtu.be links', () => {
    const shortUrl = 'https://youtu.be/dQw4w9WgXcQ?si=abcdef';
    const normalized = normalizeUrl(shortUrl);
    expect(normalized).toBe('youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('detects duplicate links in repository accurately', () => {
    const mockLinks: LinkItem[] = [
      {
        id: 'link-1',
        url: 'https://github.com/astral-sh/uv',
        title: 'Astral UV Package Manager',
        platform: 'github',
        category: 'Dev & Tech',
        tags: ['python', 'rust', 'cli'],
        summary: { tldr: 'Fast python manager' },
        isFavorite: false,
        isArchived: false,
        readStatus: 'unread',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const duplicateCheck = checkDuplicateInLinks('https://www.github.com/astral-sh/uv/?utm_campaign=launch#readme', mockLinks);
    expect(duplicateCheck.isDuplicate).toBe(true);
    expect(duplicateCheck.existingLink?.id).toBe('link-1');

    const uniqueCheck = checkDuplicateInLinks('https://github.com/astral-sh/ruff', mockLinks);
    expect(uniqueCheck.isDuplicate).toBe(false);
    expect(uniqueCheck.existingLink).toBeNull();
  });

  it('identifies developer platforms correctly', () => {
    expect(detectPlatform('https://github.com/anthropics/anthropic-sdk-python')).toBe('github');
    expect(detectPlatform('https://www.reddit.com/r/LocalLLaMA/comments/123456/')).toBe('reddit_post');
    expect(detectPlatform('https://arxiv.org/abs/2401.12345')).toBe('paper');
    expect(detectPlatform('https://www.youtube.com/watch?v=123456')).toBe('youtube');
    expect(detectPlatform('https://instagram.com/reel/abcdef/')).toBe('instagram_short');
    expect(detectPlatform('https://martinfowler.com/articles/patterns-of-distributed-systems.html')).toBe('article');
  });
});
