import { describe, it, expect } from 'vitest';
import { renderInlineMarkdown } from '../src/components/MarkdownRenderer';

describe('MarkdownRenderer Inline Parsing Suite', () => {
  it('parses bold, italic, and inline code properly', () => {
    const text = 'Out of the 8 retrieved bookmarks, **6 are focused on AI** and *Machine Learning* with `text-embedding-004`:';
    const nodes = renderInlineMarkdown(text);
    expect(nodes.length).toBeGreaterThan(1);
  });

  it('parses citation ID badges properly', () => {
    const text = '1. **The Pulse** [ID: link-rss-1787249015091-9m8y]';
    const mockLinks = [
      {
        id: 'link-rss-1787249015091-9m8y',
        url: 'https://pulse.dev',
        title: 'The Pulse Migrations',
        platform: 'article' as const,
        category: 'Dev & Tech',
        tags: [],
        summary: { tldr: 'The Pulse Migrations' },
        isFavorite: false,
        isArchived: false,
        readStatus: 'unread' as const,
        createdAt: '',
        updatedAt: '',
      },
    ];

    const nodes = renderInlineMarkdown(text, mockLinks);
    expect(nodes.length).toBeGreaterThanOrEqual(2);
  });

  it('parses standard markdown links', () => {
    const text = 'Check [Vercel Blog](https://vercel.com/blog) for details';
    const nodes = renderInlineMarkdown(text);
    expect(nodes.length).toBe(3);
  });
});
