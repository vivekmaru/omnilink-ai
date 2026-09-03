# OmniLink AI - Architecture & Technical Specification

## 1. System Overview

OmniLink AI is built on a high-leverage full-stack architecture combining a high-performance **SQLite (WAL mode)** database, an **FTS5 BM25 + Gemini Dense Vector Embeddings + RRF Hybrid Search Engine**, a **Model Context Protocol (MCP) Server**, an **Offline Readability Archiver**, and an **offline-first React 19 + TypeScript frontend** engineered with a refined **Linear × Raycast × Arc** developer aesthetic.

```
+---------------------------------------------------------------------------------------------------------+
|                                              INGRESS & CLIENT SURFACES                                  |
|  +-----------------------+  +------------------------+  +----------------------+  +-------------------+ |
|  | Linear/Raycast Web UI |  | Chrome Extension (V3)  |  | Mobile Share Target  |  | Model Context     | |
|  | - 3-Col Card Grid     |  | - 1-Click Popup Saver  |  | - PWA Native Sheet   |  |   Protocol (MCP)   | |
|  | - Kanban & Clusters   |  | - Side Panel Dashboard |  | - Apple Shortcuts    |  | - Claude Desktop  | |
|  | - Offline Reader Mode |  | - Omnibox ('ol <q>')   |  | - Webhook Ingress    |  | - Cursor / Agents | |
|  | - Keyboard Nav (⌘K)   |  | - Context Menu Saving  |  | - QR Mobile Connect  |  | - STDIO Transport | |
|  +-----------+-----------+  +-----------+------------+  +----------+-----------+  +---------+---------+ |
|              |                          |                          |                        |           |
+--------------|--------------------------|--------------------------|------------------------|-----------+
               |                          |                          |                        |
               v                          v                          v                        v
+---------------------------------------------------------------------------------------------------------+
|                                              SERVER & API LAYER                                         |
|  +---------------------------------------------------------------------------------------------------+  |
|  | Express Application (server.ts) & MCP Server (server/mcpServer.ts)                                 |  |
|  | - Zod Request Validation Middleware & Global Error Boundaries (validators.ts)                     |  |
|  | - REST CRUD & Batch Transaction Handlers (/api/links, /api/links/batch)                           |  |
|  | - Rapid Ingress Webhook (/api/share/quick) for Shortcuts, Bots, and Raycast                       |  |
|  | - Mozilla Readability Extraction & Markdown Archiving (/api/links/:id/reader)                     |  |
|  | - Multi-Tier Gemini Model Orchestration & Heuristic Fallbacks (modelOrchestrator.ts)              |  |
|  | - RSS / Atom Feed Poller & Discovery Engine (/api/rss/*)                                          |  |
|  | - MCP Tool Dispatcher (search_repository, save_bookmark, get_article_snapshot, ask_repository)     |  |
|  +-------------------------------------------------+-------------------------------------------------+  |
+----------------------------------------------------|----------------------------------------------------+
                                                     |
                                                     v
+---------------------------------------------------------------------------------------------------------+
|                                    STORAGE & HYBRID RETRIEVAL ENGINE                                    |
|  +---------------------------------------------------------------------------------------------------+  |
|  | SQLite 3 Database (data/omnilink.db with PRAGMA journal_mode = WAL & NORMAL synchronous)          |  |
|  |                                                                                                   |  |
|  |  [ Primary Table: links ]              [ FTS5 Index: links_fts ]         [ Embeddings: embeddings ]|  |
|  |  • id, url, title, notes,              • Porter stemmer tokenizer        • 768-dim Float32 BLOB    |  |
|  |    summary, category, tags,            • Indexed: title, url, tags,      • Gemini text-embedding   |  |
|  |    read_status, reader_snapshot          notes, summary, category        • Cosine Similarity Calc  |  |
|  |                                                                                                   |  |
|  |  [ Synchronization Triggers: links_ai, links_ad, links_au ]                                       |  |
|  |  • Automatically mirror INSERT, UPDATE, and DELETE operations to FTS5 virtual table               |  |
|  +-------------------------------------------------+-------------------------------------------------+  |
|                                                    |                                                    |
|                                                    v                                                    |
|  +---------------------------------------------------------------------------------------------------+  |
|  | Reciprocal Rank Fusion (RRF) Engine:  Score(d) = 1/(60 + Rank_FTS(d)) + 1/(60 + Rank_Vector(d))    |  |
|  +---------------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------------+
```

---

## 2. SQLite WAL & Hybrid Search Engine Specification

### Database Schema (`server/db.ts`)

```sql
-- 1. Main Links Table
CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  author TEXT,
  platform TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT NOT NULL,                  -- JSON Array
  summary TEXT NOT NULL,               -- JSON Object { tldr, keyTakeaways, ... }
  ai_summary TEXT,                     -- JSON Object
  thumbnail_url TEXT,
  favicon_url TEXT,
  notes TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  read_status TEXT NOT NULL DEFAULT 'unread',
  reading_time_minutes INTEGER DEFAULT 3,
  ai_score INTEGER DEFAULT 85,
  feed_id TEXT,
  feed_title TEXT,
  is_rss_feed_item INTEGER DEFAULT 0,
  reader_snapshot TEXT,                -- JSON Object { title, excerpt, contentMarkdown, ... }
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. FTS5 Virtual Table for Lexical BM25 Search
CREATE VIRTUAL TABLE IF NOT EXISTS links_fts USING fts5(
  id UNINDEXED,
  title,
  url,
  category,
  tags,
  notes,
  summary,
  content='links',
  content_rowid='rowid'
);

-- 3. Automatic Triggers for FTS5 Synchronization
CREATE TRIGGER IF NOT EXISTS links_ai AFTER INSERT ON links BEGIN
  INSERT INTO links_fts(rowid, id, title, url, category, tags, notes, summary)
  VALUES (new.rowid, new.id, new.title, new.url, new.category, new.tags, new.notes, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS links_ad AFTER DELETE ON links BEGIN
  INSERT INTO links_fts(links_fts, rowid, id, title, url, category, tags, notes, summary)
  VALUES('delete', old.rowid, old.id, old.title, old.url, old.category, old.tags, old.notes, old.summary);
END;

CREATE TRIGGER IF NOT EXISTS links_au AFTER UPDATE ON links BEGIN
  INSERT INTO links_fts(links_fts, rowid, id, title, url, category, tags, notes, summary)
  VALUES('delete', old.rowid, old.id, old.title, old.url, old.category, old.tags, old.notes, old.summary);
  INSERT INTO links_fts(rowid, id, title, url, category, tags, notes, summary)
  VALUES (new.rowid, new.id, new.title, new.url, new.category, new.tags, new.notes, new.summary);
END;

-- 4. Dense Vector Embeddings Table
CREATE TABLE IF NOT EXISTS embeddings (
  link_id TEXT PRIMARY KEY,
  vector BLOB NOT NULL,                -- 768 Float32 numbers (3072 bytes)
  dimensions INTEGER NOT NULL,
  model TEXT NOT NULL,                 -- 'gemini-embedding-001' or fallback 'term-hash-v1'
  indexed_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(link_id) REFERENCES links(id) ON DELETE CASCADE
);
```

### Hybrid Retrieval & Reciprocal Rank Fusion Algorithm

> For an in-depth breakdown of Generative LLMs vs Embedding Models vs `term-hash-v1`, see [docs/HYBRID_SEARCH_AND_EMBEDDINGS.md](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/docs/HYBRID_SEARCH_AND_EMBEDDINGS.md).

1. **Step 1 (Lexical FTS5 Retrieval)**:
   Executes BM25 query over `links_fts` virtual table, yielding a ranked candidate list:
   $$\text{FTS Candidates} = [(\text{id}_1, \text{rank}_1), (\text{id}_2, \text{rank}_2), \dots]$$

2. **Step 2 (Semantic Vector Retrieval)**:
   Generates a 768-dimensional normalized query embedding $\vec{q}$ via `gemini-embedding-001` with Matryoshka Representation Learning (`outputDimensionality: 768`) (or offline deterministic `term-hash-v1` vector). Computes Cosine Similarity against all cached bookmark embeddings:
   $$\text{Sim}(\vec{q}, \vec{v}_i) = \frac{\vec{q} \cdot \vec{v}_i}{\|\vec{q}\|_2 \|\vec{v}_i\|_2}$$
   Sorts candidates by similarity $\ge 0.1$ and ranks top matches: $[(\text{id}_1, \text{rank}_1), (\text{id}_2, \text{rank}_2), \dots]$.

3. **Step 3 (Reciprocal Rank Fusion)**:
   Combines ranks across both retrieval sets with smoothing constant $K = 60$:
   $$\text{RRF}(d) = \left(\frac{1}{60 + \text{rank}_{\text{FTS}}(d)}\right) + \left(\frac{1}{60 + \text{rank}_{\text{Vector}}(d)}\right)$$
   Candidates matching both lexical tokens and semantic concepts achieve the highest combined rank score ($>0.032$).

---

## 3. Model Context Protocol (MCP) Server Architecture

The OmniLink MCP Server (`server/mcpServer.ts`) runs on **STDIO** transport using `@modelcontextprotocol/sdk`.

### Tools & Signatures
- **`search_repository`**: `(query: string, category?: string, platform?: string, readStatus?: string, limit?: number)` &rarr; Hybrid search results.
- **`save_bookmark`**: `(url: string, title?: string, notes?: string, tags?: string[], category?: string)` &rarr; Inserts link, triggers background indexing & snapshot.
- **`get_article_snapshot`**: `(id_or_url: string)` &rarr; Returns full-text Markdown reader snapshot.
- **`ask_repository`**: `(question: string, category?: string)` &rarr; Grounded RAG answer with verified citations.
- **`list_recent_bookmarks`**: `(limit?: number, readStatus?: string, category?: string)` &rarr; Filtered bookmark list.
- **`get_repository_stats`**: `()` &rarr; Total bookmarks, unread count, vector index status.

---

## 4. Mobile & Extension Ecosystem Architecture

### PWA Web Share Target
Configured in `public/manifest.json`:
```json
{
  "share_target": {
    "action": "/",
    "method": "GET",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url"
    }
  }
}
```
`src/App.tsx` and `src/utils/url.ts` automatically parse query strings and extract embedded URLs from the `text` parameter (handling mobile sharing quirks from YouTube, Reddit, and Twitter/X).

### Chrome Extension (Manifest V3)
Located in [`extension/`](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/extension):
- `background.js`: Handles right-click context menus (`chrome.contextMenus`) and Omnibox search keyword `ol <query>` (`chrome.omnibox`).
- `sidepanel.html` & `sidepanel.js`: Native Chrome Side Panel dashboard (`chrome.sidePanel`).
- `popup.html` & `popup.js`: Active tab reader and real-time category/tag heuristic suggestions.

---

## 5. Security & Error Handling Architecture

1. **Zod Schema Validation (`server/validators.ts`)**:
   - Strict runtime schema validation across `CreateLinkSchema`, `UpdateLinkSchema`, `BatchActionSchema`, `MergeLinkSchema`, `AskRepoSchema`, `HybridSearchSchema`, and `AddRssFeedSchema`.
   - Rejects invalid payloads with structured 400 JSON issues.
2. **HTML Sanitization**:
   - `sanitize-html` scrubs malicious `<script>`, `<iframe>`, and event handler injections from RSS feed content and user inputs.
3. **AES-GCM Web Crypto Implementation**:
   - `PBKDF2` key derivation with `SHA-256` and 100,000 iterations + 16-byte random salt.
   - `AES-GCM` 256-bit encryption with unique 12-byte initialization vector (`IV`).
   - Zero-knowledge client-side encryption; keys are never transmitted to the backend.
