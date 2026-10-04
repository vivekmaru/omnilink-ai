import type { OmniLinkDB } from './db';
import type { ModelOrchestratorStats, OrchestrationExecutionTelemetry } from '../src/types';

/** Monthly workspace attempts survive restarts and never fall back to shared logs. */
export function getPersistedOrchestratorStats(
  db: OmniLinkDB,
  workspaceId: string,
  catalog: ModelOrchestratorStats,
  now = new Date(),
): ModelOrchestratorStats {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const usage = db.getAiUsage(workspaceId, monthStart)
    .filter((record) => record.status === 'completed' || record.status === 'failed');
  const modelBreakdown: Record<string, number> = {};
  const taskBreakdown: Record<string, number> = {};
  for (const record of usage) {
    modelBreakdown[record.model] = (modelBreakdown[record.model] || 0) + 1;
    taskBreakdown[record.operation] = (taskBreakdown[record.operation] || 0) + 1;
  }
  const successCount = usage.filter((record) => record.status === 'completed').length;
  return {
    telemetrySource: 'persisted-attempts',
    totalRequests: usage.length,
    successCount,
    failureCount: usage.length - successCount,
    // The ledger does not store timing, cost, or fallback-chain metadata.
    // Do not mix in another workspace's in-memory measurements.
    fallbackCount: 0,
    avgLatencyMs: 0,
    totalEstimatedCostUsd: 0,
    modelBreakdown,
    taskBreakdown,
    activeModels: catalog.activeModels.map((model) => ({
      ...model,
      usageCount: modelBreakdown[model.id] || 0,
      avgLatencyMs: 0,
      estimatedCostUsd: 0,
    })),
    recentLogs: usage.slice(0, 30).map((record) => ({
      id: record.id,
      timestamp: record.createdAt,
      taskType: record.operation as OrchestrationExecutionTelemetry['taskType'],
      requestedModel: record.model as OrchestrationExecutionTelemetry['requestedModel'],
      executedModel: record.model as OrchestrationExecutionTelemetry['executedModel'],
      latencyMs: 0,
      fallbackUsed: false,
      fallbackHops: 0,
      success: record.status === 'completed',
      tokenEstimate: record.inputTokens + record.outputTokens,
      targetUrlOrPrompt: '[redacted]',
      error: record.status === 'failed' ? 'Provider attempt failed.' : undefined,
    })),
  };
}
