# Product Requirements Document (PRD) - OmniLink AI

## Project Overview
**OmniLink AI** is a smart, categorized link repository and knowledge management desktop SaaS system designed for developers, researchers, and power users who consume content across diverse platforms (Instagram Shorts/Reels, Reddit posts & comments, GitHub repositories, YouTube, X/Twitter, technical blogs, and arXiv papers).

Inspired by the precision aesthetics of **Linear × Raycast × Arc**, OmniLink AI provides automatic content extraction with **Gemini 3.7 Flash**, real-time keyword auto-tagging, a consolidated single-toolbar interface, collapsible navigation, high-contrast semantic typography, and robust local/cloud data security.

---

## Target Audience & Archetypes
- **Developers & Systems Engineers**: Curating GitHub repositories, technical architecture posts, and code snippets with automatic syntax-highlighted extraction and instant search.
- **Researchers & AI Practitioners**: Tracking arXiv papers, technical whitepapers, and prompt benchmarks with AI key takeaways and TL;DR synthesis.
- **Content Curators**: Capturing Reddit discussions and Instagram reels into structured, queryable knowledge.

---

## Core UI/UX Specifications (Linear × Raycast × Arc Redesign)

### 1. Visual Hierarchy & Spacing System
- **Canvas & Surface Palette**:
  - Near-black `#090A0F` background canvas with refined 1px subtle borders (`rgba(255,255,255,0.08)` dark, `#E2E8F0` light).
  - Elevated surfaces `#121520` for cards and modals.
  - Zero purple/pink gradients; semantic accent colors reserved strictly for functional status:
    - **Blue / Periwinkle (`#6366F1`)**: Primary focus, action triggers, selected views.
    - **Amber (`#F59E0B`)**: Starred items, unread alerts.
    - **Cyan (`#06B6D4`)**: In-progress reading state.
    - **Emerald (`#10B981`)**: Reviewed state, code snippets, verified insights.
    - **Slate / Muted Gray (`#94A3B8`)**: Secondary timestamps, authors, quiet tags.
- **Responsive 3-Column Card Grid**:
  - Balanced 3-column desktop layout (`xl:grid-cols-3`) with consistent card heights, subtle hover elevations, and 1px border glow transitions.
  - Card anatomy: Source badge & status indicator → Dominant title → Clamped 2-line AI TL;DR → Extracted insight chips (`1 code snippet`, `Discussion quote`) → Quiet tag pills → Metadata footer & hover quick-actions.

### 2. Collapsible Navigation & Clean Toolbars
- **Sidebar**:
  - Slim 256px (`w-64`) desktop sidebar with subtle count badges and collapsible sections (Views, Library, Platforms, Categories).
- **Consolidated Header & Filter Toolbar**:
  - Dominant search field with `⌘K` / `/` shortcuts and instant clear.
  - Integrated segmented view switcher (Grid, List, Kanban, Clusters).
  - Prominent **Ask Repo AI** button with subtle indigo aura and **+ Add Link** secondary action.
  - Single-row filter toolbar with status pills (`All`, `Unread`, `Reading`, `Read`), category & tag dropdowns, starred/archived toggles, sort order, active filter counter, and instant reset.

### 3. Micro-Interactions & Keyboard Workflows
- **Searchable Keyboard Shortcuts Help Dialog (`?` or `⌘/` / `Ctrl+/`)**:
  - Global hotkey listener allowing instant recall of all system navigation, actions, views, and filter shortcuts.
  - Interactive search bar filtering shortcuts by action name, key combination, or description in real-time.
  - Category filters: *All*, *Navigation & Search*, *Actions & Creation*, *Views & Layout*, *Triage & Filters*.
  - Styled visual keycaps (`<kbd>`) mirroring native macOS/Windows keyboard layout conventions.
  - Direct action triggering from shortcut rows and seamless `Esc` dismissal.
- `⌘K` or `/`: Focus search input.
- `⌘J`: Open Ask Repo AI assistant.
- `N` or `⌘N`: Open Add Link modal.
- `1`, `2`, `3`, `4`: Instant switcher for Grid, List, Kanban, and Semantic Clusters views.
- `⌘E`: Open Chrome Extension & Bookmarklet guide.
- `⌘M`: Open Mobile Quick Share sheet.
- `⌘B`: Open Encrypted Backup & Export vault.
- `⌘⇧E` / `Ctrl+Shift+E`: Open Markdown Export for Obsidian & Notion.
- `Esc`: Clear search / close active modal.
- Non-intrusive toast notification on star, copy URL, archive, delete, or AI re-extraction.

### 4. Obsidian & Notion Markdown Knowledge Exporter
- **Purpose**: Generates high-fidelity, customizable Markdown formatted specifically for 1-click copy-pasting or file importing into Obsidian and Notion knowledge vaults.
- **Export Presets**:
  - **Obsidian Preset**: YAML frontmatter (`---`), Obsidian callout syntax (`> [!abstract]`, `> [!tip]`, `> [!quote]`, `> [!note]`, `> [!example]`), `#tags` or `[[wikilinks]]`, and interactive `- [ ]` task checkboxes for reading status.
  - **Notion Preset**: Hierarchical Notion-friendly markdown blocks with embedded property summaries, H2/H3 anchors, blockquotes, and code fences.
  - **Standard Markdown (GFM)**: Clean GitHub Flavored Markdown for universal documentation.
- **Content Scope & Filtering**:
  - Selection-aware: Supports exporting explicitly selected items, currently filtered search results, or the entire repository.
  - Granular toggles: Include/exclude summaries, key takeaways, extracted code snippets, quotes, metadata, and personal notes.
  - Organization modes: Flat list, Grouped by Category, Grouped by Platform, or Grouped by Reading Status.
- **Instant Output Actions**:
  - 1-Click "Copy to Clipboard" with formatted markdown ready for instant paste.
  - Direct `.md` file download (`omnilink-obsidian-export.md` / `omnilink-notion-export.md`).
  - Integrated single-link export directly from Link Cards and Detail Modal.


### 8. Intelligent Multi-Tier Gemini Model Orchestration Layer
- **Purpose**: Replaces static single-model invocation with an adaptive multi-tier orchestration engine that analyzes task complexity, content depth, and latency constraints to select the most cost-effective and accurate Gemini model dynamically.
- **Task Routing Matrix**:
  | Task Type | Recommended Model / Configuration | Why & Complexity Profile |
  | :--- | :--- | :--- |
  | **Quick Metadata & Tag Suggestions** | `gemini-3.1-flash-lite` | Ultra-fast sub-second execution, lowest latency, cost-effective for batch ingestion and real-time keystroke tagging. |
  | **Standard Link Extraction & Summaries** | `gemini-3.7-flash` | Superior balance of speed, extraction accuracy, and structured JSON formatting for articles, videos, and social clips. |
  | **Repository Clustering & Deep Q&A** | `gemini-3.7-flash` (`ThinkingLevel.HIGH`) / `gemini-3.1-pro-preview` | Enhanced multi-step synthesis, cross-citation analysis, and technical reasoning over complex multi-link corpora. |
  | **Failover & High Demand Chain** | `gemini-3.7-flash` → `gemini-flash-latest` → `gemini-3.1-flash-lite` | Automatic fallback chain preventing rate limits (429) or transient service interruptions (503/UNAVAILABLE). |
- **Content Complexity Analyzer**:
  - Dynamically scores link complexity based on content length, code density, platform domain (GitHub/arXiv/RFC vs. short social posts), and multi-hop query context.
- **Failover & Resilience Architecture**:
  - Automatic fallback with exponential backoff and jitter.
  - Transparent execution telemetry tracking model selection, latency (ms), fallback hops, and thinking levels.
  - Live Orchestrator Inspector UI in dashboard toolbar and modals displaying real-time model routing stats and health.

### 9. Knowledge Analytics & Usage Pattern Insights Modal
- **Purpose**: Provides deep visual telemetry into personal reading habits, content platform distribution, knowledge density, and tag usage patterns using high-contrast, responsive CSS/SVG-based bar visualizations.
- **Analytics Metrics & Breakdown Modules**:
  - **KPI Summary Grid**: Total links saved, Unread vs. Reading vs. Read distribution, Favorites ratio, Archive count, Total estimated reading time (hours/minutes), and Average AI Knowledge Density Score.
  - **Read vs. Unread vs. Reading Ratio**: Interactive segmented ratio bar with percentage breakdowns, completion rates, and backlog velocity.
  - **Platform Distribution**: Horizontal ranked bar charts with platform icons (GitHub, Reddit, Instagram, YouTube, X/Twitter, Articles, Research Papers, etc.), count badges, and proportion bars.
  - **Tag Frequency & Topic Clusters**: Ranked distribution of top tags with frequency counts, percentage of total vault, and 1-click filter drill-down.
  - **Category Composition**: Visual allocation across knowledge categories (Dev & Tech, AI & ML, Design & UI, Tutorials, etc.).
  - **Reading Time & Content Depth**: Distribution of bookmarks across consumption durations (<3m quick clips, 3-10m articles, 10-30m deep dives, 30m+ extensive guides).
- **Interactive Drill-Down & Triage**:
  - Clicking any platform, category, or tag directly filters the main repository and closes the analytics modal for seamless workflow continuity.
  - Keyboard shortcut (`⌘A` or `A` when not editing text, plus dedicated buttons in Sidebar and Navbar).

---

## Core Features

### 1. Smart Link Ingestion, Pre-Submission Auto-Tagging & Duplicate Check
- **Real-Time Pre-Submission Auto-Tagging**:
  - Keyword extraction running dynamically on page title, description, notes, and URL as the user inputs data.
  - Generates ranked, high-confidence tag suggestions with matched source indicators (title, description, domain).
  - Recommends the best matching category with 1-click apply.
  - 1-click toggle for individual tag pills and "Accept All Suggested Tags".
  - Automatic keyword merging on save with optional auto-apply toggle.
- **Background URL Duplicate Detection & Smart Merge Workflow**:
  - Continuous background validation as URLs are typed or pasted into `AddLinkModal` with intelligent URL normalization (stripping tracking parameters like `utm_*`, `fbclid`, `ref`, normalizing protocols and trailing slashes).
  - Instant duplicate detection against local cache and server repository.
  - **Duplicate Alert Card**: Visual notification presenting existing bookmark details (saved date, category, read status, current tags, notes, and TL;DR).
  - **Smart Merge Action**: Seamlessly unions new tags with existing tags, appends new notes/descriptions with clean timestamps, updates categories, and preserves reading history.
  - **Update/Overwrite Action**: Replaces existing metadata with fresh input values without creating redundant entries.
  - **Direct Inspection & Override**: 1-click shortcut to inspect the existing bookmark in detail modal, or explicitly force-create a separate duplicate when needed.
- **Multi-Platform Support**: Instagram Shorts/Reels, Reddit posts & comments, GitHub repositories, YouTube videos, Twitter/X posts, ArXiv, Medium, Substack, and general web articles.
- **AI Extraction Engine (Gemini 3.7 Flash)**:
  - Automatic Title, Author, Platform detector, and rich favicon/thumbnail resolution.
  - High-precision Summary: 1-sentence TL;DR + 3-5 bullet point takeaways.
  - Key Insights / Code Snippet / Quotes extraction.
  - Automatic Categorization (e.g., *Dev & Tech, AI/ML, Design, Entertainment, Productivity, Science, Finance, Tutorials*).
  - Smart Tag Generation (5-8 relevant tags per link for granular search).
  - Sentiment & Read Time / Content Depth estimation.

### 2. Searchable Knowledge Repository & Clean Dashboard
- **Instant Search**: Full-text searching across titles, summaries, takeaways, notes, raw text, and tags.
- **Filtering System**:
  - By Platform (GitHub, Reddit, Instagram, YouTube, Twitter/X, Web).
  - By Category and custom user tags.
  - By Read Status (Unread, Reading, Read), Favorites, and Archived.
  - By Date ranges and content type.
- **Dynamic Layout Views**:
  - Modern Grid Cards (rich previews, tags, badge indicators, copy/share tools).
  - High-Density Compact List (for rapid triage).
  - Kanban / Category Columns (drag-and-drop workflow).
  - AI Topic Clusters / Graph View (semantic grouping of related links).
- **"Ask Your Repo" AI Assistant**:
  - Conversational search grounded in your saved repository.
  - Generates cross-link synthesis (e.g. "What GitHub repos do I have for LLM agents?").

### 5. RSS Feed Subscriptions & Automated Ingestion
- **Purpose**: Allows users to subscribe to RSS/Atom feeds of engineering blogs, developer news, research updates, or personal newsletters, automatically fetching and depositing new articles into the **Unread** repository queue.
- **Feed Discovery & Ingestion**:
  - Input either direct RSS/Atom URLs (`https://blog.cloudflare.com/rss/`) or standard website URLs (`https://blog.cloudflare.com`) with automatic `<link rel="alternate">` HTML feed discovery.
  - Curated Developer Feed Catalog: 1-click subscription to top engineering blogs (Cloudflare, Netflix Tech, Uber Engineering, GitHub Blog, Hacker News, ByteByteGo, Vercel, Google AI, Stripe, Substack).
  - Deduplication: Ingests only new articles by matching URLs and GUIDs against existing repository links.
  - Direct to Unread: Ingested articles arrive tagged with the feed source, category, and `readStatus: 'unread'`.
- **Feed Management & Customization**:
  - Custom feed titles, target categories (e.g. *Dev & Tech*, *AI & ML*), and automatic default tag assignment (`rss`, `engineering`, `blog`).
  - Auto-AI Summarization toggle per feed to automatically run Gemini 3.7 Flash extraction for TL;DR and key takeaways upon ingestion.
  - Manual on-demand "Sync All Feeds" and per-feed sync triggers with toast progress notifications.
  - Background periodic polling to check feeds every 15 minutes.
  - OPML Import & Export: Standardized XML import/export compatible with Feedly, NetNewsWire, Readwise Reader, and Inoreader.

### 6. Chrome Extension & Browser Companion
- **Manifest V3 Extension**:
  - 1-click quick save of active browser tabs.
  - Instant metadata preview, tag editor, and folder selector.
  - Direct connection to OmniLink backend / local instance via API key / token.
  - Downloadable extension package (.zip) + step-by-step developer mode installation guide.
- **Universal Bookmarklet**:
  - Zero-install draggable bookmarklet button for any browser (Safari, Firefox, Edge, Arc).

### 4. Mobile Quick Share & Cross-Platform Sync
- **Web Share Target (PWA)**:
  - Listens to system share events (`/?share_url=...&title=...&text=...`).
  - Mobile QR Code instant connect for saving directly from iOS / Android share sheet.
- **Quick-Add Floating Action**:
  - Fast paste modal with clipboard auto-detect and multi-link bulk ingestion.

### 5. Cloud Sync & Offline-First Architecture
- **Dual Persistence**:
  - Server-side REST API storage + Client-side local persistence (IndexedDB / LocalStorage).
  - Automatic background synchronization when network connectivity changes.
  - Visual sync status indicators (Live Synced, Syncing, Offline Cache Active).

### 6. Security & Encrypted Backups
- **AES-GCM 256-bit Encrypted Backups**:
  - Client-side cryptographic key derivation via PBKDF2 with user passphrase.
  - Encrypted `.omnilink.enc` export and secure decrypt-on-import.
  - Plain JSON and Markdown knowledge-base exports.

### 7. Aesthetic & UX Standards
- **Harness-Inspired Engineering Theme**: High-contrast, clean slate/zinc neutral palette with amber and emerald accents.
- **Strict Anti-Slop Directive**: No purple/pink gradients, no neon drop shadows, no nested card clutter.
- **First-Class Dark & Light Modes** with instant toggle and persistent state.
