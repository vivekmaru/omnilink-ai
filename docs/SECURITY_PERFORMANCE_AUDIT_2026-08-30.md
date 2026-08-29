# Security and Performance Audit

**Date:** 2026-08-30  
**Scope:** Express API, SQLite and FTS access, vector search, AI orchestration, reader extraction, RSS ingestion, browser extension rendering, deployment configuration, and production dependencies.

## Executive summary

OmniLink is currently safe only when it is treated as a trusted, single-user local application. Its HTTP server binds to all interfaces and the deployment documentation supports public hosting and tunnels, but the API has no application authentication or authorization. In that deployment model, anyone who can reach the service can read or mutate the repository, trigger externally billable AI operations, and initiate outbound requests.

The two release-blocking risks for any remote deployment are:

1. No authentication or authorization on repository, administrative, or AI endpoints.
2. Server-side request forgery exposure in reader and RSS fetch paths.

The main performance risks are unbounded expensive operations, full-repository in-memory filtering and serialization, linear vector scans, and unbounded external response parsing. These are static risks; production impact has not been measured because representative data volume, concurrency, and latency objectives have not yet been defined.

## Current product decision

The current testing phase has one trusted user and does not require authentication. The near-term supported posture is therefore **local single-user mode**. The eventual target is a multi-user service with:

- an authenticated identity for every request;
- isolated storage for each user's repository;
- per-user AI usage metering and quotas;
- explicit authorization for administrative and destructive operations.

Until authentication is implemented, remote unauthenticated exposure through a public reverse proxy, tunnel, or public container host is unsupported.

## Findings

### High: no application authentication or authorization

All API routes are registered without authentication middleware. This includes repository reads and writes, delete and batch operations, import/replace, RSS management, reader extraction, AI generation, and embedding reindexing.

**Evidence**

- `server.ts:357-448` exposes complete repository listing and search.
- `server.ts:719-835` exposes update, delete, reader extraction, and batch mutation.
- `server.ts:1302-1567` exposes AI extraction, clustering, Q&A, search, and reindexing.
- `server.ts:1633-1656` exposes import and replacement.
- Production deployment documentation describes reverse proxies, public hosting, and Cloudflare Tunnel access.

**Impact**

Any network client that can reach the service can obtain personal repository data, alter or delete it, trigger AI spending, or initiate expensive work.

**Smallest remediation**

Keep the current build local-only, then add a request identity and workspace boundary before enabling public access. Protect every non-health API route once authentication is introduced, with stronger policy checks for destructive, administrative, and billable operations.

### High: server-side request forgery in reader and RSS fetching

User-controlled HTTP(S) URLs are fetched by the server without rejecting private or special-purpose IP ranges. Redirect destinations are not revalidated.

**Evidence**

- `server/readabilityService.ts:420-438` fetches a stored URL and consumes the response.
- `server/rssService.ts:517-628` fetches a discovery URL, discovered URLs, and common-path candidates.
- `server/rssService.ts:644-680` fetches a stored feed URL during synchronization.
- Bookmark, quick-share, AI extraction, and MCP flows can persist or fetch attacker-selected URLs.

**Impact**

A reachable attacker could use the service to probe loopback, private-network, link-local, or cloud metadata services, including through redirects or DNS changes.

**Smallest remediation**

Centralize outbound HTTP in a guarded fetch utility that validates schemes and resolved addresses, revalidates redirects, and enforces timeout, redirect, response-size, and content-type limits.

### Medium: unbounded expensive and externally billable operations

AI extraction, clustering, repository Q&A, semantic search, embedding reindexing, and RSS synchronization have no request rate limit, per-user budget, concurrency admission, or job deduplication.

**Evidence**

- `server.ts:1302-1567` contains synchronous AI and reindex endpoints.
- `server.ts:1345-1407` serializes the entire repository into a clustering prompt.
- `server/hybridSearch.ts:190-230` creates a query embedding and scans all stored embeddings for each non-empty search.
- RSS sync endpoints can perform multiple external fetches and AI operations per request.

**Impact**

Repeated or concurrent requests can exhaust Gemini quota, saturate CPU, increase memory pressure, and duplicate background work.

**Smallest remediation**

Add authenticated per-user rate and usage policy, concurrency guards, and asynchronous job admission for long-running operations. In local mode, use the same interfaces with an unlimited local policy.

### Medium: repository list paths do not scale with repository size

`GET /api/links` clones, filters, and sorts the complete in-memory repository and returns all matching objects. Reader snapshots may be included in list responses.

**Evidence**

- `server.ts:357-447` performs full-array filtering and sorting without pagination.
- `server.ts:298-318` refreshes the entire SQLite repository into memory after mutations.

**Impact**

CPU, allocation, serialization, response size, and browser memory grow with total repository size. Actual severity needs measurement against expected repository sizes.

**Smallest remediation**

Move filtering and sorting into SQLite, add cursor pagination and strict result limits, and separate lightweight list projections from reader-snapshot detail responses.

### Medium: external response bodies and parsers are not size-bounded

Reader and RSS paths call `response.text()` without limiting bytes before passing content to JSDOM, Readability, or feed regex parsers.

**Evidence**

- `server/readabilityService.ts:420-448`
- `server/rssService.ts:528-580`
- `server/rssService.ts:666-680`

**Impact**

A large, compressed, chunked, or slow response can cause excessive memory consumption and parser/garbage-collection pressure.

**Smallest remediation**

Apply byte-limited streaming, reject oversized `Content-Length`, and cap decompressed and parsed content before DOM or XML processing.

### Medium: import accepts arbitrary, unbounded repository records

The import route validates only that `links` is an array. Individual records and array length are not validated, and replace mode assigns directly to the in-memory repository rather than transactionally rebuilding SQLite state.

**Evidence**

- `server.ts:1633-1656`
- Global JSON and form payload limits are 10 MB at `server.ts:34-35`.

**Impact**

Malformed imports can create invalid in-memory state, cause memory and serialization pressure, and diverge from SQLite persistence.

**Smallest remediation**

Validate bounded import records, normalize them, import through a SQLite transaction, and rebuild caches and embeddings consistently.

### Low: operational information leakage

Health responses expose repository and Gemini configuration state, while the global error handler returns raw error messages and request paths.

**Evidence**

- `server.ts:38-53`
- `server.ts:2269-2280`

**Smallest remediation**

Return minimal liveness data and generic production errors. Keep detailed diagnostics in structured server logs correlated by request ID.

## Dependency and build evidence

The audit baseline on 2026-08-30 was:

- `npm run lint`: passed.
- `npm test`: 11 test files and 38 tests passed.
- `npm run build`: passed.
- `npm audit --omit=dev`: no reported production dependency vulnerabilities across 317 production dependencies.

This dependency result is a point-in-time registry check, not a guarantee that every dependency or runtime configuration is secure.

## Material unknowns

- Expected bookmark counts and reader-snapshot sizes.
- Expected concurrent users and requests per user.
- Target AI budget and quota reset period.
- Whether multi-user storage means one physical database per user or logical tenant isolation in a shared database.
- Future hosting topology and whether multiple application instances must write concurrently.
- External reverse-proxy protections that may exist outside this repository.

## Remediation sequence

1. Phase 1: define and enforce the application security boundary while preserving local single-user mode.
2. Phase 2: centralize and secure outbound networking.
3. Phase 3: meter, limit, and queue expensive work.
4. Phase 4: paginate data access and improve storage/search scalability.
5. Phase 5: add adversarial regression tests and production release gates.

The implementation-ready Phase 1 plan is in `docs/PHASE_1_SECURITY_BOUNDARY_PLAN.md`.
