import Database from 'better-sqlite3';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import path from 'path';
import fs from 'fs';
import { LinkItem, PlatformType, ReadStatus, SystemStats } from '../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'omnilink.db');
const REPO_JSON_FILE = path.join(DATA_DIR, 'repository.json');
export const LOCAL_WORKSPACE_ID = 'local-default';

export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

export interface UserRecord {
  id: string;
  issuer: string;
  subject: string;
  email?: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMembershipRecord {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  workspaceId: string;
  expiresAt: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface ServiceTokenRecord {
  id: string;
  userId: string;
  workspaceId: string;
  tokenPrefix: string;
  name: string;
  scopes: string[];
  expiresAt?: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface CreatedServiceToken extends ServiceTokenRecord {
  /** Raw token is returned exactly once and is never persisted. */
  token: string;
}

export interface AiUsageRecord {
  id: string;
  actorId: string;
  workspaceId: string;
  operation: string;
  model: string;
  source: string;
  requestId?: string;
  inputTokens: number;
  outputTokens: number;
  weightedUnits: number;
  status: string;
  createdAt: string;
}

export interface OidcTransactionRecord {
  stateHash: string;
  nonce: string;
  codeVerifier: string;
  redirectAfter: string;
  expiresAt: string;
}

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
      -- Tenant and identity primitives.  These tables are intentionally
      -- provider-neutral; authentication adapters resolve users into a
      -- workspace before repository services are called.
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        issuer TEXT NOT NULL,
        subject TEXT NOT NULL,
        email TEXT,
        name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (issuer, subject)
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspace_memberships (
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
        created_at TEXT NOT NULL,
        PRIMARY KEY (workspace_id, user_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_memberships_user ON workspace_memberships(user_id);
      CREATE INDEX IF NOT EXISTS idx_memberships_workspace ON workspace_memberships(workspace_id);

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used_at TEXT,
        revoked_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

      CREATE TABLE IF NOT EXISTS oidc_transactions (
        state_hash TEXT PRIMARY KEY,
        nonce TEXT NOT NULL,
        code_verifier TEXT NOT NULL,
        redirect_after TEXT NOT NULL DEFAULT '/',
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_oidc_transactions_expiry ON oidc_transactions(expires_at);

      CREATE TABLE IF NOT EXISTS service_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        token_prefix TEXT NOT NULL,
        name TEXT NOT NULL,
        scopes TEXT NOT NULL, -- JSON string array
        expires_at TEXT,
        created_at TEXT NOT NULL,
        last_used_at TEXT,
        revoked_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_service_tokens_workspace ON service_tokens(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_service_tokens_user ON service_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_service_tokens_expiry ON service_tokens(expires_at);

      CREATE TABLE IF NOT EXISTS ai_usage (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        model TEXT NOT NULL,
        source TEXT NOT NULL,
        request_id TEXT,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        weighted_units REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_ai_usage_workspace_created ON ai_usage(workspace_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_ai_usage_actor_created ON ai_usage(actor_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_ai_usage_request ON ai_usage(request_id);

      INSERT OR IGNORE INTO workspaces (id, name, created_at, updated_at)
      VALUES ('local-default', 'Local workspace', datetime('now'), datetime('now'));

      CREATE TABLE IF NOT EXISTS links (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL DEFAULT 'local-default',
        url TEXT NOT NULL,
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
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

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
        workspace_id TEXT NOT NULL DEFAULT 'local-default',
        dimensions INTEGER NOT NULL,
        model TEXT NOT NULL,
        vector BLOB NOT NULL, -- Float32Array binary buffer
        text_chunk TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(link_id) REFERENCES links(id) ON DELETE CASCADE
      );
    `);

    // Safe column migrations for databases created before tenant ownership.
    // SQLite applies a constant DEFAULT to existing rows, which backfills all
    // legacy data into the single local workspace without a data rewrite.
    this.addColumnIfMissing('links', 'workspace_id TEXT NOT NULL DEFAULT \'local-default\'');
    this.addColumnIfMissing('links', 'reader_snapshot TEXT');
    this.addColumnIfMissing('embeddings', 'workspace_id TEXT NOT NULL DEFAULT \'local-default\'');
    this.removeLegacyGlobalUrlUniqueness();

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_links_workspace ON links(workspace_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_links_workspace_url ON links(workspace_id, url);
      CREATE INDEX IF NOT EXISTS idx_links_url ON links(url);
      CREATE INDEX IF NOT EXISTS idx_links_category ON links(category);
      CREATE INDEX IF NOT EXISTS idx_links_platform ON links(platform);
      CREATE INDEX IF NOT EXISTS idx_links_read_status ON links(read_status);
      CREATE INDEX IF NOT EXISTS idx_links_favorite ON links(is_favorite);
      CREATE INDEX IF NOT EXISTS idx_links_archived ON links(is_archived);
      CREATE INDEX IF NOT EXISTS idx_links_created_at ON links(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_embeddings_workspace ON embeddings(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_embeddings_workspace_link ON embeddings(workspace_id, link_id);
    `);
  }

  private addColumnIfMissing(table: string, definition: string): void {
    const columnName = definition.trim().split(/\s+/)[0];
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (columns.some((column) => column.name === columnName)) return;
    this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }

  /** Rebuild pre-tenant link tables whose inline `url UNIQUE` would couple workspaces. */
  private removeLegacyGlobalUrlUniqueness(): void {
    const indexes = this.db.prepare('PRAGMA index_list(links)').all() as Array<{ name: string; unique: number }>;
    const hasGlobalUrlUnique = indexes.some((index) => {
      if (!index.unique) return false;
      const columns = this.db.prepare(`PRAGMA index_info(${JSON.stringify(index.name)})`).all() as Array<{ name: string }>;
      return columns.length === 1 && columns[0].name === 'url';
    });
    if (!hasGlobalUrlUnique) return;

    this.db.pragma('foreign_keys = OFF');
    try {
      this.db.exec(`
        BEGIN IMMEDIATE;
        DROP TRIGGER IF EXISTS links_ai;
        DROP TRIGGER IF EXISTS links_ad;
        DROP TRIGGER IF EXISTS links_au;
        CREATE TABLE links_tenant_migration (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL DEFAULT 'local-default',
          url TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT, author TEXT, platform TEXT NOT NULL, category TEXT NOT NULL,
          tags TEXT NOT NULL, summary TEXT NOT NULL, ai_summary TEXT, thumbnail_url TEXT,
          favicon_url TEXT, notes TEXT, is_favorite INTEGER DEFAULT 0, is_archived INTEGER DEFAULT 0,
          read_status TEXT DEFAULT 'unread', reading_time_minutes INTEGER DEFAULT 3, ai_score INTEGER DEFAULT 85,
          feed_id TEXT, feed_title TEXT, is_rss_feed_item INTEGER DEFAULT 0, reader_snapshot TEXT,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );
        INSERT INTO links_tenant_migration
          SELECT id, workspace_id, url, title, description, author, platform, category, tags, summary,
            ai_summary, thumbnail_url, favicon_url, notes, is_favorite, is_archived, read_status,
            reading_time_minutes, ai_score, feed_id, feed_title, is_rss_feed_item, reader_snapshot,
            created_at, updated_at
          FROM links;
        DROP TABLE links;
        ALTER TABLE links_tenant_migration RENAME TO links;
        DELETE FROM links_fts;
        INSERT INTO links_fts(id, title, url, category, tags, notes, summary)
          SELECT id, title, url, category, tags, notes, summary FROM links;
        CREATE TRIGGER links_ai AFTER INSERT ON links BEGIN
          INSERT INTO links_fts(id, title, url, category, tags, notes, summary)
          VALUES (new.id, new.title, new.url, new.category, new.tags, new.notes, new.summary);
        END;
        CREATE TRIGGER links_ad AFTER DELETE ON links BEGIN DELETE FROM links_fts WHERE id = old.id; END;
        CREATE TRIGGER links_au AFTER UPDATE ON links BEGIN
          DELETE FROM links_fts WHERE id = old.id;
          INSERT INTO links_fts(id, title, url, category, tags, notes, summary)
          VALUES (new.id, new.title, new.url, new.category, new.tags, new.notes, new.summary);
        END;
        COMMIT;
      `);
    } catch (error) {
      if (this.db.inTransaction) this.db.exec('ROLLBACK');
      throw error;
    } finally {
      this.db.pragma('foreign_keys = ON');
    }

    // Safe FTS5 table migration & self-healing verification
    try {
      this.db.prepare('SELECT id, rank FROM links_fts WHERE links_fts MATCH ? LIMIT 1').all('test');
    } catch {
      console.warn('[DB] Migrating/rebuilding links_fts virtual table for optimal BM25 search...');
      try {
        this.db.exec(`
          DROP TRIGGER IF EXISTS links_ai;
          DROP TRIGGER IF EXISTS links_ad;
          DROP TRIGGER IF EXISTS links_au;
          DROP TABLE IF EXISTS links_fts;

          CREATE VIRTUAL TABLE links_fts USING fts5(
            id UNINDEXED,
            title,
            url,
            category,
            tags,
            notes,
            summary
          );

          CREATE TRIGGER links_ai AFTER INSERT ON links BEGIN
            INSERT INTO links_fts(id, title, url, category, tags, notes, summary)
            VALUES (new.id, new.title, new.url, new.category, new.tags, new.notes, new.summary);
          END;

          CREATE TRIGGER links_ad AFTER DELETE ON links BEGIN
            DELETE FROM links_fts WHERE id = old.id;
          END;

          CREATE TRIGGER links_au AFTER UPDATE ON links BEGIN
            DELETE FROM links_fts WHERE id = old.id;
            INSERT INTO links_fts(id, title, url, category, tags, notes, summary)
            VALUES (new.id, new.title, new.url, new.category, new.tags, new.notes, new.summary);
          END;

          INSERT INTO links_fts(id, title, url, category, tags, notes, summary)
          SELECT id, title, url, category, tags, notes, summary FROM links;
        `);
        console.log('[DB] links_fts virtual table rebuilt and synchronized successfully.');
      } catch (rebuildErr) {
        console.error('[DB] Failed to rebuild links_fts table:', rebuildErr);
      }
    }
  }

  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret, 'utf8').digest('hex');
  }

  private mapSessionRow(row: any): SessionRecord {
    return {
      id: row.id,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at || undefined,
      revokedAt: row.revoked_at || undefined,
    };
  }

  private mapServiceTokenRow(row: any): ServiceTokenRecord {
    let scopes: string[] = [];
    try {
      scopes = typeof row.scopes === 'string' ? JSON.parse(row.scopes) : row.scopes || [];
    } catch {
      scopes = [];
    }
    return {
      id: row.id,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      tokenPrefix: row.token_prefix,
      name: row.name,
      scopes,
      expiresAt: row.expires_at || undefined,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at || undefined,
      revokedAt: row.revoked_at || undefined,
    };
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
  private mapLinkToRow(link: LinkItem, workspaceId: string = LOCAL_WORKSPACE_ID) {
    return {
      id: link.id,
      workspace_id: workspaceId,
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
  count(workspaceId: string = LOCAL_WORKSPACE_ID): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM links WHERE workspace_id = ?').get(workspaceId) as { count: number };
    return row.count;
  }

  // Count unread links
  getUnreadCount(workspaceId: string = LOCAL_WORKSPACE_ID): number {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM links WHERE workspace_id = ? AND read_status = 'unread' AND is_archived = 0").get(workspaceId) as { count: number };
    return row.count;
  }

  // Count currently reading links
  getReadingCount(workspaceId: string = LOCAL_WORKSPACE_ID): number {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM links WHERE workspace_id = ? AND read_status = 'reading' AND is_archived = 0").get(workspaceId) as { count: number };
    return row.count;
  }

  // Count reviewed / read links
  getReadCount(workspaceId: string = LOCAL_WORKSPACE_ID): number {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM links WHERE workspace_id = ? AND read_status = 'read' AND is_archived = 0").get(workspaceId) as { count: number };
    return row.count;
  }

  // Get all links (ordered by created_at DESC)
  getAllLinks(workspaceId: string = LOCAL_WORKSPACE_ID): LinkItem[] {
    const rows = this.db.prepare('SELECT * FROM links WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId);
    return rows.map((r) => this.mapRowToLink(r));
  }

  // Get filtered links with optional criteria
  getFilteredLinks(options: {
    readStatus?: string;
    category?: string;
    platform?: string;
    tag?: string;
    onlyFavorites?: boolean;
    includeArchived?: boolean;
    limit?: number;
  } = {}, workspaceId: string = LOCAL_WORKSPACE_ID): LinkItem[] {
    const { readStatus, category, platform, tag, onlyFavorites, includeArchived, limit = 50 } = options;
    const conditions: string[] = ['workspace_id = ?'];
    const params: any[] = [workspaceId];

    if (!includeArchived) {
      conditions.push('is_archived = 0');
    }
    if (onlyFavorites) {
      conditions.push('is_favorite = 1');
    }
    if (readStatus && readStatus !== 'all') {
      conditions.push('read_status = ?');
      params.push(readStatus);
    }
    if (category && category !== 'all') {
      conditions.push('category = ?');
      params.push(category);
    }
    if (platform && platform !== 'all') {
      conditions.push('platform = ?');
      params.push(platform);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM links ${whereClause} ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params);
    let items = rows.map((r) => this.mapRowToLink(r));

    if (tag && tag !== 'all') {
      items = items.filter((item) => (item.tags || []).includes(tag));
    }

    return items;
  }

  // Get single link by ID
  getLinkById(id: string, workspaceId: string = LOCAL_WORKSPACE_ID): LinkItem | null {
    const row = this.db.prepare('SELECT * FROM links WHERE id = ? AND workspace_id = ?').get(id, workspaceId);
    if (!row) return null;
    return this.mapRowToLink(row);
  }

  // Get single link by URL
  getLinkByUrl(url: string, workspaceId: string = LOCAL_WORKSPACE_ID): LinkItem | null {
    const row = this.db.prepare('SELECT * FROM links WHERE url = ? AND workspace_id = ?').get(url, workspaceId);
    if (!row) return null;
    return this.mapRowToLink(row);
  }

  // Insert a single link
  insertLink(link: LinkItem, workspaceId: string = LOCAL_WORKSPACE_ID): LinkItem {
    const params = this.mapLinkToRow(link, workspaceId);
    const stmt = this.db.prepare(`
      INSERT INTO links (
        id, workspace_id, url, title, description, author, platform, category, tags,
        summary, ai_summary, thumbnail_url, favicon_url, notes,
        is_favorite, is_archived, read_status, reading_time_minutes, ai_score,
        feed_id, feed_title, is_rss_feed_item, reader_snapshot, created_at, updated_at
      ) VALUES (
        @id, @workspace_id, @url, @title, @description, @author, @platform, @category, @tags,
        @summary, @ai_summary, @thumbnail_url, @favicon_url, @notes,
        @is_favorite, @is_archived, @read_status, @reading_time_minutes, @ai_score,
        @feed_id, @feed_title, @is_rss_feed_item, @reader_snapshot, @created_at, @updated_at
      )
    `);
    stmt.run(params);
    return link;
  }

  // Update a single link
  updateLink(id: string, updates: Partial<LinkItem>, workspaceId: string = LOCAL_WORKSPACE_ID): LinkItem | null {
    const existing = this.getLinkById(id, workspaceId);
    if (!existing) return null;

    const merged: LinkItem = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const params = this.mapLinkToRow(merged, workspaceId);
    const stmt = this.db.prepare(`
      UPDATE links SET
        workspace_id = @workspace_id,
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
      WHERE id = @id AND workspace_id = @workspace_id
    `);
    stmt.run(params);
    return merged;
  }

  // Delete a single link
  deleteLink(id: string, workspaceId: string = LOCAL_WORKSPACE_ID): boolean {
    const info = this.db.prepare('DELETE FROM links WHERE id = ? AND workspace_id = ?').run(id, workspaceId);
    return info.changes > 0;
  }

  // Bulk Insert
  bulkInsert(links: LinkItem[], workspaceId: string = LOCAL_WORKSPACE_ID): number {
    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO links (
        id, workspace_id, url, title, description, author, platform, category, tags,
        summary, ai_summary, thumbnail_url, favicon_url, notes,
        is_favorite, is_archived, read_status, reading_time_minutes, ai_score,
        feed_id, feed_title, is_rss_feed_item, reader_snapshot, created_at, updated_at
      ) VALUES (
        @id, @workspace_id, @url, @title, @description, @author, @platform, @category, @tags,
        @summary, @ai_summary, @thumbnail_url, @favicon_url, @notes,
        @is_favorite, @is_archived, @read_status, @reading_time_minutes, @ai_score,
        @feed_id, @feed_title, @is_rss_feed_item, @reader_snapshot, @created_at, @updated_at
      )
    `);

    const insertMany = this.db.transaction((items: LinkItem[]) => {
      let count = 0;
      for (const item of items) {
        const info = insertStmt.run(this.mapLinkToRow(item, workspaceId));
        count += info.changes;
      }
      return count;
    });

    return insertMany(links);
  }

  // Batch mark read/status
  batchUpdate(ids: string[], updates: Partial<LinkItem>, workspaceId: string = LOCAL_WORKSPACE_ID): number {
    if (!ids || ids.length === 0) return 0;
    const now = new Date().toISOString();
    let updatedCount = 0;

    const tx = this.db.transaction(() => {
      for (const id of ids) {
        const item = this.getLinkById(id, workspaceId);
        if (item) {
          this.updateLink(id, updates, workspaceId);
          updatedCount++;
        }
      }
    });

    tx();
    return updatedCount;
  }

  // Batch delete
  batchDelete(ids: string[], workspaceId: string = LOCAL_WORKSPACE_ID): number {
    if (!ids || ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`DELETE FROM links WHERE workspace_id = ? AND id IN (${placeholders})`);
    const info = stmt.run(workspaceId, ...ids);
    return info.changes;
  }

  // Search FTS5 (Lexical BM25 ranking)
  searchFts(query: string, limit: number = 20, workspaceId: string = LOCAL_WORKSPACE_ID): Array<{ id: string; rank: number }> {
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
        SELECT links_fts.id, rank
        FROM links_fts
        INNER JOIN links ON links.id = links_fts.id
        WHERE links_fts MATCH ?
          AND links.workspace_id = ?
        ORDER BY rank
        LIMIT ?
      `);
      const rows = stmt.all(cleanQuery, workspaceId, limit) as Array<{ id: string; rank: number }>;
      return rows;
    } catch (err) {
      console.warn('FTS search fallback query error:', err);
      // Fallback LIKE query
      const likeQuery = `%${query.trim()}%`;
      const fallbackStmt = this.db.prepare(`
        SELECT id, -1.0 as rank
        FROM links
        WHERE workspace_id = ? AND (title LIKE ? OR url LIKE ? OR notes LIKE ? OR tags LIKE ?)
        LIMIT ?
      `);
      return fallbackStmt.all(workspaceId, likeQuery, likeQuery, likeQuery, likeQuery, limit) as Array<{ id: string; rank: number }>;
    }
  }

  // Vector Embedding Storage
  storeEmbedding(linkId: string, vector: number[], model: string, textChunk: string = '', workspaceId: string = LOCAL_WORKSPACE_ID): void {
    const link = this.db.prepare('SELECT 1 FROM links WHERE id = ? AND workspace_id = ?').get(linkId, workspaceId);
    if (!link) throw new Error(`Cannot store embedding for link outside workspace: ${workspaceId}`);
    const float32 = new Float32Array(vector);
    const buffer = Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO embeddings (link_id, workspace_id, dimensions, model, vector, text_chunk, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(linkId, workspaceId, vector.length, model, buffer, textChunk, new Date().toISOString());
  }

  // Get single vector embedding
  getEmbedding(linkId: string, workspaceId: string = LOCAL_WORKSPACE_ID): { linkId: string; dimensions: number; vector: Float32Array; model: string; textChunk?: string } | null {
    const row = this.db.prepare('SELECT * FROM embeddings WHERE link_id = ? AND workspace_id = ?').get(linkId, workspaceId) as any;
    if (!row) return null;

    const buf = row.vector as Buffer;
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const float32 = new Float32Array(arrayBuffer);

    return {
      linkId: row.link_id,
      dimensions: row.dimensions,
      vector: float32,
      model: row.model,
      textChunk: row.text_chunk || undefined,
    };
  }

  // Get all embeddings for semantic vector scan
  getAllEmbeddings(workspaceId: string = LOCAL_WORKSPACE_ID): Array<{ linkId: string; vector: Float32Array; model: string }> {
    const rows = this.db.prepare('SELECT link_id, vector, model FROM embeddings WHERE workspace_id = ?').all(workspaceId) as any[];
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
  getUnindexedLinkIds(workspaceId: string = LOCAL_WORKSPACE_ID): string[] {
    const rows = this.db.prepare(`
      SELECT l.id
      FROM links l
      LEFT JOIN embeddings e ON l.id = e.link_id
      WHERE e.link_id IS NULL AND l.workspace_id = ?
      ORDER BY l.created_at DESC
    `).all(workspaceId) as Array<{ id: string }>;

    return rows.map((r) => r.id);
  }

  // System Stats aggregation
  getStats(workspaceId: string = LOCAL_WORKSPACE_ID): SystemStats {
    const total = this.count(workspaceId);
    const unread = (this.db.prepare("SELECT COUNT(*) as c FROM links WHERE workspace_id = ? AND read_status = 'unread'").get(workspaceId) as any).c;
    const favorites = (this.db.prepare("SELECT COUNT(*) as c FROM links WHERE workspace_id = ? AND is_favorite = 1").get(workspaceId) as any).c;
    const archived = (this.db.prepare("SELECT COUNT(*) as c FROM links WHERE workspace_id = ? AND is_archived = 1").get(workspaceId) as any).c;

    const platformRows = this.db.prepare(`
      SELECT platform, COUNT(*) as count FROM links WHERE workspace_id = ? GROUP BY platform
    `).all(workspaceId) as Array<{ platform: string; count: number }>;
    const platformCounts: Record<string, number> = {};
    for (const r of platformRows) {
      platformCounts[r.platform] = r.count;
    }

    const categoryRows = this.db.prepare(`
      SELECT category, COUNT(*) as count FROM links WHERE workspace_id = ? GROUP BY category
    `).all(workspaceId) as Array<{ category: string; count: number }>;
    const categoriesBreakdown: Record<string, number> = {};
    for (const r of categoryRows) {
      categoriesBreakdown[r.category] = r.count;
    }

    const readStateCounts = {
      unread,
      reading: (this.db.prepare("SELECT COUNT(*) as c FROM links WHERE workspace_id = ? AND read_status = 'reading'").get(workspaceId) as any).c,
      read: (this.db.prepare("SELECT COUNT(*) as c FROM links WHERE workspace_id = ? AND read_status = 'read'").get(workspaceId) as any).c,
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
  migrateIfNeeded(seedLinks: LinkItem[] = [], workspaceId: string = LOCAL_WORKSPACE_ID): void {
    const count = this.count(workspaceId);
    if (count > 0) return;

    // Try reading repository.json first
    if (fs.existsSync(REPO_JSON_FILE)) {
      try {
        const raw = fs.readFileSync(REPO_JSON_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`[OmniLinkDB] Migrating ${parsed.length} bookmarks from repository.json into SQLite omnilink.db...`);
          this.bulkInsert(parsed, workspaceId);
          console.log(`[OmniLinkDB] Migration complete! Total links in DB: ${this.count(workspaceId)}`);
          return;
        }
      } catch (err) {
        console.warn('[OmniLinkDB] Error reading repository.json for migration:', err);
      }
    }

    // Fall back to seed links
    if (seedLinks.length > 0) {
      console.log(`[OmniLinkDB] Initializing database with ${seedLinks.length} seed links...`);
      this.bulkInsert(seedLinks, workspaceId);
      console.log(`[OmniLinkDB] Seed initialization complete! Total links: ${this.count(workspaceId)}`);
    }
  }

  // Export entire DB to JSON for backups or sync
  exportToJson(workspaceId: string = LOCAL_WORKSPACE_ID): LinkItem[] {
    return this.getAllLinks(workspaceId);
  }

  /** Ensure an application-resolved workspace exists before writing tenant rows. */
  ensureWorkspace(workspaceId: string, name: string = workspaceId): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO workspaces (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at
    `).run(workspaceId, name, now, now);
  }

  upsertUser(input: { id: string; issuer: string; subject: string; email?: string; name?: string }): UserRecord {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO users (id, issuer, subject, email, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(issuer, subject) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        updated_at = excluded.updated_at
    `).run(input.id, input.issuer, input.subject, input.email || null, input.name || null, now, now);
    const row = this.db.prepare('SELECT * FROM users WHERE issuer = ? AND subject = ?').get(input.issuer, input.subject) as any;
    return {
      id: row.id,
      issuer: row.issuer,
      subject: row.subject,
      email: row.email || undefined,
      name: row.name || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  upsertWorkspaceMembership(userId: string, workspaceId: string, role: WorkspaceRole): WorkspaceMembershipRecord {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO workspace_memberships (workspace_id, user_id, role, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = excluded.role
    `).run(workspaceId, userId, role, now);
    const row = this.db.prepare('SELECT * FROM workspace_memberships WHERE workspace_id = ? AND user_id = ?').get(workspaceId, userId) as any;
    return { workspaceId: row.workspace_id, userId: row.user_id, role: row.role, createdAt: row.created_at };
  }

  getWorkspaceMembership(userId: string, workspaceId: string): WorkspaceMembershipRecord | null {
    const row = this.db.prepare('SELECT * FROM workspace_memberships WHERE workspace_id = ? AND user_id = ?').get(workspaceId, userId) as any;
    return row ? { workspaceId: row.workspace_id, userId: row.user_id, role: row.role, createdAt: row.created_at } : null;
  }

  /** Resolve an OIDC identity and create its personal workspace atomically. */
  upsertOidcUser(input: { issuer: string; subject: string; email?: string; name?: string }): {
    user: UserRecord;
    membership: WorkspaceMembershipRecord;
  } {
    const now = new Date().toISOString();
    const existing = this.db.prepare('SELECT * FROM users WHERE issuer = ? AND subject = ?').get(input.issuer, input.subject) as any;
    const userId = existing?.id || `usr_${createHash('sha256').update(`${input.issuer}\0${input.subject}`).digest('hex').slice(0, 32)}`;
    const workspaceId = `ws_${createHash('sha256').update(userId).digest('hex').slice(0, 32)}`;
    const displayName = input.name?.trim() || input.email?.trim() || 'Personal workspace';
    const tx = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO users (id, issuer, subject, email, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(issuer, subject) DO UPDATE SET
          email = excluded.email, name = excluded.name, updated_at = excluded.updated_at
      `).run(userId, input.issuer, input.subject, input.email || null, input.name || null, now, now);
      this.db.prepare(`
        INSERT OR IGNORE INTO workspaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)
      `).run(workspaceId, `${displayName}'s workspace`, now, now);
      this.db.prepare(`
        INSERT OR IGNORE INTO workspace_memberships (workspace_id, user_id, role, created_at)
        VALUES (?, ?, 'owner', ?)
      `).run(workspaceId, userId, now);
    });
    tx();
    const userRow = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    return {
      user: {
        id: userRow.id,
        issuer: userRow.issuer,
        subject: userRow.subject,
        email: userRow.email || undefined,
        name: userRow.name || undefined,
        createdAt: userRow.created_at,
        updatedAt: userRow.updated_at,
      },
      membership: { workspaceId, userId, role: 'owner', createdAt: now },
    };
  }

  getMembership(userId: string, workspaceId: string): WorkspaceMembershipRecord | null {
    const row = this.db.prepare(`
      SELECT workspace_id, user_id, role, created_at
      FROM workspace_memberships WHERE user_id = ? AND workspace_id = ?
    `).get(userId, workspaceId) as any;
    return row ? { workspaceId: row.workspace_id, userId: row.user_id, role: row.role, createdAt: row.created_at } : null;
  }

  createOidcTransaction(input: { state: string; nonce: string; codeVerifier: string; redirectAfter?: string; expiresAt: string }): void {
    const stateHash = this.hashSecret(input.state);
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM oidc_transactions WHERE expires_at <= ?').run(now);
      // Bound unauthenticated login fan-out so repeated /auth/login requests
      // cannot grow the transaction table without limit.
      this.db.prepare(`
        DELETE FROM oidc_transactions WHERE state_hash IN (
          SELECT state_hash FROM oidc_transactions ORDER BY created_at ASC LIMIT 1
        ) AND (SELECT COUNT(*) FROM oidc_transactions) >= 1000
      `).run();
      this.db.prepare(`
        INSERT INTO oidc_transactions (state_hash, nonce, code_verifier, redirect_after, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(stateHash, input.nonce, input.codeVerifier, input.redirectAfter || '/', input.expiresAt, now);
    });
    tx();
  }

  consumeOidcTransaction(state: string): OidcTransactionRecord | null {
    if (!state) return null;
    const stateHash = this.hashSecret(state);
    const tx = this.db.transaction(() => {
      const row = this.db.prepare('SELECT * FROM oidc_transactions WHERE state_hash = ? AND expires_at > ?').get(stateHash, new Date().toISOString()) as any;
      this.db.prepare('DELETE FROM oidc_transactions WHERE state_hash = ?').run(stateHash);
      return row;
    });
    const row = tx();
    return row ? {
      stateHash: row.state_hash,
      nonce: row.nonce,
      codeVerifier: row.code_verifier,
      redirectAfter: row.redirect_after,
      expiresAt: row.expires_at,
    } : null;
  }

  /**
   * Persist a server-side session. Callers pass the opaque cookie value; only
   * its SHA-256 digest is stored so a database disclosure cannot replay it.
   */
  createSession(input: {
    sessionId?: string;
    userId: string;
    workspaceId: string;
    expiresAt: string;
  }): { sessionId: string; record: SessionRecord } {
    const sessionId = input.sessionId || randomBytes(32).toString('base64url');
    if (sessionId.length < 32) throw new Error('Session ID must contain at least 32 characters');
    const now = new Date().toISOString();
    const id = this.hashSecret(sessionId);
    this.db.prepare(`
      INSERT INTO sessions (id, user_id, workspace_id, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, input.userId, input.workspaceId, input.expiresAt, now);
    return {
      sessionId,
      record: {
        id,
        userId: input.userId,
        workspaceId: input.workspaceId,
        expiresAt: input.expiresAt,
        createdAt: now,
      },
    };
  }

  /** Resolve a session only while it is active and unexpired. */
  getSession(sessionId: string, workspaceId?: string): SessionRecord | null {
    if (!sessionId) return null;
    const query = workspaceId
      ? 'SELECT * FROM sessions WHERE id = ? AND workspace_id = ? AND revoked_at IS NULL AND expires_at > ?'
      : 'SELECT * FROM sessions WHERE id = ? AND revoked_at IS NULL AND expires_at > ?';
    const row = workspaceId
      ? this.db.prepare(query).get(this.hashSecret(sessionId), workspaceId, new Date().toISOString())
      : this.db.prepare(query).get(this.hashSecret(sessionId), new Date().toISOString());
    return row ? this.mapSessionRow(row) : null;
  }

  touchSession(sessionId: string, workspaceId?: string): boolean {
    if (!sessionId) return false;
    const now = new Date().toISOString();
    const query = workspaceId
      ? 'UPDATE sessions SET last_used_at = ? WHERE id = ? AND workspace_id = ? AND revoked_at IS NULL AND expires_at > ?'
      : 'UPDATE sessions SET last_used_at = ? WHERE id = ? AND revoked_at IS NULL AND expires_at > ?';
    const info = workspaceId
      ? this.db.prepare(query).run(now, this.hashSecret(sessionId), workspaceId, now)
      : this.db.prepare(query).run(now, this.hashSecret(sessionId), now);
    return info.changes > 0;
  }

  revokeSession(sessionId: string, workspaceId?: string): boolean {
    if (!sessionId) return false;
    const query = workspaceId
      ? 'UPDATE sessions SET revoked_at = ? WHERE id = ? AND workspace_id = ? AND revoked_at IS NULL'
      : 'UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL';
    const now = new Date().toISOString();
    const info = workspaceId
      ? this.db.prepare(query).run(now, this.hashSecret(sessionId), workspaceId)
      : this.db.prepare(query).run(now, this.hashSecret(sessionId));
    return info.changes > 0;
  }

  /**
   * Create a revocable workspace-scoped bearer token. The raw value is
   * returned once and is never included in any subsequent record/list call.
   */
  createServiceToken(input: {
    id?: string;
    token?: string;
    userId: string;
    workspaceId: string;
    name: string;
    scopes: string[];
    expiresAt?: string;
  }): CreatedServiceToken {
    const token = input.token || `olst_${randomBytes(32).toString('base64url')}`;
    if (token.length < 32) throw new Error('Service token must contain at least 32 characters');
    if (!input.name.trim()) throw new Error('Service token name is required');
    const id = input.id || `svc_${randomUUID()}`;
    const now = new Date().toISOString();
    const expiresAt = input.expiresAt || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const tokenPrefix = token.slice(0, 12);
    this.db.prepare(`
      INSERT INTO service_tokens
        (id, user_id, workspace_id, token_hash, token_prefix, name, scopes, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.userId, input.workspaceId, this.hashSecret(token), tokenPrefix, input.name.trim(), JSON.stringify([...new Set(input.scopes)]), expiresAt, now);
    return {
      token,
      id,
      userId: input.userId,
      workspaceId: input.workspaceId,
      tokenPrefix,
      name: input.name.trim(),
      scopes: [...new Set(input.scopes)],
      expiresAt,
      createdAt: now,
    };
  }

  /** Resolve an active token and optionally require one explicit scope. */
  getServiceToken(token: string, requiredScope?: string, workspaceId?: string): ServiceTokenRecord | null {
    if (!token) return null;
    const query = workspaceId
      ? 'SELECT * FROM service_tokens WHERE token_hash = ? AND workspace_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)'
      : 'SELECT * FROM service_tokens WHERE token_hash = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)';
    const row = workspaceId
      ? this.db.prepare(query).get(this.hashSecret(token), workspaceId, new Date().toISOString())
      : this.db.prepare(query).get(this.hashSecret(token), new Date().toISOString());
    if (!row) return null;
    const record = this.mapServiceTokenRow(row);
    if (requiredScope && !record.scopes.includes(requiredScope)) return null;
    this.db.prepare('UPDATE service_tokens SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), record.id);
    return { ...record, lastUsedAt: new Date().toISOString() };
  }

  listServiceTokens(userId: string, workspaceId: string): ServiceTokenRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM service_tokens WHERE user_id = ? AND workspace_id = ? ORDER BY created_at DESC
    `).all(userId, workspaceId) as any[];
    return rows.map((row) => this.mapServiceTokenRow(row));
  }

  revokeServiceToken(id: string, userId: string, workspaceId: string): boolean {
    const info = this.db.prepare(`
      UPDATE service_tokens SET revoked_at = ?
      WHERE id = ? AND user_id = ? AND workspace_id = ? AND revoked_at IS NULL
    `).run(new Date().toISOString(), id, userId, workspaceId);
    return info.changes > 0;
  }

  recordAiUsage(input: Omit<AiUsageRecord, 'createdAt'> & { createdAt?: string }): AiUsageRecord {
    const record: AiUsageRecord = { ...input, createdAt: input.createdAt || new Date().toISOString() };
    this.db.prepare(`
      INSERT INTO ai_usage
        (id, actor_id, workspace_id, operation, model, source, request_id, input_tokens, output_tokens, weighted_units, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(record.id, record.actorId, record.workspaceId, record.operation, record.model, record.source, record.requestId || null, record.inputTokens, record.outputTokens, record.weightedUnits, record.status, record.createdAt);
    return record;
  }

  tryReserveAiUsage(input: Omit<AiUsageRecord, 'createdAt' | 'status'>, quotaUnits: number): AiUsageRecord | null {
    const tx = this.db.transaction(() => {
      const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
      // Include active reservations when admitting concurrent requests, but do
      // not treat failed attempts as consumed quota in the user-facing total.
      const used = this.getAiUsageCommittedTotal(input.workspaceId, since);
      if (used + input.weightedUnits > quotaUnits) return null;
      return this.recordAiUsage({ ...input, status: 'reserved' });
    });
    return tx();
  }

  recordAiUsageReplacingReservation(
    reservationId: string | undefined,
    input: Omit<AiUsageRecord, 'createdAt'> & { createdAt?: string },
  ): AiUsageRecord {
    const tx = this.db.transaction(() => {
      if (reservationId) {
        this.db.prepare("UPDATE ai_usage SET weighted_units = 0, status = 'released' WHERE id = ? AND status = 'reserved'").run(reservationId);
      }
      return this.recordAiUsage(input);
    });
    return tx();
  }

  releaseAiUsageReservation(reservationId: string): void {
    this.db.prepare("UPDATE ai_usage SET weighted_units = 0, status = 'released' WHERE id = ? AND status = 'reserved'").run(reservationId);
  }

  getAiUsage(workspaceId: string, since?: string): AiUsageRecord[] {
    const rows = since
      ? this.db.prepare('SELECT * FROM ai_usage WHERE workspace_id = ? AND created_at >= ? ORDER BY created_at DESC').all(workspaceId, since)
      : this.db.prepare('SELECT * FROM ai_usage WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId);
    return (rows as any[]).map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      workspaceId: row.workspace_id,
      operation: row.operation,
      model: row.model,
      source: row.source,
      requestId: row.request_id || undefined,
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
      weightedUnits: Number(row.weighted_units),
      status: row.status,
      createdAt: row.created_at,
    }));
  }

  getAiUsageTotal(workspaceId: string, since: string): number {
    const row = this.db.prepare(`
      SELECT COALESCE(SUM(weighted_units), 0) AS total
      FROM ai_usage WHERE workspace_id = ? AND created_at >= ? AND status = 'completed'
    `).get(workspaceId, since) as { total: number };
    return Number(row.total) || 0;
  }

  /**
   * Quota-admission total. Active reservations protect against concurrent
   * oversubscription; failed and released attempts are retained for audit but
   * do not consume the monthly allowance.
   */
  getAiUsageCommittedTotal(workspaceId: string, since: string): number {
    const row = this.db.prepare(`
      SELECT COALESCE(SUM(weighted_units), 0) AS total
      FROM ai_usage
      WHERE workspace_id = ? AND created_at >= ? AND status IN ('completed', 'reserved')
    `).get(workspaceId, since) as { total: number };
    return Number(row.total) || 0;
  }

  /** Close an isolated/test database connection. */
  close(): void {
    if (this.db.open) this.db.close();
  }
}

// Global Singleton Instance
export const omniDb = new OmniLinkDB();
