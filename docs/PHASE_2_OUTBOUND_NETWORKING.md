# Phase 2: Outbound Networking Closure

**Status:** Implemented; staging verification remains a release gate  
**Depends on:** `docs/SECURITY_PERFORMANCE_AUDIT_2026-08-30.md`

## Outcome

All application-controlled HTTP retrieval now uses a shared guarded transport. It rejects private and special-purpose destinations, validates every redirect, pins validated DNS results into the connection, applies a default whole-request timeout, limits decompressed response bytes, and rejects unexpected media types before JSON, HTML, or XML parsing.

Outbound transport metrics and reader/RSS fetch logs do not record full target URLs, query strings, credentials, prompts, article bodies, or feed content.

## Outbound inventory

| Caller | Destination source | Transport and controls | Parsed media |
| --- | --- | --- | --- |
| Generic reader extraction | User or stored bookmark URL | `safeFetch`; SSRF/DNS/redirect policy; 10 s caller timeout; 5 MiB body cap | HTML/XHTML only |
| Reddit submission/comments and oEmbed | Fixed provider host plus validated post ID or encoded public URL | `safeFetch`; 4–8 s caller timeout; body cap | JSON only |
| GitHub README | Fixed `raw.githubusercontent.com` URL derived from repository path | `safeFetch`; 4 s timeout; body cap | Text only |
| YouTube oEmbed | Fixed provider host plus encoded public URL | `safeFetch`; 6 s timeout; body cap | JSON only |
| arXiv and Hacker News | Fixed provider hosts plus validated item IDs | `safeFetch`; 8 s timeout; body cap | HTML or JSON as appropriate |
| RSS discovery and common-path probes | User URL and URLs discovered from its HTML | `safeFetch`; redirect revalidation; 6 s timeout; body cap | HTML for discovery; XML for feed parsing |
| RSS synchronization | Stored workspace feed URL | `safeFetch`; 10 s timeout; body cap | XML only |
| OIDC discovery | Trusted deployment configuration | Direct injected fetch to preserve HTTPS provider and loopback development support; redirects rejected; 5 s timeout; 256 KiB body cap | JSON only |
| OIDC JWKS | Trusted discovery/configuration through `jose` | `jose` remote-key cache; 5 s timeout; signing algorithm allowlist and issuer/audience verification | JWK set handled by `jose` |
| OIDC token exchange | Trusted discovered provider endpoint | Direct fetch to preserve loopback development support; redirects rejected; 10 s timeout; 256 KiB body cap | JSON only |
| Gemini generation and embeddings | Google GenAI SDK endpoint | SDK-managed TLS/auth; explicit 30 s HTTP timeout; AI admission and usage accounting | SDK-managed responses |

`tests/outboundInventory.test.ts` fails if a new raw `fetch()` call is added outside the reviewed OIDC token exchange and the guarded transport. Provider SDK network calls must be added to this table and given an explicit timeout before use.

## Parser boundary

- `readResponseJson` accepts `application/json` and structured `+json` types.
- `readResponseHtml` accepts only `text/html` and `application/xhtml+xml`.
- `readResponseXml` accepts XML media types, including structured `+xml` feeds.
- RSS content declared as HTML is used only for feed-link discovery. XML-looking bytes served as HTML are not passed to the XML parser.
- Response limits apply while streaming decompressed bytes, not only to `Content-Length`.

## Metrics and logging

The guarded transport exposes aggregate counters for requests, responses, redirects, blocked destinations, DNS failures, timeouts, oversized bodies, and rejected media types. Counters contain no URLs, hostnames, headers, response bodies, or credentials. Callers log only bounded status/error categories or opaque local record IDs.

## Verification and release gate

Before enabling remote multi-user access:

1. Run `npm run lint`, `npm test`, and `npm run build`.
2. Run the staging OIDC and two-workspace isolation checks in `docs/PHASE_1B_AUTHENTICATION.md`.
3. Exercise reader and RSS requests against private-IP, redirect-to-private, slow-body, oversized-body, and wrong-content-type fixtures.
4. Confirm outbound metrics change without emitting target URLs or content.
5. Review any new SDK or raw network path against the inventory test and this document.

Rollback remains `OMNILINK_MODE=local` with `OMNILINK_HOST=127.0.0.1`. Do not publicly expose local/no-auth mode.
