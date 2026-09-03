import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OmniLinkDB } from '../server/db';
import {
  createAiAdmissionMiddleware,
  createServiceAiPermit,
  beginAiProviderAttempt,
  AiQuotaExceededError,
  recordAiProviderAttempt,
  runWithAiUsagePermit,
} from '../server/aiUsage';
import type { RuntimeConfig } from '../server/runtimeConfig';
import type { RequestContext } from '../server/securityBoundary';
import { HybridSearchEngine } from '../server/hybridSearch';

const cleanups: Array<() => void> = [];
function database(): OmniLinkDB {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnilink-usage-'));
  const db = new OmniLinkDB(path.join(dir, 'usage.db'));
  cleanups.push(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  return db;
}
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

const context: RequestContext = {
  actor: { id: 'service-1', kind: 'service' },
  workspace: { id: 'workspace-1', role: 'owner' },
  authMethod: 'service-token',
  mode: 'multi-user',
};

describe('AI quota admission and accounting', () => {
  it('denies exhausted requests before the provider path runs', () => {
    const db = database();
    db.ensureWorkspace('workspace-1');
    db.recordAiUsage({
      id: 'existing', actorId: 'service-1', workspaceId: 'workspace-1', operation: 'qa', model: 'flash', source: 'test',
      inputTokens: 10, outputTokens: 0, weightedUnits: 10, status: 'completed',
    });
    const runtime = { mode: 'multi-user', quotaMonthlyUnits: 10 } as RuntimeConfig;
    const request: any = { path: '/api/ai/ask', method: 'POST', body: { question: 'hello' }, endpointPolicy: 'ai:execute', securityContext: context, serviceTokenScopes: ['ai:execute'], get: () => undefined };
    const response: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json() { return this; } };
    const providerPath = vi.fn();
    createAiAdmissionMiddleware(runtime, db)(request, response, providerPath);
    expect(response.statusCode).toBe(429);
    expect(providerPath).not.toHaveBeenCalled();
  });

  it('requires ai:execute in addition to a compound repository-write scope', () => {
    const db = database();
    db.ensureWorkspace('workspace-1');
    const runtime = { mode: 'multi-user', quotaMonthlyUnits: 1000 } as RuntimeConfig;
    const request: any = {
      path: '/api/links', method: 'POST', body: { url: 'https://example.test' }, endpointPolicy: 'repository:write',
      securityContext: context, serviceTokenScopes: ['repository:write'], get: () => undefined,
    };
    const response: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json() { return this; } };
    const next = vi.fn();
    createAiAdmissionMiddleware(runtime, db)(request, response, next);
    expect(response.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows repository-only link saves when AI extraction is disabled', () => {
    const db = database();
    db.ensureWorkspace('workspace-1');
    const runtime = { mode: 'multi-user', quotaMonthlyUnits: 1 } as RuntimeConfig;
    const request: any = {
      path: '/api/links', method: 'POST', body: { url: 'https://example.test', autoAiExtract: false }, endpointPolicy: 'repository:write',
      securityContext: context, serviceTokenScopes: ['repository:write'], get: () => undefined,
    };
    const response: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json() { return this; } };
    const next = vi.fn();
    createAiAdmissionMiddleware(runtime, db)(request, response, next);
    expect(response.statusCode).toBe(200);
    expect(next).toHaveBeenCalledOnce();
  });

  it('records retries and fallbacks as separate provider attempts', async () => {
    const db = database();
    db.ensureWorkspace('workspace-1');
    const permit = createServiceAiPermit(context, db, 'mcp-synthesis', 'mcp', 1000, 10);
    await runWithAiUsagePermit(permit, async () => {
      recordAiProviderAttempt({ model: 'gemini-flash', inputCharacters: 40, status: 'failed', attempt: 1 });
      recordAiProviderAttempt({ model: 'gemini-flash-lite', inputCharacters: 40, outputCharacters: 20, status: 'completed', attempt: 2 });
    });
    const records = db.getAiUsage('workspace-1').filter((record) => record.status !== 'released');
    expect(records).toHaveLength(2);
    expect(new Set(records.map((record) => record.requestId)).size).toBe(2);
    expect(records.map((record) => record.status).sort()).toEqual(['completed', 'failed']);
  });

  it('admits each provider attempt atomically before the provider call', async () => {
    const db = database();
    db.ensureWorkspace('workspace-1');
    const permit = createServiceAiPermit(context, db, 'qa', 'mcp', 10, 1);
    await runWithAiUsagePermit(permit, async () => {
      const reservation = beginAiProviderAttempt({ model: 'gemini-flash', inputCharacters: 40 });
      expect(reservation).toBeTruthy();
      expect(() => beginAiProviderAttempt({ model: 'gemini-flash', inputCharacters: 4 })).toThrow(AiQuotaExceededError);
      recordAiProviderAttempt({ model: 'gemini-flash', inputCharacters: 40, outputCharacters: 0, status: 'completed', attempt: 1, reservationId: reservation });
    });
    expect(db.getAiUsageTotal('workspace-1', new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString())).toBe(10);
  });

  it('propagates quota denial through hybrid search and indexing', async () => {
    const db = database();
    db.ensureWorkspace('workspace-1');
    const engine = new HybridSearchEngine(db);
    const provider = { models: { embedContent: vi.fn() } } as any;
    const permit = createServiceAiPermit(context, db, 'embedding-query', 'test', 1, 1);
    await expect(runWithAiUsagePermit(permit, () => engine.search('query requiring tokens', provider, {}, 'workspace-1')))
      .rejects.toBeInstanceOf(AiQuotaExceededError);
    expect(provider.models.embedContent).not.toHaveBeenCalled();

    const indexingPermit = createServiceAiPermit(context, db, 'embedding-indexing', 'test', 1, 1);
    await expect(runWithAiUsagePermit(indexingPermit, () => engine.indexLink({
      id: 'link-1', url: 'https://example.test', title: 'A sufficiently long title', description: '', platform: 'article',
      category: 'Dev & Tech', tags: [], summary: { tldr: 'Summary', keyTakeaways: [] }, notes: '', isFavorite: false,
      isArchived: false, readStatus: 'unread', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      readingTimeMinutes: 1, aiScore: 1,
    } as any, provider, 'workspace-1'))).rejects.toBeInstanceOf(AiQuotaExceededError);
    expect(provider.models.embedContent).not.toHaveBeenCalled();
  });
});
