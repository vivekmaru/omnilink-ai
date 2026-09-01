# Phase 1 Plan: Local-Safe Security Boundary and Multi-User Foundations

**Status:** Implemented; staging OIDC verification remains
**Depends on:** `docs/SECURITY_PERFORMANCE_AUDIT_2026-08-30.md`

## Outcome

Phase 1 will keep the current product usable by one trusted local user without a login while introducing the request, workspace, storage, policy, and usage boundaries required by the future multi-user service.

Phase 1 does **not** implement end-user authentication, payments, or enforced AI quotas. It creates stable contracts for those features and makes the unauthenticated build fail safe when operators attempt to expose it remotely.

## Product modes

### Local single-user mode — implemented in Phase 1

- No login prompt.
- Every request receives a synthetic local actor and workspace.
- The default workspace ID is stable and not derived from request input.
- AI policy is unlimited but still records usage through the common meter.
- Server binding defaults to loopback.
- Remote binding requires `OMNILINK_AUTH_ENABLED=true` once real authentication exists, or an explicit unsafe development override for temporary testing.

### Multi-user mode — contract only in Phase 1

- Every request must carry an authenticated actor.
- The actor is authorized for a workspace before repository access.
- Storage calls require a trusted workspace context.
- AI admission checks a per-user or per-workspace quota before execution.
- Administrative and destructive operations have explicit policy names.
- `OMNILINK_MODE=multi-user` does not itself enable authentication or remote access; both remain blocked until authentication is implemented and explicitly enabled.

## Architecture decisions

### 1. Use workspace isolation as the core boundary

Model repository ownership around `workspaceId`, with `actorId` describing the authenticated user. For the initial multi-user service, each user can own one personal workspace. This avoids baking a one-user-only assumption into storage APIs and leaves room for shared workspaces later.

Request input must never be allowed to select an arbitrary workspace directly. Authentication and membership resolution will produce a trusted `RequestContext`:

```ts
interface RequestContext {
  actor: {
    id: string;
    kind: 'local' | 'user' | 'service';
  };
  workspace: {
    id: string;
    role: 'owner' | 'editor' | 'viewer';
  };
  mode: 'local-single-user' | 'multi-user';
}
```

Phase 1 should use constants such as `local-user` and `local-default` internally. These values are server-owned and must not be accepted from headers, query parameters, or JSON bodies.

### 2. Hide storage topology behind a workspace-scoped repository

Do not decide physical database-per-user versus shared-database tenancy inside route handlers. Introduce a workspace-scoped storage interface and retain the current SQLite implementation behind it.

```ts
interface LinkRepository {
  list(context: RequestContext, query: LinkListQuery): LinkPage;
  get(context: RequestContext, linkId: string): LinkItem | null;
  insert(context: RequestContext, input: NewLink): LinkItem;
  update(context: RequestContext, linkId: string, updates: LinkUpdates): LinkItem | null;
  delete(context: RequestContext, linkId: string): boolean;
}
```

The interface must require context on every operation. Avoid optional context or global fallback behavior because either would allow future routes to bypass isolation accidentally.

Before multi-user launch, choose the physical storage model using measured requirements:

| Option | Strengths | Costs |
| --- | --- | --- |
| SQLite file per workspace | Strong physical isolation, simple per-user backup and storage accounting | Connection lifecycle, migrations across many files, multi-instance routing, and file-count operations |
| Shared database with `workspace_id` | Easier pooling, cross-instance service operation, and centralized migrations | Every query and index must be tenant-scoped; stronger blast radius if a scope check is missed |

Phase 1 should not perform a risky schema migration until this choice is made. It should make the choice replaceable behind the repository interface.

### 3. Introduce usage accounting before quota enforcement

Every AI or embedding operation should pass through one admission and accounting service, even though local policy allows all requests:

```ts
interface AiUsagePolicy {
  authorize(context: RequestContext, operation: AiOperation, estimate: UsageEstimate): Promise<UsagePermit>;
  record(permit: UsagePermit, actual: UsageActual): Promise<void>;
}
```

Capture at least:

- actor and workspace IDs;
- operation type;
- model requested and model executed;
- request timestamp and latency;
- estimated and actual input/output tokens when provided by the SDK;
- success, failure, and fallback status;
- embedding item count for indexing jobs.

The local implementation can be `UnlimitedLocalAiUsagePolicy`, but all AI call sites must use the interface. A future quota implementation can then reject work before a Gemini call without changing route behavior.

### 4. Classify endpoint policies explicitly

Define named policy groups instead of scattering mode checks:

| Policy | Examples | Local mode | Future multi-user mode |
| --- | --- | --- | --- |
| `health:read` | `/health` | Public, minimal response | Public, minimal response |
| `repository:read` | list, stats, reader cache | Local actor | Authenticated workspace member |
| `repository:write` | create, update, quick share | Local actor | Owner or editor |
| `repository:delete` | delete, batch delete, import replace | Local actor plus explicit operation | Owner |
| `ai:execute` | extract, ask, cluster, search embedding | Local unlimited policy | Member plus quota admission |
| `repository:admin` | full reindex, destructive import | Local actor plus explicit operation | Owner/admin plus tighter rate limit |

Routes should attach a policy name and receive context from middleware. Route handlers should not parse identity or membership themselves.

## Work packages

### P1.1 — Runtime mode and safe network defaults

**Changes**

- Add validated runtime configuration for application mode, bind host, trusted proxy behavior, and unsafe local override.
- Default the HTTP listener to `127.0.0.1` in local single-user mode.
- Refuse startup when local/no-auth mode binds to a non-loopback interface unless an explicitly named unsafe development override is set.
- Keep Docker deployment possible, but require the operator to make the exposure decision explicitly.
- Return only liveness status from public health endpoints.
- Document the local and remote behavior in `.env.example` and deployment guides.

**Acceptance criteria**

- Default development startup listens only on loopback.
- An accidental `0.0.0.0` no-auth configuration fails with an actionable error.
- The explicit unsafe override produces a clear startup warning.
- Docker health checks still work inside the container.
- Tests cover loopback, remote refusal, and explicit override cases.

### P1.2 — Request context and endpoint policy middleware

**Changes**

- Define `RequestContext`, policy names, and typed Express request augmentation.
- Add local-context middleware that injects the stable server-owned local actor and workspace.
- Add policy middleware and apply it to every API route except minimal health checks.
- Add a route-policy inventory test so new endpoints cannot silently omit a policy.
- Replace production error responses with generic messages and request IDs.
- Add standard security headers and an explicit origin policy appropriate to local UI and extension clients.

**Acceptance criteria**

- Every non-health endpoint has a declared policy.
- Client-supplied identity/workspace fields cannot change the local context.
- Existing local UI, mobile-share, extension, and MCP behavior remains functional.
- Production responses do not expose raw internal errors.

### P1.3 — Workspace-scoped service and repository boundary

**Changes**

- Introduce application services for link, RSS, reader, search, import, and stats operations.
- Require `RequestContext` in storage/service methods.
- Move direct global `omniDb` and `linksDatabase` access out of route handlers incrementally.
- Encapsulate in-memory cache state inside the local workspace implementation.
- Add a test implementation with two isolated workspaces to prove that IDs, URLs, search, stats, imports, and mutations cannot cross boundaries.

**Acceptance criteria**

- Route handlers do not independently resolve storage ownership.
- Cross-workspace tests cover list, get, update, delete, search, stats, reader snapshot, RSS, and import.
- Existing single-user data loads under `local-default` without migration or loss.
- The storage implementation can later be replaced without changing HTTP contracts.

### P1.4 — AI usage admission and metering seam

**Changes**

- Define AI operation types, usage estimates, permits, and actual usage records.
- Implement unlimited local admission with structured local telemetry.
- Route extraction, Q&A, clustering, embeddings, reindexing, auto-tagging, and RSS AI work through the policy.
- Extend existing model-orchestrator telemetry to include actor, workspace, operation, and SDK usage metadata where available.
- Never log prompts, notes, article content, API keys, or other repository content as quota telemetry.

**Acceptance criteria**

- Every Gemini and embedding call has an associated usage permit.
- Success, fallback, and failure paths produce one bounded usage record.
- Tests prove a rejecting fake policy prevents the external AI call.
- Local mode remains unlimited and does not require configuration.

### P1.5 — Documentation and release guardrails

**Changes**

- Update README and deployment documentation to label no-auth mode as local-only.
- Document the future identity, workspace, and quota contracts.
- Add a production-startup test for unsafe unauthenticated exposure.
- Add a security-boundary checklist to the release workflow.

**Acceptance criteria**

- No documented public deployment path omits authentication requirements or the safe local-mode restriction.
- Operators can tell whether the current process is local-only from startup logs.
- CI runs the boundary tests alongside lint, unit tests, and build.

## Recommended delivery order

1. P1.1: safe runtime mode and network binding.
2. P1.2: request context and route policy inventory.
3. P1.3: workspace-scoped service and storage boundary.
4. P1.4: AI admission and accounting.
5. P1.5: documentation and release guardrails.

Each package should be independently reviewable and should preserve existing single-user mechanics. P1.3 is the largest package and should be split by application domain if its diff becomes difficult to review.

## Verification matrix

| Area | Required verification |
| --- | --- |
| Current behavior | Existing unit tests, extension tests, MCP tests, and production build |
| Network safety | Bind-host configuration tests and container health check |
| Route coverage | Automated inventory proving every non-health API route has a policy |
| Workspace isolation | Two-workspace integration tests for every data domain |
| Usage policy | Permit, reject, fallback, and failure accounting tests |
| Data safety | Existing database fixture opens unchanged in local mode |
| Documentation | Deployment examples match enforced startup behavior |

Standard project checks remain:

```bash
npm run lint
npm test
npm run build
npm audit --omit=dev
```

## Explicitly deferred

- Login UI and account lifecycle.
- Auth provider selection.
- Session cookies, OAuth, passkeys, or API-token issuance.
- Billing and payment integration.
- Enforced quota amounts and reset periods.
- Physical storage topology decision and data migration.
- SSRF guarded-fetch implementation (completed in Phase 2; see `docs/PHASE_2_OUTBOUND_NETWORKING.md`).
- Query pagination and vector-search redesign, which are Phase 4.

## Decisions needed before implementation reaches multi-user mode

These do not block local Phase 1 work:

1. Authentication provider and supported login methods.
2. SQLite-per-workspace versus shared tenant-scoped database.
3. Whether AI quota belongs to the user, workspace, subscription, or a combination.
4. Quota units: tokens, model-weighted credits, requests, or monetary budget.
5. Whether service/API tokens can act independently of interactive users.
