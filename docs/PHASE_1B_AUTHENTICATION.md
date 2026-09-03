# Phase 1B authentication deployment

OmniLink has two deliberately separate runtime modes.

- `local` is the default: loopback-only, login-free, one synthetic `local-default` workspace, and unlimited local AI usage.
- `multi-user` enables managed OIDC login, server-side sessions, workspace-scoped service tokens, tenant-filtered persistence, and quota admission. Startup fails before binding if its release configuration or provider discovery is incomplete.

## Multi-user environment contract

Set these values in the deployment secret manager, not in source control:

```dotenv
OMNILINK_MODE=multi-user
OMNILINK_HOST=0.0.0.0
OMNILINK_APP_ORIGIN=https://links.example.com
OMNILINK_OIDC_ISSUER=https://identity.example.com
OMNILINK_OIDC_CLIENT_ID=omnilink-production
OMNILINK_OIDC_AUDIENCE=omnilink-production
OMNILINK_OIDC_REDIRECT_URI=https://links.example.com/auth/callback
OMNILINK_SESSION_SECRET=<at-least-32-random-characters>
OMNILINK_SESSION_STORE=sqlite
OMNILINK_AI_QUOTA_MONTHLY_UNITS=1000000
```

`OMNILINK_OIDC_CLIENT_SECRET` is optional for providers that register OmniLink as a confidential client. Set `OMNILINK_OIDC_TOKEN_ENDPOINT_AUTH_METHOD` to `client_secret_post` or `client_secret_basic` to match that registration; public clients use `none`. `OMNILINK_OIDC_DISCOVERY_URL` can replace `OMNILINK_OIDC_ISSUER` when a provider uses a nonstandard discovery URL; the discovered issuer is still used for exact ID-token validation.

The provider application must allow exactly the configured callback URI and use Authorization Code flow. OmniLink generates PKCE S256, state, and nonce values for every login. The application origin must be HTTPS in staging/production so the `Secure`, `HttpOnly`, `SameSite=Lax` session cookie can be stored.

## Staging release gate

Run the repository gates before building the image:

```bash
npm run lint
# -> TypeScript exits 0
npm test
# -> all Vitest files pass
npm run build
# -> Vite and the server bundle exit 0
```

Then deploy to a staging OIDC tenant and verify:

1. An anonymous API request returns `401` while `/health` remains available.
2. Login redirects to the configured provider and callback creates a personal workspace.
3. A state-changing browser request with a foreign `Origin` returns `403`.
4. Two staging identities cannot retrieve each other's links, snapshots, feeds, stats, FTS results, or embeddings.
5. An exhausted test quota returns `429` before any Gemini request.
6. A service token stops working immediately after revocation and never appears in a URL or token-list response.
7. The extension token is stored in `chrome.storage.local`; MCP receives its token through `OMNILINK_SERVICE_TOKEN`.
8. The Phase 2 outbound-network adversarial checks in `docs/PHASE_2_OUTBOUND_NETWORKING.md` pass without logging target URLs or content.

Do not change the reverse proxy or container port from loopback-only publication until this gate passes.

## Service tokens

An authenticated workspace owner creates tokens through `POST /api/auth/tokens`, lists metadata through `GET /api/auth/tokens`, and revokes one through `DELETE /api/auth/tokens/:id`. The creation response displays the raw `olst_...` value once; SQLite stores only its SHA-256 hash and short prefix.

Choose only the scopes a client needs: `repository:read`, `repository:write`, `repository:delete`, `ai:execute`, and `repository:admin`. Send the credential only as `Authorization: Bearer <token>`.

## Rollback

To remove remote access without changing tenant data:

1. Stop the public reverse proxy or tunnel.
2. Set `OMNILINK_MODE=local` and `OMNILINK_HOST=127.0.0.1`.
3. Remove `OMNILINK_UNSAFE_ALLOW_REMOTE_NO_AUTH` and restart.
4. Confirm `/health` only from the local host.

Existing tenant rows remain in SQLite. Local mode resolves only `local-default`, so it cannot expose another workspace during rollback.
