# Changelog

## [1.2.0](https://github.com/vivekmaru/omnilink-ai/compare/omnilink-ai-v1.1.0...omnilink-ai-v1.2.0) (2026-09-03)


### Features

* phase 3 ai ux hardening ([8f0b670](https://github.com/vivekmaru/omnilink-ai/commit/8f0b6704ef265b4a04bf34ba752a8f411f2cc1ab))
* **security:** add managed OIDC and outbound hardening ([9263e5a](https://github.com/vivekmaru/omnilink-ai/commit/9263e5a6e91248bca8a5f95573771609e5bdba66))


### Bug Fixes

* complete Unraid deployment configuration ([869d598](https://github.com/vivekmaru/omnilink-ai/commit/869d598db6af8c9cdb3c6ec418eef3736e6e7637))
* harden quota and metadata UX ([49f75c9](https://github.com/vivekmaru/omnilink-ai/commit/49f75c9e1175ec1fc64a422e0210d4a4be1143fb))
* improve quota admission and metadata fallback ([706a4d6](https://github.com/vivekmaru/omnilink-ai/commit/706a4d6d09763013ae0728e9f916f11fec1ecc9c))
* surface quota errors and clarify AI usage UI ([2557bbd](https://github.com/vivekmaru/omnilink-ai/commit/2557bbd448295eca910071cfbce22a31783ebcc1))

## [1.1.0](https://github.com/vivekmaru/omnilink-ai/compare/omnilink-ai-v1.0.0...omnilink-ai-v1.1.0) (2026-08-30)


### Features

* add bulk bookmark management and interactive rss feed toggle controls ([fc6be32](https://github.com/vivekmaru/omnilink-ai/commit/fc6be3255a4cd6a1b218dd16810dcad2a2f2f1ea))
* Add SQLite + FTS5 BM25 + Gemini Dense Vector Embeddings + RRF Hybrid Search Engine ([7646f3f](https://github.com/vivekmaru/omnilink-ai/commit/7646f3ffd4091556027ad20413763abaf808b396))
* **ai-extract:** add specialized Reddit/GitHub/ArXiv deep scrapers and authoritative extraction prompts ([049483b](https://github.com/vivekmaru/omnilink-ai/commit/049483bca376e877dee9230208527375e12c2e69))
* **ai:** clarify model router modal, add estimated cost & usage breakdown, and gate simulator behind DEV_MODE ([9e3f2e7](https://github.com/vivekmaru/omnilink-ai/commit/9e3f2e70064806426015e196cf7eba5b912e4d2d))
* **deploy:** Add multi-stage Dockerfile, docker-compose.yml, dynamic PORT/healthcheck, and comprehensive Production Deployment Guide ([5d20542](https://github.com/vivekmaru/omnilink-ai/commit/5d20542ee6122855433fb512755216b8081aef7e))
* enhance Ask AI markdown, mobile UX, SWR hydration and ETag caching ([dcc9fa0](https://github.com/vivekmaru/omnilink-ai/commit/dcc9fa0e55ad0b9470ef71d9fcdf613232b75446))
* **extension:** Create production Manifest V3 Chrome Extension package with Omnibox and Side Panel support ([7bd7f55](https://github.com/vivekmaru/omnilink-ai/commit/7bd7f55b491477c0f265cc58625e948d917e0e19))
* **hn:** add full Hacker News thread & Algolia comment tree extractor ([5dbc4f1](https://github.com/vivekmaru/omnilink-ai/commit/5dbc4f1fa4906306df0d874d4bfa6f4122a345d5))
* Initial commit for OmniLink AI smart link repository ([58aa2a2](https://github.com/vivekmaru/omnilink-ai/commit/58aa2a286be5040edcbca81d2dbff8c7bf15d865))
* **mcp:** Implement OmniLink Model Context Protocol (MCP) Server for Claude Desktop, Cursor, and AI agents ([ff09b97](https://github.com/vivekmaru/omnilink-ai/commit/ff09b971bf914782c72fd50915a7c62fa40c1b22))
* **mobile:** Add PWA Web Share Target API, Apple Shortcuts ingress, and upgraded Mobile Ingress Hub ([b11b6dd](https://github.com/vivekmaru/omnilink-ai/commit/b11b6ddad9189ea025ff1abf95e4517efdbc94a1))
* **perf:** Implement React.lazy code-splitting and Vite manualChunks optimization ([ee56c16](https://github.com/vivekmaru/omnilink-ai/commit/ee56c1673b57b0244c5afbeb6ae5c5db56dbf73d))
* **reader:** Add full-page Readability extraction and offline Reader Mode snapshotting ([d8048ab](https://github.com/vivekmaru/omnilink-ai/commit/d8048ab033f82f4134e7940ffcfb463dd7803405))
* **security:** Implement Zod request validation and global API error boundaries ([3d3e9cd](https://github.com/vivekmaru/omnilink-ai/commit/3d3e9cd1e2ab46ac93553ec278fb59781e474b50))
* **ui:** impeccable UI/UX polish, cohesive terracotta design system, tool deduplication, and card actions consistency ([c970d59](https://github.com/vivekmaru/omnilink-ai/commit/c970d590237bb138c0c14ec1221bb65e8c9ca132))
* **unraid:** add Unraid Docker template, GHCR publish workflow, and 1-click update guide ([6acf822](https://github.com/vivekmaru/omnilink-ai/commit/6acf8226933a0c373c78bf7a443e4dd7722e1abb))


### Bug Fixes

* migrate embedding model from deprecated text-embedding-004 to gemini-embedding-001 ([7b7eafa](https://github.com/vivekmaru/omnilink-ai/commit/7b7eafa77e858f1b347c29f2c65568fcbb8c86b7))
* overhaul Reader Mode markdown rendering and anchor modal close button ([2d2d103](https://github.com/vivekmaru/omnilink-ai/commit/2d2d1033f63a07dafd6412110faac494bd986e4e))
* **rss:** enable deep article readability and AI summarization for Hacker News feeds ([65c29a3](https://github.com/vivekmaru/omnilink-ai/commit/65c29a34311ce496282af8a6ad3ad743ebe08190))
* **ui:** overhaul light mode contrast and theme tokens using impeccable guidelines ([c174df2](https://github.com/vivekmaru/omnilink-ai/commit/c174df28f7abc59a9b0d4152989ca9ed6d59f88f))
