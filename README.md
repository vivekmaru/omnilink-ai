# OmniLink AI - Smart Link Repository & Knowledge Hub

OmniLink AI is an intelligent, searchable link repository and knowledge management desktop SaaS application designed for organizing links from **Instagram Shorts/Reels**, **Reddit posts & comments**, **GitHub projects**, **YouTube videos**, **Twitter/X**, **ArXiv papers**, and technical articles.

Engineered with a refined **Linear × Raycast × Arc** dark developer aesthetic, OmniLink AI balances high information density with exceptional visual clarity, keyboard-driven navigation, and Google Gemini 3.7 Flash AI extraction.

---

## Key Capabilities

- 🎨 **Linear × Raycast × Arc Desktop SaaS UI**:
  - High-contrast, near-black technical canvas with semantic accent hierarchy (Blue/Periwinkle primary actions, Amber unread/starred, Cyan reading, Emerald reviewed/code insights, Slate metadata).
  - Spacious 3-column card grid at desktop widths with consistent visual hierarchy and zero AI-slop gradients.
  - Collapsible left sidebar navigation categorized into Views, Library States, Platforms, and Categories.
  - Unified header and consolidated filter toolbar with instant status toggles, category/tag selectors, and active filter counters.
  - Full keyboard shortcut support (`⌘K` / `/` search, `⌘J` Ask Repo AI, `N` new link, `1-4` view switchers, `?` / `⌘/` searchable shortcuts help dialog, `Esc` clear/close).
- 🤖 **Intelligent Multi-Tier Model Orchestration Layer**:
  - **Dynamic Task Routing**: Automatically selects the most cost-effective and accurate Gemini model based on content complexity:
    - *Quick Metadata & Real-Time Auto-Tagging*: `gemini-3.1-flash-lite` for sub-second, low-latency keystroke tagging.
    - *Standard Link Extraction & Summaries*: `gemini-3.7-flash` for high-fidelity structured JSON summaries and code extraction.
    - *Repository Clustering & Deep Q&A*: `gemini-3.7-flash` with `ThinkingLevel.HIGH` (and `gemini-3.1-pro-preview`) for multi-hop synthesis and reasoning.
  - **Automatic Fallback Chain**: Multi-tier failover (`gemini-3.7-flash` → `gemini-flash-latest` → `gemini-3.1-flash-lite`) with exponential backoff and jitter to mitigate rate limits (429) or transient spikes (503).
  - **Orchestrator Inspector & Telemetry**: Live metrics on model routing, latency (ms), token complexity, and execution logs.
- 🏷️ **Smart Auto-Tagging & Duplicate Prevention**:
  - Real-time keyword extraction suggesting high-confidence tags and categories before saving.
  - **Background Duplicate Detection & Smart Merge**: Continuous validation checking URLs against existing repository bookmarks; provides instant warnings with options to smart-merge tags & notes or update existing entries without creating clutter.
- 🧠 **AI-Powered Ingestion & Summarization (Multi-Tier Gemini)**:
  - Multi-level summarization: 1-sentence TL;DR + 3-5 bullet point takeaways.
  - Automatic code snippet and community quote extraction with specialized insight chips.
  - Granular tag discovery and depth/reading time estimation.
- 🗂️ **Multi-View Knowledge Engine**:
  - **Card Grid View**: Refined 3-column cards with source badges, insight chips, quiet tags, and hover actions.
  - **Compact List View**: High-density engineering table for rapid batch triage.
  - **Kanban Board**: Drag-and-drop workflow across Unread, Reading, and Reviewed lanes.
  - **AI Semantic Clusters**: Automatic topic groupings powered by Gemini embeddings.
- 💬 **Ask Your Repository AI**: Conversational natural language RAG search grounded over your entire bookmark library.
- 📰 **RSS & Atom Feed Subscriptions & Auto-Ingestion**:
  - Subscribe to any RSS, Atom, or developer blog URL with automatic feed discovery from standard website URLs.
  - Curated developer catalog featuring Cloudflare, Netflix Tech, Uber Engineering, GitHub Blog, Hacker News, ByteByteGo, Vercel, and Google AI.
  - Automatically fetches new blog posts and articles directly into the **Unread** repository queue with deduplication and metadata parsing.
  - Configurable auto-AI extraction (Gemini 3.7 Flash TL;DR and key takeaways) per feed.
  - OPML Import and Export for seamless migration from Feedly, NetNewsWire, Readwise Reader, or Inoreader.
  - Background periodic polling, manual on-demand feed synchronization, and source attribution badges.
- 📝 **Markdown Export for Obsidian & Notion**:
  - One-click copy and `.md` file generation formatted with Obsidian callouts (`> [!abstract]`, `> [!tip]`, `> [!quote]`), YAML frontmatter, and Notion block structures.
  - Multi-select batch export or single-card quick export including AI summaries, bullet-point key insights, fenced code snippets, and custom tags.
  - Flexible grouping (by Category, Platform, Reading Status) and real-time live Markdown preview.
- 📊 **Knowledge Analytics & Usage Pattern Insights**:
  - Deep visual breakdown of reading habits, platform distribution, tag frequencies, and category allocations using high-contrast CSS/SVG charts.
  - Interactive read/unread/reading ratio bar, total estimated reading time, AI knowledge density scores, and 1-click drill-down filtering by platform, category, or tag.
- 🔌 **Companion Chrome Extension & Bookmarklet**: Manifest V3 extension with 1-click tab saving, tag autofill, and direct backend sync.
- 📱 **Mobile Quick Share**: Web Share Target support for seamless iOS/Android sharing sheet integration and live QR connect.
- 🔄 **Cloud Sync & Offline-First**: Server-side REST API + offline localStorage/IndexedDB caching.
- 🔐 **Encrypted Backups & Security**: Client-side AES-GCM 256-bit passphrase encryption for zero-knowledge vault backups.

---

## Tech Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS, Motion, Lucide Icons, JSZip
- **Backend**: Node.js, Express, TypeScript (TSX/esbuild)
- **AI**: Google GenAI SDK (`@google/genai`) with `gemini-3.7-flash`
- **Security**: Web Crypto API (AES-GCM, PBKDF2)

