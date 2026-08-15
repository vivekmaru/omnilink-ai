# Product Requirements Document (PRD) - OmniLink AI

## 1. Project Overview & Vision
**OmniLink AI** is an intelligent, searchable personal link repository, knowledge base, and agentic context hub designed for developers, researchers, and power users who curate knowledge across diverse platforms (GitHub repositories, ArXiv & academic papers, Reddit discussions & comments, Instagram Reels, YouTube, X/Twitter, and engineering blogs).

Pairing the refined aesthetic of **Linear × Raycast × Arc** with a native **SQLite WAL + FTS5 BM25 + Gemini Dense Vector Embeddings + Reciprocal Rank Fusion (RRF) Hybrid Search Engine**, OmniLink AI transforms raw URLs into structured, queryable, and distraction-free knowledge accessible via **Web UI**, **Chrome Extension with Omnibox**, **iOS/Android Share Target & Shortcuts**, and **Model Context Protocol (MCP)** for Claude Desktop and AI coding assistants.

---

## 2. Target Archetypes & User Personas
- **Developers & Systems Engineers**: Curating GitHub repositories, technical architecture blogs, and code snippets with automatic syntax extraction, Omnibox address bar search, and instant keyboard triage.
- **Researchers & AI Practitioners**: Tracking arXiv papers, technical whitepapers, and prompt benchmarks with AI TL;DR synthesis, full offline Readability snapshots, and MCP agent search.
- **Power Curators & Mobile Readers**: Saving Reddit discussions, Instagram reels, and YouTube tutorials directly from the mobile Share Sheet via PWA Web Share Target or Apple Shortcuts into an organized inbox.

---

## 3. Core Functional Requirements

### 3.1. Hybrid Search & Vector Retrieval Engine
- **SQLite WAL Architecture**: Native SQLite database running with `PRAGMA journal_mode = WAL` and synchronous writes for ACID durability and sub-millisecond query execution.
- **FTS5 Lexical Search**: Virtual table indexed with Porter stemmer across `title`, `url`, `category`, `tags`, `notes`, and `summary` with automated SQLite synchronization triggers (`links_ai`, `links_ad`, `links_au`).
- **Dense Vector Embeddings**: 768-dimensional float32 vector embeddings generated via Gemini `text-embedding-004` (with offline hash vector fallback).
- **Reciprocal Rank Fusion (RRF)**: Merges lexical and semantic candidate ranks with formula:
  $$\text{RRF}(d) = \frac{1}{60 + \text{rank}_{\text{FTS}}(d)} + \frac{1}{60 + \text{rank}_{\text{Vector}}(d)}$$
- **Background Worker**: Automatically indexes vector embeddings for newly saved links in non-blocking batches.

### 3.2. Full-Page Readability & Offline Reader Mode
- **DOM Parsing & Sanitization**: Mozilla `@mozilla/readability` + `JSDOM` extracts clean article bodies, stripping tracking scripts, cookie banners, and ads.
- **Markdown Conversion**: Uses `turndown` to generate clean GitHub Flavored Markdown cached directly in SQLite (`reader_snapshot`).
- **Distraction-Free Reader View**: In-app reading modal with serif typography, word counts, reading time estimates, and 1-click Markdown copy.

### 3.3. Model Context Protocol (MCP) Server
- **STDIO Transport (`server/mcpServer.ts`)**: Built with `@modelcontextprotocol/sdk` to allow Claude Desktop, Cursor, Antigravity, and AI Agents to query and save knowledge.
- **Exposed Tools**: `search_repository`, `save_bookmark`, `get_article_snapshot`, `ask_repository`, `list_recent_bookmarks`, `get_repository_stats`.
- **Exposed Resources**: `omnilink://library/stats`, `omnilink://library/unread`.

### 3.4. Mobile Ingress & Apple Shortcuts Hub
- **W3C Web Share Target API**: PWA manifest (`manifest.json`) and Service Worker (`sw.js`) enable native iOS and Android Share Sheet integration.
- **Fast Ingress Webhook (`POST /api/share/quick`)**: Headless 1-tap capture endpoint for Apple Shortcuts, Raycast, and Telegram/Discord bots.
- **Multi-Surface Ingress Hub**: Interactive UI with QR code mobile connection, step-by-step Apple Shortcut creator, and test runners.

### 3.5. Production Chrome Extension (Manifest V3)
- **Omnibox Address Bar Search (`ol <keyword>`)**: Type `ol` in Chrome's URL bar to search your OmniLink library and press Enter to navigate directly.
- **Chrome Native Side Panel**: Embedded companion panel with instant search, recent feed, and 1-click **"+ Save Current Tab"** action.
- **Context Menus**: Right-click to save pages, links, or highlighted excerpts.

### 3.6. Knowledge Views & Workflows
- **Card Grid View**: 3-column cards with source badges, insight chips, quiet tags, and hover actions.
- **Compact List View**: High-density engineering table for rapid batch triage.
- **Kanban Board**: Drag-and-drop workflow across Unread, Reading, and Reviewed lanes.
- **Semantic Topic Clusters**: Automatic semantic clustering powered by vector embeddings.
- **RSS & Atom Feed Ingestion**: Auto-discover and subscribe to developer blogs with OPML import/export.
- **Zero-Knowledge Encrypted Backups**: Client-side AES-GCM 256-bit passphrase vault encryption.

---

## 4. Non-Functional & Quality Standards
- **Performance**: Entry bundle $\le 150\text{ kB}$ via `React.lazy` code splitting; sub-second hybrid retrieval.
- **Security & Integrity**: Strict Zod schema validation on all API endpoints with XSS sanitization and PBKDF2 vault encryption.
- **Testing**: 100% passing automated unit and integration testing suite (`npm test` via Vitest).
