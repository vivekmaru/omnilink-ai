# AGENTS.md - Agent Integration & Architecture Guide

This document defines the agent architecture, tool matrix, and development rules for AI agents (Claude, Cursor, Antigravity, Zed, Copilot) interacting with or developing **OmniLink AI**.

---

## 🎯 When to Use What: Surface Decision Matrix

| Use Case / Scenario | Recommended Interface | Why |
| :--- | :--- | :--- |
| **Agent needs to retrieve user knowledge / bookmarks** | **MCP Server (`search_repository`)** | Fast hybrid BM25 + dense vector semantic search with RRF ranking. |
| **Agent needs to synthesize answer from user's library** | **MCP Server (`ask_repository`)** | Grounded RAG synthesis with similarity citations and markdown output. |
| **Agent needs full clean article text** | **MCP Server (`get_article_snapshot`)** | Stripped of ads/trackers, formatted as GitHub Flavored Markdown. |
| **Agent saves reference link during research** | **MCP Server (`save_bookmark`)** | Auto-fetches OpenGraph, generates AI summary, tags, and 768-dim embeddings. |
| **User browsing the web in Chrome** | **Chrome Extension (`extension/`)** | 1-click save, active tab reader, address bar omnibox (`ol <query>`). |
| **User on mobile (iOS / Android / Mac Shortcuts)** | **Mobile Quick Share API (`POST /api/share/quick`)** | 1-tap capture from iOS/Android share sheet or Apple Watch/Siri. |
| **Visual link curation, batch triage, Reader Mode** | **Web Application UI (`localhost:3000`)** | Linear/Raycast UI with Grid/List/Kanban, dark theme, and topic clusters. |
| **Self-hosted server / NAS deployment** | **Multi-arch Docker Image (`ghcr.io/vivekmaru/omnilink-ai`)** | Zero-dependency container with SQLite WAL, Unraid XML template ready. |

---

## 🤖 MCP (Model Context Protocol) Agent Tools Reference

When connected via STDIO transport (`npm run mcp`), agents have access to the following toolset:

### 1. `search_repository`
* **When to use**: Whenever answering user questions that depend on saved articles, documentation, or links.
* **Parameters**: `query` (string, required), `limit` (number, default: 10), `filterTag` (string, optional), `status` (`'all'` | `'unread'` | `'read'`, default: `'all'`).
* **Mechanism**: Executes SQLite FTS5 BM25 + Gemini Dense Vector Embeddings combined via Reciprocal Rank Fusion (RRF).

### 2. `ask_repository`
* **When to use**: When the user wants a direct synthesized response synthesized across their entire link library.
* **Parameters**: `question` (string, required), `limit` (number, default: 5).
* **Output**: Grounded AI response with bullet points and Markdown citations `[Title](url)`.

### 3. `get_article_snapshot`
* **When to use**: When you need deep context from a specific bookmark without making external HTTP requests.
* **Parameters**: `id` (number, required).
* **Output**: Cached reader mode markdown body, word count, reading time, author, and publish date.

### 4. `save_bookmark`
* **When to use**: When an agent finishes a research task or finds useful URLs to store for the user.
* **Parameters**: `url` (string, required), `notes` (string, optional), `customTags` (array of strings, optional).
* **Processing**: Triggers real-time crawler, Readability extractor, Gemini auto-tagger, and vector indexer.

### 5. `list_recent_bookmarks`
* **When to use**: When reviewing recently added items or reading inbox backlog.
* **Parameters**: `limit` (number, default: 10), `status` (`'all'` | `'unread'` | `'read'`), `category` (optional string).

### 6. `get_repository_stats`
* **When to use**: Inspecting library health, total link count, vector embedding coverage, and unread count.

---

## 🏗️ Codebase Directory Structure & Responsibilities

For AI coding agents modifying this repository:

```
omnilink-ai/
├── server/                     # Backend Node.js / Express service
│   ├── db.ts                   # SQLite WAL connection, FTS5 triggers, schema migrations
│   ├── vectorDb.ts             # 768-dim vector math, cosine similarity, RRF scoring
│   ├── crawler.ts              # JSDOM + Readability + custom extractors (HN, Reddit, ArXiv)
│   ├── gemini.ts               # Gemini 2.5 Flash categorization, summarization, embedding-004
│   ├── mcpServer.ts            # MCP Server implementation (@modelcontextprotocol/sdk)
│   └── routes/                 # Express API route handlers
├── src/                        # Frontend Vite + React 19 + Tailwind CSS v4
│   ├── components/             # UI components (ReaderMode, AskAiModal, Kanban, Clusters)
│   ├── hooks/                  # Custom React hooks (SWR caching, keyboard shortcuts)
│   └── types/                  # Shared TypeScript interfaces
├── extension/                  # Chrome Extension (Manifest V3)
│   ├── manifest.json           # Extension configuration, permissions, omnibox setup
│   ├── background.js           # Service worker, context menus, omnibox listener
│   └── sidepanel.html/js       # Chrome native side panel UI
├── unraid/                     # Unraid Community Apps Docker template
├── docs/                       # Architectural & integration guides
└── .github/workflows/          # CI/CD Workflows (Docker GHCR publish, Release Please)
```

---

## 🛠️ Developer Agent Commands

Always run these standard commands when modifying code:

| Action | Command |
| :--- | :--- |
| **Run Development Server** | `npm run dev` |
| **Run Test Suite** | `npm test` |
| **Typecheck & Lint** | `npm run lint` |
| **Production Build** | `npm run build` |
| **Start MCP Server Standalone** | `npm run mcp` |

---

## 📦 Commit & Release Guidelines

This repository uses **Conventional Commits** automated by **Google Release Please**:

* `feat: ...` ➔ Minor version release (`1.1.0`)
* `fix: ...` ➔ Patch version release (`1.0.1`)
* `feat!: ...` or `BREAKING CHANGE:` ➔ Major version release (`2.0.0`)
* `docs:`, `chore:`, `refactor:`, `test:` ➔ Updated in changelog without unnecessary version bumps
