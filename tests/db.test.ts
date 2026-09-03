import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LOCAL_WORKSPACE_ID, OmniLinkDB } from '../server/db';
import type { LinkItem } from '../src/types';

const handles: Array<{ db: OmniLinkDB; dir: string }> = [];

function makeLink(id: string, url = `https://example.test/${id}`): LinkItem {
  const now = new Date().toISOString();
  return {
    id,
    url,
    title: `Link ${id}`,
    platform: 'other',
    category: 'Other',
    tags: ['tenant-test'],
    summary: { tldr: `Summary ${id}` },
    isFavorite: false,
    isArchived: false,
    readStatus: 'unread',
    createdAt: now,
    updatedAt: now,
  };
}

function openTempDb(): OmniLinkDB {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnilink-db-'));
  const db = new OmniLinkDB(path.join(dir, 'test.db'));
  handles.push({ db, dir });
  return db;
}

afterEach(() => {
  for (const { db, dir } of handles.splice(0)) {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('tenant-scoped SQLite persistence', () => {
  it('isolates links, embeddings, search, and stats by workspace', () => {
    const db = openTempDb();
    db.ensureWorkspace('workspace-a', 'Workspace A');
    db.ensureWorkspace('workspace-b', 'Workspace B');

    // The same URL is valid in separate workspaces, but not twice in one.
    db.insertLink(makeLink('a-link', 'https://example.test/shared'), 'workspace-a');
    db.insertLink(makeLink('b-link', 'https://example.test/shared'), 'workspace-b');

    expect(db.count('workspace-a')).toBe(1);
    expect(db.count('workspace-b')).toBe(1);
    expect(db.getLinkByUrl('https://example.test/shared', 'workspace-a')?.id).toBe('a-link');
    expect(db.getLinkByUrl('https://example.test/shared', 'workspace-b')?.id).toBe('b-link');
    expect(db.getLinkById('a-link', 'workspace-b')).toBeNull();
    expect(db.getAllLinks('workspace-a').map((link) => link.id)).toEqual(['a-link']);

    db.storeEmbedding('a-link', [1, 0, 0], 'test-model', 'A', 'workspace-a');
    db.storeEmbedding('b-link', [0, 1, 0], 'test-model', 'B', 'workspace-b');
    expect(db.getAllEmbeddings('workspace-a').map((embedding) => embedding.linkId)).toEqual(['a-link']);
    expect(db.getEmbedding('b-link', 'workspace-a')).toBeNull();
    expect(db.getUnindexedLinkIds('workspace-a')).toEqual([]);

    expect(db.searchFts('Link', 10, 'workspace-a').map((match) => match.id)).toEqual(['a-link']);
    expect(db.getStats('workspace-a')).toMatchObject({ totalLinks: 1, unreadCount: 1 });
    expect(db.getStats('workspace-b')).toMatchObject({ totalLinks: 1, unreadCount: 1 });
  });

  it('backfills legacy rows into local-default during schema migration', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnilink-legacy-'));
    const filename = path.join(dir, 'legacy.db');
    const legacy = new Database(filename);
    legacy.exec(`
      CREATE TABLE links (
        id TEXT PRIMARY KEY,
        url TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        author TEXT,
        platform TEXT NOT NULL,
        category TEXT NOT NULL,
        tags TEXT NOT NULL,
        summary TEXT NOT NULL,
        ai_summary TEXT,
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
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    legacy.prepare(`
      INSERT INTO links (id, url, title, platform, category, tags, summary, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('legacy-link', 'https://legacy.test', 'Legacy', 'other', 'Other', '[]', '{"tldr":"Legacy"}', '2026-01-01', '2026-01-01');
    legacy.close();

    const db = new OmniLinkDB(filename);
    handles.push({ db, dir });
    expect(db.getLinkById('legacy-link', LOCAL_WORKSPACE_ID)?.title).toBe('Legacy');
    expect(db.count('some-other-workspace')).toBe(0);
    expect(db.getAllLinks(LOCAL_WORKSPACE_ID)).toHaveLength(1);
    db.ensureWorkspace('workspace-after-migration');
    expect(() => db.insertLink(makeLink('tenant-copy', 'https://legacy.test'), 'workspace-after-migration')).not.toThrow();
    expect(db.count('workspace-after-migration')).toBe(1);
  });

  it('persists hashed sessions and revocable workspace-scoped service tokens', () => {
    const db = openTempDb();
    const identity = db.upsertOidcUser({
      issuer: 'https://identity.example.test',
      subject: 'subject-1',
      email: 'person@example.test',
    });
    const session = db.createSession({
      userId: identity.user.id,
      workspaceId: identity.membership.workspaceId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(session.record.id).not.toBe(session.sessionId);
    expect(db.getSession(session.sessionId)?.workspaceId).toBe(identity.membership.workspaceId);
    expect(db.revokeSession(session.sessionId)).toBe(true);
    expect(db.getSession(session.sessionId)).toBeNull();

    const token = db.createServiceToken({
      userId: identity.user.id,
      workspaceId: identity.membership.workspaceId,
      name: 'Extension',
      scopes: ['repository:read'],
    });
    expect(token.token).toMatch(/^olst_/);
    expect(db.getServiceToken(token.token, 'repository:read')?.workspaceId).toBe(identity.membership.workspaceId);
    expect(db.getServiceToken(token.token, 'repository:write')).toBeNull();
    expect(db.listServiceTokens(identity.user.id, identity.membership.workspaceId)[0]).not.toHaveProperty('token');
    expect(db.revokeServiceToken(token.id, identity.user.id, identity.membership.workspaceId)).toBe(true);
    expect(db.getServiceToken(token.token)).toBeNull();
  });

  it('consumes each OIDC state transaction once', () => {
    const db = openTempDb();
    db.createOidcTransaction({
      state: 'state-value',
      nonce: 'nonce-value',
      codeVerifier: 'verifier-value',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(db.consumeOidcTransaction('wrong')).toBeNull();
    expect(db.consumeOidcTransaction('state-value')).toMatchObject({ nonce: 'nonce-value', codeVerifier: 'verifier-value' });
    expect(db.consumeOidcTransaction('state-value')).toBeNull();
  });
});
