# OmniLink AI - Architecture & Technical Specification

## System Overview
OmniLink AI utilizes a hybrid full-stack architecture combining a robust Express.js backend (with Google Gemini 3.7 Flash integration for automated extraction and clustering) and an offline-first React 19 + TypeScript frontend engineered with a **Linear × Raycast × Arc** SaaS design philosophy.

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|  +---------------------+  +----------------------+  +---------------------------+ |
|  | Linear/Raycast UI   |  | Chrome Extension V3  |  | Mobile Web Share Target   | |
|  | - 3-Col Card Grid   |  | - 1-Click Save Popup |  | - PWA Manifest Handler    | |
|  | - Unified Toolbars  |  | - Background Sync    |  | - URL Parameter Ingestion | |
|  | - Quick Actions &   |  | - API Token Auth     |  | - QR Mobile Connect       | |
|  |   Keyboard Nav (⌘K) |  +----------+-----------+  +-------------+-------------+ |
|  | - Shortcuts Help (?) |             |                            |               |
|  | - Markdown Exporter |             |                            |               |
|  |   (Obsidian/Notion) |             |                            |               |
|  | - Analytics Modal   |             |                            |               |
|  |   (Stats & Patterns)|             |                            |               |
|  +----------+----------+             |                            |               |
|             |                        |                            |               |
|  +----------v------------------------v----------------------------v-------------+ |
|  |              Client State & Offline Storage (IndexedDB / LocalStorage)        | |
|  |              + AES-GCM 256-bit Encryption / Decryption Subsystem              | |
|  |              + Toast & Micro-Interaction Feedback Dispatcher                  | |
|  |              + Keyboard Shortcuts Global Hotkey Dispatcher                    | |
|  +-----------------------------------+------------------------------------------+ |
+--------------------------------------|--------------------------------------------+
                                       | REST / JSON APIs
+--------------------------------------v--------------------------------------------+
|                                 SERVER LAYER                                      |
|  +------------------------------------------------------------------------------+ |
|  | Express Application (server.ts) on Port 3000                                 | |
|  | - /api/links (CRUD, Bulk Import, Search, Filtering)                          | |
|  | - /api/links/check-duplicate (Background URL Normalization & Dupe Detector)   | |
|  | - /api/links/suggest-tags (Keyword & Metadata Auto-Tagging Engine)           | |
|  | - /api/links/preview-metadata (Fast URL Metatag & OpenGraph Scraper)        | |
|  | - /api/ai/extract (Gemini 3.7 Flash URL Metadata & Summary Engine)           | |
|  | - /api/ai/cluster (Auto Topic Grouping & Semantic Taxonomies)               | |
|  | - /api/ai/ask (Conversational RAG Search over Saved Knowledge)               | |
|  | - /api/rss/* (Feed Subscriptions, XML Discovery, Background Sync, OPML)       | |
|  | - /api/extension/save (Extension & Web Share Ingestion Endpoint)             | |
|  | - /api/sync & /api/backup (Cloud Sync & Encrypted Vault Export/Import)       | |
|  +-----------------------------------+------------------------------------------+ |
|                                      |                                            |
|  +-----------------------------------v------------------------------------------+ |
|  | Server Storage: repository.json, rss_feeds.json                              | |
|  | + RSS 2.0 / Atom / RDF Ingestion Engine with Heuristic + Gemini Summarizer   | |
|  | + Google GenAI SDK (@google/genai with gemini-3.7-flash)                     | |
|  +------------------------------------------------------------------------------+ |
+-----------------------------------------------------------------------------------+
```


---

## Data Models & Type System (`src/types.ts`)

```typescript
export type PlatformType = 
  | 'github' 
  | 'reddit_post' 
  | 'reddit_comment' 
  | 'instagram_short' 
  | 'youtube' 
  | 'twitter_x' 
  | 'article' 
  | 'paper' 
  | 'other';

export interface LinkItem {
  id: string;
  url: string;
  title: string;
  description?: string;
  author?: string;
  platform: PlatformType;
  category: string;
  tags: string[];
  summary: {
    tldr: string;
    keyTakeaways: string[];
    codeSnippets?: string[];
    quotes?: string[];
  };
  thumbnailUrl?: string;
  faviconUrl?: string;
  notes?: string;
  isFavorite: boolean;
  isArchived: boolean;
  readStatus: 'unread' | 'reading' | 'read';
  createdAt: string;
  updatedAt: string;
  readingTimeMinutes?: number;
  aiScore?: number;
}

export interface ClusterGroup {
  id: string;
  title: string;
  description: string;
  linkIds: string[];
  themeColor: string;
}

export interface EncryptedBackupPayload {
  version: number;
  iv: string; // Base64
  salt: string; // Base64
  ciphertext: string; // Base64
  timestamp: string;
}

export interface RssFeed {
  id: string;
  url: string;             // RSS/Atom endpoint URL
  siteUrl?: string;        // Homepage website URL
  title: string;
  description?: string;
  category: string;
  defaultTags: string[];
  autoAiExtract: boolean;  // Automatically trigger Gemini TL;DR
  pollIntervalMinutes: number;
  enabled: boolean;
  faviconUrl?: string;
  lastFetchedAt?: string;
  lastError?: string;
  totalFetchedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RssFeedItem {
  guid: string;
  title: string;
  link: string;
  pubDate?: string;
  author?: string;
  contentSnippet?: string;
  categories?: string[];
  thumbnailUrl?: string;
}
```

---

## AI Pipeline & Model Orchestration Architecture

```
                                 Incoming AI Task / Request
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │   Content Complexity & Intent Analyzer    │
                       └─────────────────────┬─────────────────────┘
                                             │
               ┌─────────────────────────────┼─────────────────────────────┐
               ▼                             ▼                             ▼
   [Tier 1: Ultra-Fast Lite]      [Tier 2: Balanced Standard]   [Tier 3: Deep Synthesis Pro]
   Task: Quick Tags, Metadata     Task: Full Extraction, TLDR   Task: Clustering, Multi-hop RAG
   Model: gemini-3.1-flash-lite   Model: gemini-3.7-flash       Model: gemini-3.7-flash (Thinking: HIGH)
   Config: minimal latency        Config: structured JSON              or gemini-3.1-pro-preview
               │                             │                             │
               └─────────────────────────────┼─────────────────────────────┘
                                             ▼
                          ┌─────────────────────────────────────┐
                          │   Adaptive Fallback & Retry Chain   │
                          │ gemini-3.7-flash -> flash-latest    │
                          │        -> gemini-3.1-flash-lite     │
                          │   (Exponential Backoff + Jitter)    │
                          └──────────────────┬──────────────────┘
                                             │
                                             ▼
                          ┌─────────────────────────────────────┐
                          │ Real-time Telemetry & Health Engine │
                          │  (Latency, Routing Logs, Fallbacks) │
                          └─────────────────────────────────────┘
```

1. **Intelligent Router (`server/modelOrchestrator.ts`)**:
   - **`quick_metadata`**: Invokes `gemini-3.1-flash-lite` for instantaneous tag recommendations and metadata parsing.
   - **`standard_extraction`**: Invokes `gemini-3.7-flash` for high-fidelity structured summary, takeaways, code snippets, and quote extraction.
   - **`deep_reasoning`**: Invokes `gemini-3.7-flash` with `thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }` (or `gemini-3.1-pro-preview`) for multi-document synthesis and conversational repo exploration.
2. **Adaptive Fallback & Resilience Engine**:
   - Automatically detects transient 429 / 503 / Resource Exhausted errors and executes step-down fallbacks (`gemini-3.7-flash` → `gemini-flash-latest` → `gemini-3.1-flash-lite`).
   - Seamless heuristic fallback ensures uninterrupted offline/degraded operation.
3. **Telemetry & Orchestration Health Monitoring**:
   - Tracks real-time model utilization, latency percentiles, error rates, and fallback hop counters.
   - Accessible via `/api/ai/orchestrator-stats` and visualized in the UI.

---

## Security & Encryption Architecture
- **AES-GCM Web Crypto Implementation**:
  - Key derivation: `PBKDF2` with `SHA-256` hash and 100,000 iterations from user password + random 16-byte salt.
  - Encryption: `AES-GCM` 256-bit with unique 12-byte initialization vector (`IV`).
  - No secret keys sent to the server in encrypted backup mode; zero-knowledge client decryption.
