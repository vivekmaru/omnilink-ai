import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import {
  LOCAL_REQUEST_CONTEXT,
  attachEndpointPolicy,
  attachLocalRequestContext,
  classifyEndpointPolicy,
} from '../server/securityBoundary';

function request(path: string, method = 'GET'): Request {
  return { path, method } as Request;
}

describe('security boundary', () => {
  it('uses a server-owned local actor and workspace', () => {
    const req = request('/api/links');
    attachLocalRequestContext(req, {} as never, () => {});

    expect(req.securityContext).toEqual(LOCAL_REQUEST_CONTEXT);
    expect(req.securityContext?.actor.kind).toBe('local');
    expect(req.securityContext?.workspace.id).toBe('local-default');
  });

  it('classifies read, write, destructive, admin, and AI policies', () => {
    expect(classifyEndpointPolicy(request('/api/links'))).toBe('repository:read');
    expect(classifyEndpointPolicy(request('/api/links', 'POST'))).toBe('repository:write');
    expect(classifyEndpointPolicy(request('/api/links/123', 'DELETE'))).toBe('repository:delete');
    expect(classifyEndpointPolicy(request('/api/ai/ask', 'POST'))).toBe('ai:execute');
    expect(classifyEndpointPolicy(request('/api/ai/embeddings/reindex', 'POST'))).toBe('repository:admin');
    expect(classifyEndpointPolicy(request('/api/links/suggest-tags', 'POST'))).toBe('ai:execute');
    expect(classifyEndpointPolicy(request('/api/links/check-duplicate', 'POST'))).toBe('repository:read');
    expect(classifyEndpointPolicy(request('/api/rss/discover', 'POST'))).toBe('repository:read');
    expect(classifyEndpointPolicy(request('/api/rss/feeds', 'POST'))).toBe('repository:write');
    expect(classifyEndpointPolicy(request('/api/rss/feeds/1/sync', 'POST'))).toBe('repository:admin');
    expect(classifyEndpointPolicy(request('/api/import', 'POST'))).toBe('repository:admin');
    expect(classifyEndpointPolicy(request('/api/links/batch', 'POST'))).toBe('repository:admin');
    expect(classifyEndpointPolicy(request('/api/links/merge/1', 'POST'))).toBe('repository:admin');
  });

  it('attaches an endpoint policy for middleware consumers', () => {
    const req = request('/api/stats');
    attachEndpointPolicy(req, {} as never, () => {});
    expect(req.endpointPolicy).toBe('repository:read');
  });
});
