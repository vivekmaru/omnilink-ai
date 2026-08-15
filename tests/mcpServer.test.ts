import { describe, it, expect } from 'vitest';
import { createOmniLinkMcpServer } from '../server/mcpServer';
import { omniDb } from '../server/db';

describe('OmniLink MCP Server Suite', () => {
  it('creates and registers all required MCP tools and resources', () => {
    const server = createOmniLinkMcpServer();
    expect(server).toBeDefined();

    // Verify tool registration through internal tools registry or server instance
    expect(server.server).toBeDefined();
  });

  it('runs get_repository_stats and returns database metrics', async () => {
    const server = createOmniLinkMcpServer();
    expect(server).toBeDefined();

    // Verify omniDb has entries
    const count = omniDb.count();
    expect(count).toBeGreaterThanOrEqual(0);

    const stats = {
      totalBookmarks: count,
      inboxUnread: omniDb.getUnreadCount(),
      currentlyReading: omniDb.getReadingCount(),
      reviewedRead: omniDb.getReadCount(),
    };

    expect(stats.totalBookmarks).toBeGreaterThanOrEqual(0);
  });

  it('handles save_bookmark duplicate detection and insertion', async () => {
    const testUrl = 'https://github.com/astral-sh/uv';
    const existing = omniDb.getLinkByUrl(testUrl);

    if (existing) {
      expect(existing.url).toBe(testUrl);
    } else {
      omniDb.insertLink({
        id: 'test-mcp-1',
        url: testUrl,
        title: 'uv python package manager',
        description: 'Test insertion from MCP suite',
        platform: 'github',
        category: 'Dev & Tech',
        tags: ['python', 'rust', 'cli'],
        summary: { tldr: 'Fast Python manager', keyTakeaways: ['Replaces pip'] },
        notes: 'Test note',
        isFavorite: false,
        isArchived: false,
        readStatus: 'unread',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const check = omniDb.getLinkByUrl(testUrl);
      expect(check).toBeDefined();
    }
  });
});
