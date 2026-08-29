import type { NextFunction, Request, Response } from 'express';

export type RuntimeMode = 'local-single-user' | 'multi-user';
export type ActorKind = 'local' | 'user' | 'service';
export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

export interface RequestContext {
  actor: {
    id: string;
    kind: ActorKind;
  };
  workspace: {
    id: string;
    role: WorkspaceRole;
  };
  mode: RuntimeMode;
}

export type EndpointPolicy =
  | 'health:read'
  | 'repository:read'
  | 'repository:write'
  | 'repository:delete'
  | 'repository:admin'
  | 'ai:execute';

export const LOCAL_REQUEST_CONTEXT: RequestContext = Object.freeze({
  actor: Object.freeze({ id: 'local-user', kind: 'local' as const }),
  workspace: Object.freeze({ id: 'local-default', role: 'owner' as const }),
  mode: 'local-single-user' as const,
});

declare global {
  namespace Express {
    interface Request {
      securityContext?: RequestContext;
      endpointPolicy?: EndpointPolicy;
    }
  }
}

/**
 * Injects the server-owned context used by the current local single-user mode.
 * Future authentication middleware should replace this context before routes
 * execute; clients must never be able to supply actor or workspace IDs.
 */
export function attachLocalRequestContext(req: Request, _res: Response, next: NextFunction): void {
  req.securityContext = LOCAL_REQUEST_CONTEXT;
  next();
}

export function classifyEndpointPolicy(req: Request): EndpointPolicy {
  const path = req.path.startsWith('/api') ? req.path : `/api${req.path}`;
  if (path === '/health' || path === '/api/health') return 'health:read';
  if (path.startsWith('/api/ai/')) {
    return path.includes('/embeddings/reindex') ? 'repository:admin' : 'ai:execute';
  }
  if (path === '/api/links/suggest-tags') return 'ai:execute';
  if (path === '/api/links/check-duplicate' || path === '/api/links/preview-metadata' || path === '/api/rss/discover') {
    return 'repository:read';
  }
  if (path === '/api/import') return 'repository:admin';
  if (path.includes('/batch')) return 'repository:admin';
  if (path.includes('/rss/')) {
    if (req.method === 'GET') return 'repository:read';
    if (path.includes('/sync') || path.includes('/opml/import')) return 'repository:admin';
    if (req.method === 'DELETE') return 'repository:delete';
    return 'repository:write';
  }
  if (path.includes('/merge/')) return 'repository:admin';
  if (req.method === 'GET' || req.method === 'HEAD') return 'repository:read';
  if (req.method === 'DELETE') return 'repository:delete';
  return 'repository:write';
}

/**
 * Records a policy on every API request. Authorization is intentionally not
 * enforced in local mode; the policy is the seam for future auth and quotas.
 */
export function attachEndpointPolicy(req: Request, _res: Response, next: NextFunction): void {
  req.endpointPolicy = classifyEndpointPolicy(req);
  next();
}

export function requireSecurityContext(req: Request, res: Response, next: NextFunction): void {
  if (!req.securityContext || !req.endpointPolicy) {
    res.status(500).json({ error: 'Security boundary is not initialized.' });
    return;
  }
  next();
}
