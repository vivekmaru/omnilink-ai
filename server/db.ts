import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { LinkItem, PlatformType, ReadStatus, SystemStats } from '../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'omnilink.db');
const REPO_JSON_FILE = path.join(DATA_DIR, 'repository.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class OmniLinkDB {
  private db: Database.Database;

  constructor(dbPath: string = DB_FILE) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS links (
        id TEXT PRIMARY KEY,
        url TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        author TEXT,
        platform TEXT NOT NULL,
        category TEXT NOT NULL,
        tags TEXT NOT NULL, -- JSON string array
        summary TEXT NOT NULL, -- JSON string object
        ai_summary TEXT, -- JSON string object
        thumbnail_url TEXT,
        favicon_url TEXT,
        notes TEXT,
        is_favorite INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        read_status TEXT DEFAULT 'unread',
        reading_time_minutes INTEGER DEFAULT 3,
        ai_score INTEGER DEFAULT 85,
        feed_id TEXT,
        feed_title TEXT,
        is_rss_feed_item INTEGER DEFAULT 0,
        reader_snapshot TEXT, -- JSON string of offline article snapshot
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_links_url ON links(url);
      CREATE INDEX IF NOT EXISTS idx_links_category ON links(category);
      CREATE INDEX IF NOT EXISTS idx_links_platform ON links(platform);
      CREATE INDEX IF NOT EXISTS idx_links_read_status ON links(read_status);
      CREATE INDEX IF NOT EXISTS idx_links_favorite ON links(is_favorite);
      CREATE INDEX IF NOT EXISTS idx_links_archived ON links(is_archived);
      CREATE INDEX IF NOT EXISTS idx_links_created_at ON links(created_at DESC);

      -- FTS5 Full Text Search Virtual Table
      CREATE VIRTUAL TABLE IF NOT EXISTS links_fts USING fts5(
        id UNINDEXED,
        title,
        url,
        category,
        tags,
        notes,
        summary
      );

      -- Triggers for FTS Synchronization
      CREATE TRIGGER IF NOT EXISTS links_ai AFTER INSERT ON links BEGIN
        INSERT INTO links_fts(id, title, url, category, tags, notes, summary)
        VALUES (new.id, new.title, new.url, new.category, new.tags, new.notes, new.summary);
      END;

      CREATE TRIGGER IF NOT EXISTS links_ad AFTER DELETE ON links BEGIN
        DELETE FROM links_fts WHERE id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS links_au AFTER UPDATE ON links BEGIN
        DELETE FROM links_fts WHERE id = old.id;
        INSERT INTO links_fts(id, title, url, category, tags, notes, summary)
        VALUES (new.id, new.title, new.url, new.category, new.tags, new.notes, new.summary);
      END;

      -- Dense Vector Embeddings Table
      CREATE TABLE IF NOT EXISTS embeddings (
        link_id TEXT PRIMARY KEY,
        dimensions INTEGER NOT NULL,
        model TEXT NOT NULL,
        vector BLOB NOT NULL, -- Float32Array binary buffer
        text_chunk TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(link_id) REFERENCES links(id) ON DELETE CASCADE
      );
    `);

    // Safe column migration if table already exists
    try {
      this.db.exec('ALTER TABLE links ADD COLUMN reader_snapshot TEXT');
    } catch {
      // Column already exists
    }
  }

  // Row mapper
  private mapRowToLink(row: any): LinkItem {
    let tags: string[] = [];
    let summary: any = { tldr: '' };
    let aiSummary: any = undefined;
    let readerSnapshot: any = undefined;

    try {
      tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [];
    } catch {
      tags = [];
    }

    try {
      summary = typeof row.summary === 'string' ? JSON.parse(row.summary) : row.summary || { tldr: '' };
    } catch {
      summary = { tldr: row.title || '' };
    }

    try {
      if (row.ai_summary) {
        aiSummary = typeof row.ai_summary === 'string' ? JSON.parse(row.ai_summary) : row.ai_summary;
      }
    } catch {
      aiSummary = undefined;
    }

    try {
      if (row.reader_snapshot) {
        readerSnapshot = typeof row.reader_snapshot === 'string' ? JSON.parse(row.reader_snapshot) : row.reader_snapshot;
      }
    } catch {
      readerSnapshot = undefined;
    }

    return {
      id: row.id,
      url: row.url,
      title: row.title,
      description: row.description || undefined,
      author: row.author || undefined,
      platform: row.platform as PlatformType,
      category: row.category,
      tags,
      summary,
      aiSummary,
      thumbnailUrl: row.thumbnail_url || undefined,
      faviconUrl: row.favicon_url || undefined,
      notes: row.notes || undefined,
      isFavorite: Boolean(row.is_favorite),
      isArchived: Boolean(row.is_archived),
      readStatus: (row.read_status || 'unread') as ReadStatus,
      readingTimeMinutes: row.reading_time_minutes !== null ? Number(row.reading_time_minutes) : 3,
      aiScore: row.ai_score !== null ? Number(row.ai_score) : 85,
      feedId: row.feed_id || undefined,
      feedTitle: row.feed_title || undefined,
      isRssFeedItem: Boolean(row.is_rss_feed_item),
      readerSnapshot,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Map LinkItem to DB parameter object
  private mapLinkToRow(link: LinkItem) {
    return {
      id: link.id,
      url: link.url,
      title: link.title,
      description: link.description || null,
      author: link.author || null,
      platform: link.platform,
      category: link.category,
      tags: JSON.stringify(link.tags || []),
      summary: JSON.stringify(link.summary || { tldr: link.title }),
      ai_summary: link.aiSummary ? JSON.stringify(link.aiSummary) : null,
      thumbnail_url: link.thumbnailUrl || null,
      favicon_url: link.faviconUrl || null,
      notes: link.notes || null,
      is_favorite: link.isFavorite ? 1 : 0,
      is_archived: link.isArchived ? 1 : 0,
      read_status: link.readStatus || 'unread',
      reading_time_minutes: link.readingTimeMinutes || 3,
      ai_score: link.aiScore || 85,
      feed_id: link.feedId || null,
      feed_title: link.feedTitle || null,
      is_rss_feed_item: link.isRssFeedItem ? 1 : 0,
      reader_snapshot: link.readerSnapshot ? JSON.stringify(link.readerSnapshot) : null,
      created_at: link.createdAt || new Date().toISOString(),
      updated_at: link.updatedAt || new Date().toISOString(),
    };
  }

  // Count total links
  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM links').get() as { count: number };
    return row.count;
  }

  // Get all links (ordered by created_at DESC)
  getAllLinks(): LinkItem[] {
    const rows = this.db.prepare('SELECT * FROM links ORDER BY created_at DESC').all();
    return rows.map((r) => this.mapRowToLink(r));
  }

  // Get single link by ID
  getLinkById(id: string): LinkItem | null {
    const row = this.db.prepare('SELECT * FROM links WHERE id = ?').get(id);
    if (!row) return null;
    return this.mapRowToLink(row);
  }

  // Get single link by URL
  getLinkByUrl(url: string): LinkItem | null {
    const row = this.db.prepare('SELECT * FROM links WHERE url = ?').get(url);
    if (!row) return null;
    return this.mapRowToLink(row);
  }

  // Insert a single link
  insertLink(link: LinkItem): LinkItem {
    const params = this.mapLinkToRow(link);
    const stmt = this.db.prepare(`
      INSERT INTO links (
        id, url, title, description, author, platform, category, tags,
        summary, ai_summary, thumbnail_url, favicon_url, notes,
        is_favorite, is_archived, read_status, reading_time_minutes, ai_score,
        feed_id, feed_title, is_rss_feed_item, reader_snapshot, created_at, updated_at
      ) VALUES (
        @id, @url, @title, @description, @author, @platform, @category, @tags,
        @summary, @ai_summary, @thumbnail_url, @favicon_url, @notes,
        @is_favorite, @is_archived, @read_status, @reading_time_minutes, @ai_score,
        @feed_id, @feed_title, @is_rss_feed_item, @reader_snapshot, @created_at, @updated_at
      )
    `);
    stmt.run(params);
    return link;
  }

  // Update a single link
  updateLink(id: string, updates: Partial<LinkItem>): LinkItem | null {
    const existing = this.getLinkById(id);
    if (!existing) return null;

    const merged: LinkItem = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const params = this.mapLinkToRow(merged);
    const stmt = this.db.prepare(`
      UPDATE links SET
        url = @url,
        title = @title,
        description = @description,
        author = @author,
        platform = @platform,
        category = @category,
        tags = @tags,
        summary = @summary,
        ai_summary = @ai_summary,
        thumbnail_url = @thumbnail_url,
        favicon_url = @favicon_url,
        notes = @notes,
        is_favorite = @is_favorite,
        is_archived = @is_archived,
        read_status = @read_status,
        reading_time_minutes = @reading_time_minutes,
        ai_score = @ai_score,
        feed_id = @feed_id,
        feed_title = @feed_title,
        is_rss_feed_item = @is_rss_feed_item,
        reader_snapshot = @reader_snapshot,
        updated_at = @updated_at
      WHERE id = @id
    `);
    stmt.run(params);
    return merged;
  }

  // Delete a single link
  deleteLink(id: string): boolean {
    const info = this.db.prepare('DELETE FROM links WHERE id = ?').run(id);
    return info.changes > 0;
  }

  // Bulk Insert
  bulkInsert(links: LinkItem[]): number {
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO links (
        id, url, title, description, author, platform, category, tags,
        summary, ai_summary, thumbnail_url, favicon_url, notes,
        is_favorite, is_archived, read_status, reading_time_minutes, ai_score,
        feed_id, feed_title, is_rss_feed_item, reader_snapshot, created_at, updated_at
      ) VALUES (
        @id, @url, @title, @description, @author, @platform, @category, @tags,
        @summary, @ai_summary, @thumbnail_url, @favicon_url, @notes,
        @is_favorite, @is_archived, @read_status, @reading_time_minutes, @ai_score,
        @feed_id, @feed_title, @is_rss_feed_item, @reader_snapshot, @created_at, @updated_at
      )
    `);

    const insertMany = this.db.transaction((items: LinkItem[]) => {
      let count = 0;
      for (const item of items) {
        insertStmt.run(this.mapLinkToRow(item));
        count++;
      }
      return count;
    });

    return insertMany(links);
  }

  // Batch mark read/status
  batchUpdate(ids: string[], updates: Partial<LinkItem>): number {
    if (!ids || ids.length === 0) return 0;
    const now = new Date().toISOString();
    let updatedCount = 0;

    const tx = this.db.transaction(() => {
      for (const id of ids) {
        const item = this.getLinkById(id);
        if (item) {
          this.updateLink(id, updates);
          updatedCount++;
        }
      }
    });

    tx();
    return updatedCount;
  }

  // Batch delete
  batchDelete(ids: string[]): number {
    if (!ids || ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`DELETE FROM links WHERE id IN (${placeholders})`);
    const info = stmt.run(...ids);
    return info.changes;
  }

  // Search FTS5 (Lexical BM25 ranking)
  searchFts(query: string, limit: number = 20): Array<{ id: string; rank: number }> {
    if (!query || !query.trim()) return [];
    const cleanQuery = query
      .trim()
      .replace(/[^\w\s-]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term}"*`)
      .join(' OR ');

    if (!cleanQuery) return [];

    try {
      const stmt = this.db.prepare(`
        SELECT id, rank
        FROM links_fts
        WHERE links_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `);
      const rows = stmt.all(cleanQuery, limit) as Array<{ id: string; rank: number }>;
      return rows;
    } catch (err) {
      console.warn('FTS search fallback query error:', err);
      // Fallback LIKE query
      const likeQuery = `%${query.trim()}%`;
      const fallbackStmt = this.db.prepare(`
        SELECT id, -1.0 as rank
        FROM links
        WHERE title LIKE ? OR url LIKE ? OR notes LIKE ? OR tags LIKE ?
        LIMIT ?
      `);
      return fallbackStmt.all(likeQuery, likeQuery, likeQuery, likeQuery, limit) as Array<{ id: string; rank: number }>;
    }
  }

  // Vector Embedding Storage
  storeEmbedding(linkId: string, vector: number[], model: string, textChunk: string = ''): void {
    const float32 = new Float32Array(vector);
    const buffer = Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO embeddings (link_id, dimensions, model, vector, text_chunk, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(linkId, vector.length, model, buffer, textChunk, new Date().toISOString());
  }

  // Get single vector embedding
  getEmbedding(linkId: string): { linkId: string; vector: Float32Array; model: string; textChunk?: string } | null {
    const row = this.db.prepare('SELECT * FROM embeddings WHERE link_id = ?').get(linkId) as any;
    if (!row) return null;

    const buf = row.vector as Buffer;
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const float32 = new Float32Array(arrayBuffer);

    return {
      linkId: row.link_id,
      vector: float32,
      model: row.model,
      textChunk: row.text_chunk || undefined,
    };
  }

  // Get all embeddings for semantic vector scan
  getAllEmbeddings(): Array<{ linkId: string; vector: Float32Array; model: string }> {
    const rows = this.db.prepare('SELECT link_id, vector, model FROM embeddings').all() as any[];
    return rows.map((r) => {
      const buf = r.vector as Buffer;
      const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      return {
        linkId: r.link_id,
        vector: new Float32Array(arrayBuffer),
        model: r.model,
      };
    });
  }

  // Get link IDs that do not have embeddings yet
  getUnindexedLinkIds(): string[] {
    const rows = this.db.prepare(`
      SELECT l.id
      FROM links l
      LEFT JOIN embeddings e ON l.id = e.link_id
      WHERE e.link_id IS NULL
      ORDER BY l.created_at DESC
    `).all() as Array<{ id: string }>;

    return rows.map((r) => r.id);
  }

  // System Stats aggregation
  getStats(): SystemStats {
    const total = this.count();
    const unread = (this.db.prepare("SELECT COUNT(*) as c FROM links WHERE read_status = 'unread'").get() as any).c;
    const favorites = (this.db.prepare("SELECT COUNT(*) as c FROM links WHERE is_favorite = 1").get() as any).c;
    const archived = (this.db.prepare("SELECT COUNT(*) as c FROM links WHERE is_archived = 1").get() as any).c;

    const platformRows = this.db.prepare(`
      SELECT platform, COUNT(*) as count FROM links GROUP BY platform
    `).all() as Array<{ platform: string; count: number }>;
    const platformCounts: Record<string, number> = {};
    for (const r of platformRows) {
      platformCounts[r.platform] = r.count;
    }

    const categoryRows = this.db.prepare(`
      SELECT category, COUNT(*) as count FROM links GROUP BY category
    `).all() as Array<{ category: string; count: number }>;
    const categoriesBreakdown: Record<string, number> = {};
    for (const r of categoryRows) {
      categoriesBreakdown[r.category] = r.count;
    }

    const readStateCounts = {
      unread,
      reading: (this.db.prepare("SELECT COUNT(*) as c FROM links WHERE read_status = 'reading'").get() as any).c,
      read: (this.db.prepare("SELECT COUNT(*) as c FROM links WHERE read_status = 'read'").get() as any).c,
    };

    return {
      totalLinks: total,
      unreadCount: unread,
      favoritesCount: favorites,
      archivedCount: archived,
      platformCounts,
      categoriesBreakdown,
    };
  }

  // Safe migration helper: imports from repository.json or seed data if empty
  migrateIfNeeded(seedLinks: LinkItem[] = []): void {
    const count = this.count();
    if (count > 0) return;

    // Try reading repository.json first
    if (fs.existsSync(REPO_JSON_FILE)) {
      try {
        const raw = fs.readFileSync(REPO_JSON_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`[OmniLinkDB] Migrating ${parsed.length} bookmarks from repository.json into SQLite omnilink.db...`);
          this.bulkInsert(parsed);
          console.log(`[OmniLinkDB] Migration complete! Total links in DB: ${this.count()}`);
          return;
        }
      } catch (err) {
        console.warn('[OmniLinkDB] Error reading repository.json for migration:', err);
      }
    }

    // Fall back to seed links
    if (seedLinks.length > 0) {
      console.log(`[OmniLinkDB] Initializing database with ${seedLinks.length} seed links...`);
      this.bulkInsert(seedLinks);
      console.log(`[OmniLinkDB] Seed initialization complete! Total links: ${this.count()}`);
    }
  }

  // Export entire DB to JSON for backups or sync
  exportToJson(): LinkItem[] {
    return this.getAllLinks();
  }
}

// Global Singleton Instance
export const omniDb = new OmniLinkDB();
