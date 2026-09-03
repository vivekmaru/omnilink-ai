import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { OmniLinkDB } from './db';
import type { RuntimeConfig } from './runtimeConfig';
import type { RequestContext } from './securityBoundary';

export interface AiUsagePermit {
  actorId: string;
  workspaceId: string;
  operation: string;
  model: string;
  source: string;
  requestId: string;
  unlimited: boolean;
  db: OmniLinkDB;
  quotaMonthlyUnits?: number;
  reservationId?: string;
  reservationReleased?: boolean;
}

export class AiQuotaExceededError extends Error {
  readonly status = 429;
  readonly code = 'AI_QUOTA_EXCEEDED';

  constructor() {
    super('AI usage quota exhausted.');
    this.name = 'AiQuotaExceededError';
  }
}

const permits = new AsyncLocalStorage<AiUsagePermit>();

export function createAiAdmissionMiddleware(runtime: RuntimeConfig, db: OmniLinkDB): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isAiOperation(req)) return next();
    const context = req.securityContext;
    if (!context) {
      res.status(500).json({ error: 'AI usage context is unavailable.' });
      return;
    }
    if (context.authMethod === 'service-token' && !req.serviceTokenScopes?.includes('ai:execute')) {
      res.status(403).json({ error: 'Service token lacks required scope: ai:execute.' });
      return;
    }
    const permit = buildPermit(context, req, runtime, db);
    if (!permit.unlimited) {
      const estimated = estimateWeightedUnits(JSON.stringify(req.body || {}).length, permit.model);
      if (runtime.quotaMonthlyUnits === null) {
        res.status(429).json({ error: 'AI usage quota exhausted.' });
        return;
      }
      const reservationId = `reserve_${randomUUID()}`;
      const reserved = db.tryReserveAiUsage({
        id: reservationId,
        actorId: permit.actorId,
        workspaceId: permit.workspaceId,
        operation: permit.operation,
        model: permit.model,
        source: permit.source,
        requestId: permit.requestId,
        inputTokens: 0,
        outputTokens: 0,
        weightedUnits: estimated,
      }, runtime.quotaMonthlyUnits);
      if (!reserved) {
        res.status(429).json({ error: 'AI usage quota exhausted.' });
        return;
      }
      permit.reservationId = reservationId;
      res.once('finish', () => releaseReservation(permit));
      res.once('close', () => releaseReservation(permit));
    }
    permits.run(permit, next);
  };
}

export function currentAiUsagePermit(): AiUsagePermit | undefined {
  return permits.getStore();
}

export function runWithAiUsagePermit<T>(permit: AiUsagePermit, operation: () => Promise<T>): Promise<T> {
  return permits.run(permit, operation);
}

/** Reserve an individual provider attempt immediately before the API call. */
export function beginAiProviderAttempt(input: { model: string; inputCharacters: number }): string | undefined {
  const permit = permits.getStore();
  if (!permit || permit.unlimited) return undefined;
  if (!permit.quotaMonthlyUnits || permit.quotaMonthlyUnits <= 0) throw new AiQuotaExceededError();

  if (permit.reservationId && !permit.reservationReleased) {
    permit.db.releaseAiUsageReservation(permit.reservationId);
    permit.reservationReleased = true;
  }

  const reservationId = `reserve_${randomUUID()}`;
  const inputTokens = estimateTokens(input.inputCharacters);
  const reserved = permit.db.tryReserveAiUsage({
    id: reservationId,
    actorId: permit.actorId,
    workspaceId: permit.workspaceId,
    operation: permit.operation,
    model: input.model,
    source: permit.source,
    requestId: `${permit.requestId}:attempt-reservation`,
    inputTokens,
    outputTokens: 0,
    weightedUnits: weightedTokens(Math.max(1, inputTokens), input.model),
  }, permit.quotaMonthlyUnits);
  if (!reserved) throw new AiQuotaExceededError();
  return reservationId;
}

export function recordAiProviderAttempt(input: {
  model: string;
  inputCharacters: number;
  outputCharacters?: number;
  status: 'completed' | 'failed';
  attempt: number;
  reservationId?: string;
}): void {
  const permit = permits.getStore();
  if (!permit || permit.unlimited) return;
  const inputTokens = estimateTokens(input.inputCharacters);
  const outputTokens = estimateTokens(input.outputCharacters || 0);
  const reservationId = input.reservationId || (permit.reservationReleased ? undefined : permit.reservationId);
  permit.db.recordAiUsageReplacingReservation(reservationId, {
    id: `usage_${randomUUID()}`,
    actorId: permit.actorId,
    workspaceId: permit.workspaceId,
    operation: permit.operation,
    model: input.model,
    source: permit.source,
    requestId: `${permit.requestId}:attempt:${input.attempt}`,
    inputTokens,
    outputTokens,
    weightedUnits: weightedTokens(inputTokens + outputTokens, input.model),
    status: input.status,
  });
  permit.reservationReleased = true;
}

export function createServiceAiPermit(
  context: RequestContext,
  db: OmniLinkDB,
  operation: string,
  source = 'mcp',
  quotaMonthlyUnits?: number,
  estimatedUnits = 1,
): AiUsagePermit {
  const permit: AiUsagePermit = {
    actorId: context.actor.id,
    workspaceId: context.workspace.id,
    operation,
    model: 'auto',
    source,
    requestId: randomUUID(),
    unlimited: context.mode === 'local-single-user',
    db,
    quotaMonthlyUnits,
  };
  if (!permit.unlimited) {
    if (!quotaMonthlyUnits) throw new Error('Multi-user AI quota policy is not configured.');
    const reservationId = `reserve_${randomUUID()}`;
    const reserved = db.tryReserveAiUsage({
      id: reservationId,
      actorId: permit.actorId,
      workspaceId: permit.workspaceId,
      operation,
      model: 'auto',
      source,
      requestId: permit.requestId,
      inputTokens: 0,
      outputTokens: 0,
      weightedUnits: estimatedUnits,
    }, quotaMonthlyUnits);
    if (!reserved) throw new AiQuotaExceededError();
    permit.reservationId = reservationId;
  }
  return permit;
}

export function assertAiQuota(context: RequestContext, db: OmniLinkDB, quotaMonthlyUnits: number, estimatedUnits = 1): void {
  if (context.mode === 'local-single-user') return;
  if (!Number.isFinite(quotaMonthlyUnits) || quotaMonthlyUnits <= 0) throw new Error('Multi-user AI quota policy is not configured.');
  const used = db.getAiUsageTotal(context.workspace.id, startOfCurrentMonth());
  if (used + estimatedUnits > quotaMonthlyUnits) throw new Error('AI usage quota exhausted.');
}

function buildPermit(context: RequestContext, req: Request, runtime: RuntimeConfig, db: OmniLinkDB): AiUsagePermit {
  return {
    actorId: context.actor.id,
    workspaceId: context.workspace.id,
    operation: operationFor(req),
    model: typeof req.body?.preferredModel === 'string' ? req.body.preferredModel : 'auto',
    source: context.authMethod === 'service-token' ? 'api-service-token' : 'browser',
    requestId: req.get('x-request-id') || randomUUID(),
    unlimited: runtime.mode === 'local',
    db,
    quotaMonthlyUnits: runtime.quotaMonthlyUnits ?? undefined,
  };
}

function isAiOperation(req: Request): boolean {
  // Read-only telemetry, usage, and status endpoints must remain available
  // when a workspace is exhausted; quota admission applies to work that can
  // invoke a provider or enqueue an AI job, not to inspecting its status.
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return false;
  if (req.endpointPolicy === 'ai:execute') return true;
  if (req.method === 'POST' && req.path.startsWith('/api/ai/') && req.path !== '/api/ai/route-preview') return true;
  if (req.path === '/api/share/quick') return true;
  // Saving a link without enrichment is a repository operation, not an AI
  // operation.  Do not reserve quota (or reject the save) in that mode.
  if (req.method === 'POST' && req.path === '/api/links') return req.body?.autoAiExtract !== false;
  if (req.method === 'PUT' && /^\/api\/links\/[^/]+$/.test(req.path)) return true;
  if (req.path.includes('/merge/')) return req.body?.autoAiExtract === true;
  if (req.path.includes('/rss/sync') || req.path.endsWith('/sync')) return true;
  if (req.method === 'POST' && req.path === '/api/rss/feeds') return req.body?.initialSync !== false;
  if (req.method === 'POST' && req.path === '/api/rss/opml/import') return req.body?.initialSync !== false;
  return false;
}

function operationFor(req: Request): string {
  if (req.path.includes('/embeddings')) return req.path.includes('/reindex') ? 'embedding-indexing' : 'embedding-query';
  if (req.path.includes('/ask')) return 'qa';
  if (req.path.includes('/cluster')) return 'clustering';
  if (req.path.includes('/rss/')) return 'rss-processing';
  if (req.path.includes('/suggest-tags')) return 'auto-tagging';
  return 'extraction';
}

function startOfCurrentMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function estimateTokens(characters: number): number {
  return Math.max(0, Math.ceil(characters / 4));
}

function estimateWeightedUnits(characters: number, model: string): number {
  return weightedTokens(Math.max(1, estimateTokens(characters)), model);
}

function weightedTokens(tokens: number, model: string): number {
  const normalized = model.toLowerCase();
  const weight = normalized.includes('pro') ? 3 : normalized.includes('flash-lite') ? 0.5 : 1;
  return tokens * weight;
}

function releaseReservation(permit: AiUsagePermit): void {
  if (permit.reservationId && !permit.reservationReleased) {
    permit.db.releaseAiUsageReservation(permit.reservationId);
    permit.reservationReleased = true;
  }
}
