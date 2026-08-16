import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  GeminiModelId,
  ModelRouteDecision,
  ModelTaskType,
  ModelThinkingLevel,
  OrchestrationExecutionTelemetry,
  ModelOrchestratorStats,
  PlatformType,
} from '../src/types';

// =========================================================================
// OmniLink Intelligent Multi-Tier Gemini Model Orchestration & Router Engine
// =========================================================================

export interface RouteRequestOptions {
  taskType: ModelTaskType;
  url?: string;
  platform?: PlatformType;
  promptText?: string;
  contentLength?: number;
  itemCount?: number;
  hasCodeSnippets?: boolean;
  isBatchOperation?: boolean;
  preferredModel?: GeminiModelId;
  forceThinking?: boolean;
}

export interface OrchestrationResult<T = any> {
  data: T | null;
  rawText: string | null;
  executedModel: GeminiModelId;
  requestedModel: GeminiModelId;
  fallbackUsed: boolean;
  fallbackHops: number;
  latencyMs: number;
  thinkingLevel?: string;
  error?: string;
}

export class ModelOrchestrator {
  private static telemetryLogs: OrchestrationExecutionTelemetry[] = [];
  private static readonly MAX_LOGS = 100;
  private static modelStats: Record<string, { requests: number; errors: number; totalLatencyMs: number; fallbacks: number }> = {
    'gemini-3.1-flash-lite': { requests: 0, errors: 0, totalLatencyMs: 0, fallbacks: 0 },
    'gemini-3.7-flash': { requests: 0, errors: 0, totalLatencyMs: 0, fallbacks: 0 },
    'gemini-flash-latest': { requests: 0, errors: 0, totalLatencyMs: 0, fallbacks: 0 },
    'gemini-3.1-pro-preview': { requests: 0, errors: 0, totalLatencyMs: 0, fallbacks: 0 },
  };

  /**
   * Analyze task context, input characteristics, and complexity score to determine
   * the optimal Gemini model tier and thinking level.
   */
  static routeRequest(options: RouteRequestOptions): ModelRouteDecision {
    const {
      taskType,
      url = '',
      platform,
      promptText = '',
      contentLength = promptText.length,
      itemCount = 1,
      hasCodeSnippets = false,
      isBatchOperation = false,
      preferredModel,
      forceThinking = false,
    } = options;

    if (preferredModel) {
      return {
        taskType,
        selectedModel: preferredModel,
        reason: 'User manual override or explicit model preference requested.',
        complexityScore: 50,
        complexityTier: 'Medium (Standard)',
        fallbackChain: this.getFallbackChain(preferredModel),
        isCustomOverride: true,
      };
    }

    // 1. Calculate Content & Structural Complexity Score (0 - 100)
    let score = 20;

    // Platform weight
    if (platform === 'paper' || url.includes('arxiv.org') || url.includes('biorxiv.org')) {
      score += 40;
    } else if (platform === 'github' || url.includes('github.com')) {
      score += 30;
    } else if (platform === 'reddit_post' || platform === 'reddit_comment') {
      score += 25;
    } else if (platform === 'youtube' || platform === 'article') {
      score += 20;
    } else if (platform === 'instagram_short' || platform === 'twitter_x') {
      score += 10;
    }

    // Length weight
    if (contentLength > 10000 || itemCount > 10) {
      score += 35;
    } else if (contentLength > 3000 || itemCount > 4) {
      score += 20;
    } else if (contentLength < 400 && itemCount === 1) {
      score -= 10;
    }

    // Code snippets or mathematical content
    if (hasCodeSnippets || promptText.includes('```') || promptText.includes('function') || promptText.includes('class ')) {
      score += 20;
    }

    score = Math.max(5, Math.min(100, score));

    // 2. Select Model and Configuration based on Matrix
    switch (taskType) {
      case 'quick_metadata':
      case 'auto_tagging':
        return {
          taskType,
          selectedModel: 'gemini-3.1-flash-lite',
          reason: 'Ultra-fast sub-second execution, lowest latency, and high cost-efficiency for quick metadata & real-time auto-tagging.',
          complexityScore: Math.min(score, 40),
          complexityTier: 'Low (Lite)',
          thinkingLevel: 'MINIMAL',
          fallbackChain: ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-flash-latest'],
        };

      case 'rss_ingestion':
        if (isBatchOperation || score < 45) {
          return {
            taskType,
            selectedModel: 'gemini-3.1-flash-lite',
            reason: 'High-throughput batch RSS feed parsing with ultra-fast latency.',
            complexityScore: score,
            complexityTier: 'Low (Lite)',
            thinkingLevel: 'MINIMAL',
            fallbackChain: ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-flash-latest'],
          };
        }
        return {
          taskType,
          selectedModel: 'gemini-3.7-flash',
          reason: 'Deep RSS article extraction requiring structured key takeaways and code formatting.',
          complexityScore: score,
          complexityTier: 'Medium (Standard)',
          fallbackChain: ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
        };

      case 'deep_reasoning':
        return {
          taskType,
          selectedModel: 'gemini-3.7-flash',
          reason: 'Multi-hop repository clustering and cross-citation conversational reasoning with ThinkingLevel.HIGH.',
          complexityScore: Math.max(score, 80),
          complexityTier: 'High (Deep Reasoning)',
          thinkingLevel: 'HIGH',
          fallbackChain: ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
        };

      case 'standard_extraction':
      default:
        if (score < 30 && !hasCodeSnippets) {
          return {
            taskType,
            selectedModel: 'gemini-3.1-flash-lite',
            reason: 'Lightweight short content routed to Flash-Lite for instant response.',
            complexityScore: score,
            complexityTier: 'Low (Lite)',
            thinkingLevel: 'MINIMAL',
            fallbackChain: ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-flash-latest'],
          };
        }

        return {
          taskType,
          selectedModel: 'gemini-3.7-flash',
          reason: 'Superior balance of speed, extraction accuracy, and structured JSON formatting for link summaries.',
          complexityScore: score,
          complexityTier: 'Medium (Standard)',
          thinkingLevel: forceThinking ? 'HIGH' : undefined,
          fallbackChain: ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
        };
    }
  }

  /**
   * Returns an ordered fallback chain for any model
   */
  private static getFallbackChain(initialModel: GeminiModelId): GeminiModelId[] {
    const chain: GeminiModelId[] = [initialModel];
    const candidatePool: GeminiModelId[] = [
      'gemini-3.7-flash',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite',
    ];

    for (const m of candidatePool) {
      if (!chain.includes(m)) {
        chain.push(m);
      }
    }
    return chain;
  }

  /**
   * Execute a structured Gemini prompt with multi-tier routing, adaptive thinking level,
   * exponential backoff, and automatic fallback.
   */
  static async executeStructuredPrompt<T = any>(
    ai: GoogleGenAI | null,
    options: RouteRequestOptions,
    prompt: string,
    schemaConfig?: any,
    systemInstruction?: string
  ): Promise<OrchestrationResult<T>> {
    const startTime = Date.now();
    const decision = this.routeRequest(options);
    const telemetryId = `orch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    if (!ai) {
      const duration = Date.now() - startTime;
      this.recordTelemetry({
        id: telemetryId,
        timestamp: new Date().toISOString(),
        taskType: options.taskType,
        requestedModel: decision.selectedModel,
        executedModel: decision.selectedModel,
        latencyMs: duration,
        fallbackUsed: false,
        fallbackHops: 0,
        success: false,
        error: 'Gemini API client not initialized or GEMINI_API_KEY missing.',
        targetUrlOrPrompt: options.url || prompt.slice(0, 100),
      });

      return {
        data: null,
        rawText: null,
        executedModel: decision.selectedModel,
        requestedModel: decision.selectedModel,
        fallbackUsed: false,
        fallbackHops: 0,
        latencyMs: duration,
        error: 'Missing API Key',
      };
    }

    const fallbackChain = decision.fallbackChain;
    let lastError: string | null = null;
    let fallbackHops = 0;

    for (let i = 0; i < fallbackChain.length; i++) {
      const currentModel = fallbackChain[i];
      const isFallback = i > 0;
      if (isFallback) {
        fallbackHops++;
      }

      // Max 2 retry attempts per model tier
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const configObj: any = {
            ...(schemaConfig
              ? {
                  responseMimeType: 'application/json',
                  responseSchema: schemaConfig,
                }
              : {}),
            ...(systemInstruction ? { systemInstruction } : {}),
          };

          // Apply Thinking Level if applicable (Gemini 3 series)
          if (decision.thinkingLevel && (currentModel === 'gemini-3.7-flash' || currentModel === 'gemini-3.1-flash-lite')) {
            if (decision.thinkingLevel === 'HIGH' && currentModel === 'gemini-3.7-flash') {
              configObj.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
            } else if (decision.thinkingLevel === 'LOW') {
              configObj.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
            } else if (decision.thinkingLevel === 'MINIMAL') {
              configObj.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
            }
          }

          const response = await ai.models.generateContent({
            model: currentModel,
            contents: prompt,
            config: configObj,
          });

          const rawText = response?.text || null;
          let parsedData: T | null = null;

          if (rawText) {
            if (schemaConfig) {
              try {
                parsedData = JSON.parse(rawText) as T;
              } catch (parseErr) {
                // If model returned slightly wrapped JSON or markdown block
                const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
                parsedData = JSON.parse(cleaned) as T;
              }
            }
          }

          const latencyMs = Date.now() - startTime;
          const estimatedCost = ModelOrchestrator.calculateCost(currentModel, prompt.length, rawText?.length || 0);

          // Record success telemetry
          this.recordTelemetry({
            id: telemetryId,
            timestamp: new Date().toISOString(),
            taskType: options.taskType,
            requestedModel: decision.selectedModel,
            executedModel: currentModel,
            latencyMs,
            fallbackUsed: isFallback,
            fallbackHops,
            thinkingLevel: decision.thinkingLevel,
            success: true,
            estimatedCostUsd: estimatedCost,
            targetUrlOrPrompt: options.url || prompt.slice(0, 100),
          });

          return {
            data: parsedData,
            rawText,
            executedModel: currentModel,
            requestedModel: decision.selectedModel,
            fallbackUsed: isFallback,
            fallbackHops,
            latencyMs,
            thinkingLevel: decision.thinkingLevel,
          };
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          const errStatus = err?.status || err?.code || '';
          lastError = errMsg;

          const isTransient =
            errMsg.includes('503') ||
            errMsg.includes('high demand') ||
            errMsg.includes('UNAVAILABLE') ||
            errMsg.includes('429') ||
            errMsg.includes('RESOURCE_EXHAUSTED') ||
            errStatus === 503 ||
            errStatus === 429;

          console.warn(
            `[Model Orchestrator] ${currentModel} (attempt ${attempt + 1}/${2}) for ${options.taskType}:`,
            errMsg
          );

          if (isTransient && attempt === 0) {
            // Exponential backoff with random jitter before retry
            await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 400));
            continue;
          }

          // Step down to next model in fallback chain
          break;
        }
      }
    }

    const totalLatency = Date.now() - startTime;
    this.recordTelemetry({
      id: telemetryId,
      timestamp: new Date().toISOString(),
      taskType: options.taskType,
      requestedModel: decision.selectedModel,
      executedModel: fallbackChain[fallbackChain.length - 1],
      latencyMs: totalLatency,
      fallbackUsed: true,
      fallbackHops,
      thinkingLevel: decision.thinkingLevel,
      success: false,
      estimatedCostUsd: 0,
      error: lastError || 'All models in fallback chain failed.',
      targetUrlOrPrompt: options.url || prompt.slice(0, 100),
    });

    return {
      data: null,
      rawText: null,
      executedModel: fallbackChain[fallbackChain.length - 1],
      requestedModel: decision.selectedModel,
      fallbackUsed: true,
      fallbackHops,
      latencyMs: totalLatency,
      error: lastError || 'Orchestration execution failed across all tiers.',
    };
  }

  /**
   * Approximate cost in USD for a given Gemini call based on published Google GenAI token pricing
   */
  private static calculateCost(model: GeminiModelId, inputChars: number, outputChars: number): number {
    const inputTokens = Math.ceil(inputChars / 4);
    const outputTokens = Math.ceil(outputChars / 4);

    switch (model) {
      case 'gemini-3.1-flash-lite':
        // Input: $0.075 / 1M tokens, Output: $0.30 / 1M tokens
        return (inputTokens * 0.075 + outputTokens * 0.30) / 1_000_000;
      case 'gemini-3.7-flash':
      case 'gemini-flash-latest':
        // Input: $0.15 / 1M tokens, Output: $0.60 / 1M tokens
        return (inputTokens * 0.15 + outputTokens * 0.60) / 1_000_000;
      case 'gemini-3.1-pro-preview':
        // Input: $1.25 / 1M tokens, Output: $5.00 / 1M tokens
        return (inputTokens * 1.25 + outputTokens * 5.00) / 1_000_000;
      default:
        return 0.0002;
    }
  }

  /**
   * Record telemetry entry & update aggregate stats
   */
  private static recordTelemetry(entry: OrchestrationExecutionTelemetry) {
    this.telemetryLogs.unshift(entry);
    if (this.telemetryLogs.length > this.MAX_LOGS) {
      this.telemetryLogs.pop();
    }

    const stat = this.modelStats[entry.executedModel];
    if (stat) {
      stat.requests++;
      stat.totalLatencyMs += entry.latencyMs;
      if (!entry.success) stat.errors++;
      if (entry.fallbackUsed) stat.fallbacks++;
    }
  }

  /**
   * Fetch current system metrics, active tiers, and recent execution trace logs
   */
  static getStats(): ModelOrchestratorStats {
    let totalReqs = 0;
    let totalLatency = 0;
    let totalFails = 0;
    let totalFallbacks = 0;
    let totalCostUsd = 0;
    const modelBreakdown: Record<string, number> = {};
    const taskBreakdown: Record<string, number> = {};
    const modelCostBreakdown: Record<string, number> = {};

    for (const log of this.telemetryLogs) {
      totalReqs++;
      totalLatency += log.latencyMs;
      if (!log.success) totalFails++;
      if (log.fallbackUsed) totalFallbacks++;

      const cost = log.estimatedCostUsd || 0;
      totalCostUsd += cost;
      modelCostBreakdown[log.executedModel] = (modelCostBreakdown[log.executedModel] || 0) + cost;

      modelBreakdown[log.executedModel] = (modelBreakdown[log.executedModel] || 0) + 1;
      taskBreakdown[log.taskType] = (taskBreakdown[log.taskType] || 0) + 1;
    }

    const activeModels: ModelOrchestratorStats['activeModels'] = [
      {
        id: 'gemini-3.1-flash-lite',
        name: 'Gemini 3.1 Flash Lite',
        role: 'Quick Metadata, Real-Time Tagging & Batch RSS Ingestion',
        whenUsed: 'Triggered for instant URL previews, real-time tag auto-suggestions, and high-throughput RSS background feed parsing.',
        tier: 'Fast Lite',
        status: (this.modelStats['gemini-3.1-flash-lite']?.errors || 0) > 3 ? 'degraded' : 'healthy',
        usageCount: modelBreakdown['gemini-3.1-flash-lite'] || 0,
        estimatedCostUsd: modelCostBreakdown['gemini-3.1-flash-lite'] || 0,
        costPer1kTokens: '$0.0001 / 1k tokens',
        avgLatencyMs:
          (this.modelStats['gemini-3.1-flash-lite']?.requests || 0) > 0
            ? Math.round(
                this.modelStats['gemini-3.1-flash-lite'].totalLatencyMs /
                  this.modelStats['gemini-3.1-flash-lite'].requests
              )
            : 320,
      },
      {
        id: 'gemini-3.7-flash',
        name: 'Gemini 3.7 Flash',
        role: 'Standard Link Extraction, Summaries & Deep Thinking RAG',
        whenUsed: 'Triggered for single link deep extraction, structured TL;DR summaries, key takeaway bullets, code blocks, and Ask Repo conversational queries.',
        tier: 'Balanced Flash',
        status: (this.modelStats['gemini-3.7-flash']?.errors || 0) > 3 ? 'degraded' : 'healthy',
        usageCount: modelBreakdown['gemini-3.7-flash'] || 0,
        estimatedCostUsd: modelCostBreakdown['gemini-3.7-flash'] || 0,
        costPer1kTokens: '$0.00025 / 1k tokens',
        avgLatencyMs:
          (this.modelStats['gemini-3.7-flash']?.requests || 0) > 0
            ? Math.round(
                this.modelStats['gemini-3.7-flash'].totalLatencyMs /
                  this.modelStats['gemini-3.7-flash'].requests
              )
            : 740,
      },
      {
        id: 'gemini-flash-latest',
        name: 'Gemini Flash Latest',
        role: 'High-Demand & Failover Secondary Tier',
        whenUsed: 'Triggered automatically as a resilient secondary fallback when primary Flash instances encounter temporary rate limits or 503 load.',
        tier: 'Balanced Flash',
        status: 'standby',
        usageCount: modelBreakdown['gemini-flash-latest'] || 0,
        estimatedCostUsd: modelCostBreakdown['gemini-flash-latest'] || 0,
        costPer1kTokens: '$0.00025 / 1k tokens',
        avgLatencyMs:
          (this.modelStats['gemini-flash-latest']?.requests || 0) > 0
            ? Math.round(
                this.modelStats['gemini-flash-latest'].totalLatencyMs /
                  this.modelStats['gemini-flash-latest'].requests
              )
            : 680,
      },
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro Preview',
        role: 'Advanced Multi-Document Synthesis & Mathematical Logic',
        whenUsed: 'Triggered for complex multi-repository clustering, research paper cross-citation extraction, and advanced reasoning tasks.',
        tier: 'Deep Reasoning Pro',
        status: 'healthy',
        usageCount: modelBreakdown['gemini-3.1-pro-preview'] || 0,
        estimatedCostUsd: modelCostBreakdown['gemini-3.1-pro-preview'] || 0,
        costPer1kTokens: '$0.0025 / 1k tokens',
        avgLatencyMs:
          (this.modelStats['gemini-3.1-pro-preview']?.requests || 0) > 0
            ? Math.round(
                this.modelStats['gemini-3.1-pro-preview'].totalLatencyMs /
                  this.modelStats['gemini-3.1-pro-preview'].requests
              )
            : 1420,
      },
    ];

    return {
      totalRequests: totalReqs,
      successCount: totalReqs - totalFails,
      failureCount: totalFails,
      fallbackCount: totalFallbacks,
      avgLatencyMs: totalReqs > 0 ? Math.round(totalLatency / totalReqs) : 480,
      totalEstimatedCostUsd: totalCostUsd,
      modelBreakdown,
      taskBreakdown,
      activeModels,
      recentLogs: this.telemetryLogs.slice(0, 30),
    };
  }
}
