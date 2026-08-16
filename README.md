# OmniLink AI - Personal Knowledge Repository & Intelligent Link Hub

OmniLink AI is an intelligent, searchable personal link repository, knowledge base, and AI context engine designed for collecting, indexing, and querying links from **GitHub repositories**, **ArXiv & academic papers**, **Reddit discussions & comments**, **Instagram Reels**, **YouTube videos**, **Twitter/X**, and technical articles.

Engineered with a refined **Linear × Raycast × Arc** dark developer aesthetic, OmniLink AI pairs high information density and keyboard-driven navigation with a native **SQLite WAL + FTS5 BM25 + Gemini Dense Vector Embeddings + Reciprocal Rank Fusion (RRF) Hybrid Search Engine** and a **Model Context Protocol (MCP)** server for Claude Desktop, Cursor, and AI agents.

---

## ⚡ Core Highlights & Capabilities

### 🔍 1. Native SQLite + Hybrid Search Engine (BM25 + Dense Vectors + RRF)
- **High-Performance SQLite Backend**: Backed by `better-sqlite3` with `PRAGMA journal_mode = WAL`, synchronous writes, foreign key cascading, and ACID durability.
- **FTS5 Lexical Search**: Full-text BM25 index across `title`, `url`, `category`, `tags`, `notes`, and `summary` with automated SQLite synchronization triggers.
- **Dense Vector Semantic Embeddings**: 768-dimensional dense vector embeddings generated via Gemini `text-embedding-004` (with offline term-hash fallback).
- **Reciprocal Rank Fusion (RRF)**: Merges lexical full-text rankings and dense vector semantic similarities using the formula:
  $$\text{RRF}(d) = \frac{1}{60 + \text{rank}_{\text{FTS}}(d)} + \frac{1}{60 + \text{rank}_{\text{Vector}}(d)}$$
- **Background Indexing Worker**: Automatically calculates and persists vector embeddings for newly ingested links without blocking UI threads.

### 📖 2. Full-Page Readability & Offline Reader Mode
- **DOM Sanitization & Main Body Extraction**: Powered by Mozilla `@mozilla/readability` and `JSDOM` to strip ads, paywalls, analytics trackers, and scripts.
- **Markdown Archiving**: Automatically transforms articles into clean GitHub Flavored Markdown using `turndown` and stores snapshots directly in SQLite (`reader_snapshot`).
- **Distraction-Free Reader View**: In-app reading interface with editorial serif typography, word count, estimated reading time, and 1-click Markdown copy for Obsidian/Notion.

### 🤖 3. Model Context Protocol (MCP) Server for AI Agents
- **Native STDIO Transport**: Runs via `@modelcontextprotocol/sdk` (`npm run mcp`), allowing **Claude Desktop**, **Cursor**, **Antigravity**, **Zed**, and autonomous AI agents to query and save knowledge directly to OmniLink.
- **Exposed Agent Tools**:
  - `search_repository`: Hybrid search across personal bookmarks with RRF ranking.
  - `save_bookmark`: Save URLs, auto-extract metadata, and index embeddings in real-time.
  - `get_article_snapshot`: Retrieve clean, distraction-free Markdown article snapshots.
  - `ask_repository`: Grounded RAG synthesis with source citations over your library.
  - `list_recent_bookmarks`: Browse bookmarks by reading status and category.
  - `get_repository_stats`: Inspect repository health, unread inbox, and vector index status.
- **Exposed MCP Resources**: `omnilink://library/stats`, `omnilink://library/unread`.

### 📱 4. Mobile Quick Share & Apple Shortcuts Ingress Hub
- **W3C Web Share Target API**: PWA manifest (`manifest.json`) and Service Worker (`sw.js`) enable native iOS and Android Share Sheet integration when added to your home screen.
- **Apple Shortcuts Endpoint (`POST /api/share/quick`)**: 1-tap capture from iPhone, iPad, Apple Watch, or Mac with automatic AI analysis and OS notifications.
- **Multi-Surface Setup Hub**: Interactive in-app guide with live camera QR code scanner, cURL automation snippets, and webhook integrations.

### 🌐 5. Production Chrome Extension (Manifest V3)
- **Load Unpacked (`extension/`)**: Ready-to-use Manifest V3 extension with active tab reader, auto-tagging suggestions, and right-click context menus.
- **Omnibox Address Bar Search (`ol <keyword>`)**: Type `ol <query>` in Chrome's URL bar (e.g. `ol sqlite` or `ol rag`) to perform live hybrid search and navigate directly from browser suggestions.
- **Chrome Native Side Panel**: Embedded companion panel (`sidepanel.html`) with instant search, recent feed, and 1-click **"+ Save Current Tab"** action.

### 🗂️ 6. Multi-View Knowledge Engine & Developer Workflows
- **Card Grid View**: Refined 3-column cards with source badges, insight chips, quiet tags, and hover actions.
- **Compact List View**: High-density engineering table for rapid batch triage.
- **Kanban Board**: Drag-and-drop workflow across Unread, Reading, and Reviewed lanes.
- **Semantic Topic Clusters**: Automatic semantic clustering powered by vector embeddings.
- **Conversational Ask Repo AI**: Natural language RAG synthesis grounded over your library with similarity badges.
- **RSS & Atom Feed Ingestion**: Auto-discover and subscribe to developer blogs with OPML import/export.
- **Zero-Knowledge Encrypted Backups**: Client-side AES-GCM 256-bit passphrase vault encryption.

---

## 🛠️ Quick Start & Installation

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **bun** / **pnpm**
- *(Optional)* **Gemini API Key**: For Gemini Flash AI summaries and 768-dim embeddings (`GEMINI_API_KEY` in `.env`).

### 2. Setup & Run Locally

```bash
# Clone the repository
git clone https://github.com/your-username/omnilink-ai.git
cd omnilink-ai

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Add your GEMINI_API_KEY to .env (optional: offline heuristic fallback works without an API key)

# Start the full-stack dev server (Vite + Express + SQLite WAL)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

OmniLink AI features a comprehensive **Vitest** automated testing suite covering all architectural layers:

```bash
# Run unit & integration test suites
npm test

# Run tests in watch mode
npm run test:watch

# Run TypeScript typecheck & production build
npm run lint && npm run build
```

---

## 🔌 Connecting to Claude Desktop / Cursor (MCP)

Add OmniLink to your `claude_desktop_config.json` (on macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "omnilink": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "/absolute/path/to/OmniLink-AI---Smart-Link-Repository/server/mcpServer.ts"
      ],
      "env": {
        "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY"
      }
    }
  }
}
```

Restart Claude Desktop, and Claude will now have direct access to `search_repository`, `save_bookmark`, `get_article_snapshot`, and `ask_repository`!

---

## 📚 Documentation & Integration Guides

- 📖 [**Architecture & Technical Specification**](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/ARCHITECTURE.md)
- 🖥️ [**Unraid Server Deployment & 1-Click Update Guide**](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/docs/UNRAID_DEPLOYMENT_GUIDE.md)
- 🚀 [**Production Deployment Guide (Docker / Compose / Fly.io)**](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/docs/DEPLOYMENT_GUIDE.md)
- 🤖 [**Model Context Protocol (MCP) Integration Guide**](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/docs/MCP_INTEGRATION_GUIDE.md)
- 📱 [**Mobile Quick Share & Apple Shortcuts Guide**](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/docs/MOBILE_QUICK_SHARE_GUIDE.md)
- 🌐 [**Chrome Extension Setup & Omnibox Guide**](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/docs/CHROME_EXTENSION_GUIDE.md)
- 📡 [**REST API Reference & Zod Schemas**](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/docs/API_REFERENCE.md)

---

## 🏗️ Project Structure

```
OmniLink-AI/
├── data/                      # SQLite database storage (omnilink.db, WAL, backups)
├── docs/                      # Comprehensive integration & usage guides
│   ├── API_REFERENCE.md
│   ├── CHROME_EXTENSION_GUIDE.md
│   ├── MCP_INTEGRATION_GUIDE.md
│   └── MOBILE_QUICK_SHARE_GUIDE.md
├── extension/                 # Manifest V3 Chrome Extension package
│   ├── icons/                 # Distinct PNG & SVG extension icons
│   ├── background.js          # Service worker (Context menus & Omnibox 'ol')
│   ├── popup.html / popup.js  # 1-click active tab saver
│   ├── sidepanel.html / .js   # Native Chrome Side Panel dashboard
│   └── manifest.json          # Manifest V3 configuration
├── public/                    # PWA static assets & web manifest
│   ├── icon.svg               # Scalable vector logo
│   ├── manifest.json          # W3C Web Share Target manifest
│   └── sw.js                  # PWA Service Worker
├── server/                    # Node.js Express & Backend Services
│   ├── db.ts                  # SQLite WAL + FTS5 + Embeddings database engine
│   ├── hybridSearch.ts        # FTS5 BM25 + Gemini text-embedding-004 + RRF
│   ├── mcpServer.ts           # Official Model Context Protocol (MCP) STDIO server
│   ├── readabilityService.ts  # Mozilla Readability DOM parsing & Markdown archiver
│   ├── modelOrchestrator.ts   # Multi-tier Gemini model routing & fallback chain
│   └── validators.ts          # Strict Zod schemas & XSS sanitizers
├── src/                       # React 19 Frontend Application
│   ├── components/            # UI components, modals, and views
│   ├── services/              # API clients, crypto vault, tag heuristics
│   ├── utils/                 # URL normalization, share parsers
│   ├── App.tsx                # Code-split application root
│   └── index.css              # Dark theme CSS tokens & variables
├── tests/                     # Vitest automated test suites
├── server.ts                  # Main Express REST backend server
├── vite.config.ts             # Vite build & Rollup chunking configuration
└── package.json               # Scripts and dependencies
```

---

## 📄 License
MIT License. Built for high-leverage research, knowledge archiving, and AI-assisted workflows.
