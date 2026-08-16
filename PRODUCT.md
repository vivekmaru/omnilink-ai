# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers, AI researchers, and power knowledge curators who need an all-in-one personal knowledge repository. They continuously capture, organize, and synthesize technical code repositories, academic papers, engineering blogs, and multi-platform media across desktop and mobile workflows.

## Product Purpose

OmniLink AI turns raw web links into structured, queryable, and distraction-free knowledge. It eliminates bookmark rot and fragmented browser tabs by providing sub-second hybrid retrieval, automated vector embeddings, offline readability extraction, and direct context access for AI coding agents.

## Positioning

A privacy-focused, local-first link repository powered by SQLite WAL + FTS5 BM25 + Gemini Dense Vector Embeddings with Reciprocal Rank Fusion (RRF). Unlike generic bookmark managers, OmniLink AI integrates deeply across developer workflows with native Model Context Protocol (MCP) support, Chrome Omnibox search, and frictionless mobile ingress.

## Operating Context

- **Desktop Development & Research**: Rapid triage using `⌘K` command palette, keyboard-driven bulk actions, and deep context injection into Claude Desktop / Cursor / Antigravity agents via STDIO MCP.
- **Mobile Browsing**: 1-tap capture via native iOS/Android PWA Share Target, Apple Shortcuts, and headless webhook endpoints.
- **Deep Reading**: Distraction-free reader view with cached offline Markdown snapshots, serif typography, reading time estimates, and 1-click Markdown copying.

## Capabilities and Constraints

- **Hybrid Retrieval Engine**: SQLite WAL mode with FTS5 lexical indexing, 768-dimensional Gemini vector embeddings, and RRF rank merging.
- **Full-Page Readability & Markdown Archiving**: In-app Mozilla Readability + Turndown engine saving clean offline Markdown snapshots in SQLite.
- **Model Context Protocol (MCP)**: Native STDIO server exposing `search_repository`, `save_bookmark`, `get_article_snapshot`, and `ask_repository` to AI agents.
- **Multi-Surface Ingress**: Chrome Extension (Manifest V3 popup, side panel, omnibox `ol <keyword>`, context menu), Web Share Target PWA, and webhook (`/api/share/quick`).
- **Flexible Workflows**: Card Grid, Compact List table, Kanban Workflow (Unread/Reading/Reviewed), and Semantic Topic Clusters.
- **Encrypted Vault Backups**: Client-side AES-GCM 256-bit passphrase vault encryption.
- **Frontend Stack**: React 19, TypeScript, Vite, and Tailwind CSS v4 with entry bundle target ≤ 150 kB.

## Brand Commitments

- **Name**: OmniLink AI
- **Aesthetic Direction**: **Linear × Raycast × Arc** — high information density, crisp typography, subtle border hierarchy, micro-interactions, and seamless dark and light modes.
- **Voice & Tone**: Pragmatic, developer-grade, precise, reliable, and distraction-free.

## Evidence on Hand

- Production full-stack codebase with SQLite WAL database and FTS5 triggers ([server.ts](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/server.ts), [server/mcpServer.ts](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/server/mcpServer.ts)).
- Detailed Product Requirements Document ([PRD.md](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/PRD.md)) and System Architecture Specification ([ARCHITECTURE.md](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/ARCHITECTURE.md)).
- Chrome Extension Manifest V3 implementation in [extension/](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/extension).
- Comprehensive automated test suite in [tests/](file:///Users/vivek/antigravity/OmniLink-AI---Smart-Link-Repository/tests).

## Product Principles

1. **Instant, Keyboard-First Responsiveness**: Every critical action, search query, and triage flow must execute in sub-100ms with intuitive keyboard shortcuts.
2. **High Signal, Zero Clutter**: Prioritize clean reading surfaces, structured metadata, and synthesized AI insights over noise and clutter.
3. **Ambient Ingress & Universal Context**: Capture easily from any device or surface, and seamlessly provide curated knowledge to AI agents.
4. **Data Sovereignty & Offline Durability**: Store data durably in SQLite with offline Markdown snapshots and zero-knowledge client-side encryption options.

## Accessibility & Inclusion

- Full keyboard navigability (`Tab`, `ArrowKeys`, `⌘K`, shortcut keys) for all primary actions and modal dialogues.
- WCAG 2.1 AA compliant color contrast ratios across dark and light themes.
- Accessible semantic HTML structure, ARIA landmarks, and visible focus rings.
