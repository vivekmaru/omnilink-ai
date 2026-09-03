import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Zap,
  Activity,
  ShieldCheck,
  RefreshCw,
  X,
  Layers,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  DollarSign,
  Code,
  Terminal,
} from 'lucide-react';
import {
  ModelOrchestratorStats,
  ModelRouteDecision,
  ModelTaskType,
  GeminiModelId,
} from '../types';
import { ApiService } from '../services/api';

interface ModelOrchestratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModelOrchestratorModal: React.FC<ModelOrchestratorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [stats, setStats] = useState<ModelOrchestratorStats | null>(null);
  const [aiUsage, setAiUsage] = useState<{ used: number; limit: number | null; remaining: number | null; resetAt?: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'models' | 'logs' | 'simulator'>('models');
  
  // Gated Developer Mode: can be enabled via localStorage or dev toggle
  // Simulator controls are development-only. They are intentionally not
  // enabled from localStorage, which would expose production tooling to users.
  const devMode = import.meta.env.DEV;

  // Simulator Test State (Only active in Dev Mode)
  const [testUrl, setTestUrl] = useState('https://github.com/astral-sh/uv');
  const [testTask, setTestTask] = useState<ModelTaskType>('standard_extraction');
  const [testSnippet, setTestSnippet] = useState('High-performance Python package and project manager written in Rust.');
  const [simulatedDecision, setSimulatedDecision] = useState<ModelRouteDecision | null>(null);
  const [simulating, setSimulating] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getOrchestratorStats();
      if (data) {
        setStats(data);
      }
      try {
        setAiUsage(await ApiService.getAiUsage());
      } catch {
        // Older servers may not expose usage yet; keep the dashboard usable.
        setAiUsage(null);
      }
    } catch (err) {
      console.error('Failed to fetch orchestrator telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    }
  }, [isOpen]);

  const runSimulator = async () => {
    setSimulating(true);
    try {
      const res = await fetch('/api/ai/route-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: testTask,
          url: testUrl,
          promptText: testSnippet,
          contentLength: testSnippet.length,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.decision) {
          setSimulatedDecision(data.decision);
        }
      }
    } catch (err) {
      console.error('Simulator error:', err);
    } finally {
      setSimulating(false);
    }
  };

  if (!isOpen) return null;

  const formatCost = (cost: number) => {
    if (!cost || cost === 0) return '$0.0000';
    if (cost < 0.0001) return '< $0.0001';
    return `$${cost.toFixed(4)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="model-orchestrator-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-orchestrator-modal-title"
        className="border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden bg-white dark:bg-[#18181b] text-slate-900 dark:text-[#f7f6f3]"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-[#d97757] dark:text-[#e08264]">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="model-orchestrator-modal-title" className="font-newsreader text-lg font-medium text-slate-900 dark:text-[#f7f6f3]">
                  Gemini Model Usage & Router
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Model utilization, estimated API cost, and dynamic task assignment
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {devMode && (
              <span className="px-2 py-1 rounded text-[10px] font-mono bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold" title="Development-only simulator tools are enabled">
                Developer tools
              </span>
            )}

            <button
              id="orchestrator-refresh-btn"
              onClick={fetchStats}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              id="orchestrator-close-btn"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Summary Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-black/10 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.01]">
          {aiUsage && (
            <div className="col-span-2 sm:col-span-4 p-3 rounded-xl bg-[#d97757]/10 border border-[#d97757]/20">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="uppercase tracking-wider text-slate-500 dark:text-slate-400">AI quota</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {aiUsage.used.toLocaleString()} used {aiUsage.limit === null ? '· Unlimited' : `of ${aiUsage.limit.toLocaleString()}`}
                </span>
              </div>
              {aiUsage.limit !== null && <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{Math.max(0, aiUsage.remaining ?? 0).toLocaleString()} units remaining{aiUsage.resetAt ? ` · resets ${new Date(aiUsage.resetAt).toLocaleDateString()}` : ''}</div>}
            </div>
          )}
          <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-0.5">Total AI Calls</span>
            <span className="text-base font-bold font-mono text-slate-900 dark:text-[#f7f6f3]">
              {stats?.totalRequests || 0}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-0.5">Est. API Cost</span>
            <span className="text-base font-bold font-mono text-[#d97757] dark:text-[#e08264]">
              {formatCost(stats?.totalEstimatedCostUsd || 0)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-0.5">Avg Latency</span>
            <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {stats?.avgLatencyMs || 480} ms
            </span>
          </div>

          <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-0.5">Success Rate</span>
            <span className="text-base font-bold font-mono text-slate-900 dark:text-[#f7f6f3]">
              {stats && stats.totalRequests > 0
                ? Math.round((stats.successCount / stats.totalRequests) * 100)
                : 100}
              %
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-2 border-b border-black/10 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.01] text-xs">
          <button
            id="orchestrator-tab-models"
            onClick={() => setActiveTab('models')}
            className={`pb-2.5 px-3 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'models'
                ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264] font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Model Usage & Triggers
          </button>

          <button
            id="orchestrator-tab-logs"
            onClick={() => setActiveTab('logs')}
            className={`pb-2.5 px-3 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264] font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Live Execution Logs
            {stats && stats.totalRequests > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded font-mono text-[10px]">
                {stats.totalRequests}
              </span>
            )}
          </button>

          {/* Gated Simulator Tab: Only visible in Dev Mode */}
          {devMode && (
            <button
              id="orchestrator-tab-simulator"
              onClick={() => setActiveTab('simulator')}
              className={`pb-2.5 px-3 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'simulator'
                  ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264] font-semibold'
                  : 'border-transparent text-amber-600/80 dark:text-amber-400/80 hover:text-amber-600'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Route Simulator (Dev)
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: Models, Triggers & Costs */}
          {activeTab === 'models' && (
            <div className="space-y-6">
              {/* Active Model Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-newsreader text-base font-semibold text-slate-900 dark:text-[#f7f6f3]">
                    Assigned Model Tiers & Spend Breakdown
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    Pricing based on Google GenAI rates
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {stats?.activeModels?.map((model) => {
                    const callCount = model.usageCount || 0;
                    const totalCalls = stats.totalRequests || 1;
                    const pct = Math.round((callCount / (stats.totalRequests || 1)) * 100);

                    return (
                      <div
                        key={model.id}
                        className="p-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex flex-col justify-between space-y-3"
                      >
                        <div>
                          {/* Top row: Model Name & Tier */}
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-xs font-bold text-slate-900 dark:text-[#f7f6f3] truncate">
                                {model.id}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-semibold shrink-0">
                              {model.tier}
                            </span>
                          </div>

                          {/* When this model is used */}
                          <div className="p-2.5 rounded-lg bg-white dark:bg-[#18181b] border border-black/5 dark:border-white/5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-2.5">
                            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#d97757] dark:text-[#e08264] mb-0.5 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>When OmniLink Uses This</span>
                            </div>
                            {model.whenUsed || model.role}
                          </div>
                        </div>

                        {/* Bottom Stats: Calls, Est Cost, Pricing, Latency */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-black/5 dark:border-white/5 text-[11px] font-mono">
                          <div>
                            <span className="text-slate-400 text-[10px] block">Calls</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {callCount} <span className="text-[10px] text-slate-400 font-normal">({stats.totalRequests > 0 ? pct : 0}%)</span>
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 text-[10px] block">Est. Cost</span>
                            <span className="font-semibold text-[#d97757] dark:text-[#e08264]">
                              {formatCost(model.estimatedCostUsd || 0)}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-slate-400 text-[10px] block">Avg Latency</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              ~{model.avgLatencyMs}ms
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Task Routing Matrix Guide */}
              <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-[#f7f6f3]">
                    Task Routing Rules & Failover Matrix
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Auto Fallback Protection
                  </div>
                </div>

                <div className="divide-y divide-black/5 dark:divide-white/5 text-xs">
                  <div className="p-3.5 grid grid-cols-12 gap-3 items-center hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <div className="col-span-4 font-medium text-slate-900 dark:text-[#f7f6f3] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Quick Metadata & Tags
                    </div>
                    <div className="col-span-4 font-mono text-emerald-600 dark:text-emerald-400 text-[11px]">
                      gemini-3.1-flash-lite
                    </div>
                    <div className="col-span-4 font-mono text-[11px] text-slate-400 text-right">
                      → flash → latest
                    </div>
                  </div>

                  <div className="p-3.5 grid grid-cols-12 gap-3 items-center hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <div className="col-span-4 font-medium text-slate-900 dark:text-[#f7f6f3] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#d97757]"></span>
                      Single Link Summaries
                    </div>
                    <div className="col-span-4 font-mono text-[#d97757] dark:text-[#e08264] text-[11px]">
                      gemini-3.7-flash
                    </div>
                    <div className="col-span-4 font-mono text-[11px] text-slate-400 text-right">
                      → latest → lite
                    </div>
                  </div>

                  <div className="p-3.5 grid grid-cols-12 gap-3 items-center hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <div className="col-span-4 font-medium text-slate-900 dark:text-[#f7f6f3] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Ask Repo AI & Clustering
                    </div>
                    <div className="col-span-4 font-mono text-amber-600 dark:text-amber-400 text-[11px]">
                      gemini-3.7-flash (Thinking)
                    </div>
                    <div className="col-span-4 font-mono text-[11px] text-slate-400 text-right">
                      → latest → lite
                    </div>
                  </div>

                  <div className="p-3.5 grid grid-cols-12 gap-3 items-center hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <div className="col-span-4 font-medium text-slate-900 dark:text-[#f7f6f3] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      RSS Batch Feed Ingestion
                    </div>
                    <div className="col-span-4 font-mono text-emerald-600 dark:text-emerald-400 text-[11px]">
                      gemini-3.1-flash-lite
                    </div>
                    <div className="col-span-4 font-mono text-[11px] text-slate-400 text-right">
                      → flash → latest
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Execution Logs */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-[#f7f6f3]">
                    Live AI Operation Trace
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Last {stats?.recentLogs?.length || 0} operations
                  </span>
                </div>

                <div className="divide-y divide-black/5 dark:divide-white/5 max-h-96 overflow-y-auto">
                  {stats && stats.recentLogs && stats.recentLogs.length > 0 ? (
                    stats.recentLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 grid grid-cols-12 gap-2 items-center text-xs hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="col-span-4 flex items-center gap-2">
                          {log.success ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          )}
                          <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate">
                            {log.taskType}
                          </span>
                        </div>
                        <div className="col-span-4 font-mono text-slate-500 dark:text-slate-400 text-[11px] truncate">
                          {log.executedModel}
                          {log.thinkingLevel && (
                            <span className="ml-1 text-[10px] text-amber-500 font-mono">
                              ({log.thinkingLevel})
                            </span>
                          )}
                        </div>
                        <div className="col-span-2 text-right font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                          {log.latencyMs} ms
                        </div>
                        <div className="col-span-2 text-right font-mono text-[11px] text-[#d97757] dark:text-[#e08264]">
                          {formatCost(log.estimatedCostUsd || 0)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-xs text-slate-400 space-y-1">
                      <Cpu className="w-6 h-6 mx-auto opacity-40 mb-2" />
                      <p className="font-medium text-slate-600 dark:text-slate-400">No external AI calls logged in this session yet.</p>
                      <p className="text-slate-400 text-[11px]">Calls made when adding links, asking Ask Repo AI, or syncing RSS feeds will appear here.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Route Simulator (Gated behind DEV_MODE) */}
          {devMode && activeTab === 'simulator' && (
            <div className="space-y-5">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                <strong>Developer Tool:</strong> This simulator allows you to test the heuristic complexity scoring algorithm against mock inputs.
              </div>

              <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 font-mono">
                      Task Type
                    </label>
                    <select
                      value={testTask}
                      onChange={(e) => setTestTask(e.target.value as ModelTaskType)}
                      className="w-full bg-white dark:bg-[#18181b] border border-black/10 dark:border-white/10 text-slate-900 dark:text-[#f7f6f3] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#d97757]"
                    >
                      <option value="quick_metadata">Quick Metadata / Title Preview</option>
                      <option value="auto_tagging">Smart Auto-Tagging & Suggestions</option>
                      <option value="standard_extraction">Standard Link Ingestion & Summary</option>
                      <option value="deep_reasoning">Repository Clustering & Ask Repo</option>
                      <option value="rss_ingestion">RSS Feed Item Ingestion</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 font-mono">
                      Sample URL
                    </label>
                    <input
                      type="text"
                      value={testUrl}
                      onChange={(e) => setTestUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-white dark:bg-[#18181b] border border-black/10 dark:border-white/10 text-slate-900 dark:text-[#f7f6f3] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#d97757] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 font-mono">
                    Content Excerpt / Prompt Context
                  </label>
                  <textarea
                    rows={2}
                    value={testSnippet}
                    onChange={(e) => setTestSnippet(e.target.value)}
                    placeholder="Enter context, code snippets, or user prompt..."
                    className="w-full bg-white dark:bg-[#18181b] border border-black/10 dark:border-white/10 text-slate-900 dark:text-[#f7f6f3] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#d97757] font-mono"
                  />
                </div>

                <button
                  id="orchestrator-eval-btn"
                  onClick={runSimulator}
                  disabled={simulating}
                  className="w-full py-2 bg-[#d97757] hover:bg-[#c46243] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 font-mono"
                >
                  {simulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  Evaluate Model Selection
                </button>
              </div>

              {simulatedDecision && (
                <div className="bg-black/[0.03] dark:bg-white/[0.03] border border-[#d97757]/30 rounded-xl p-5 space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Selected Model:</span>
                      <span className="px-2.5 py-0.5 bg-[#d97757]/10 border border-[#d97757]/20 text-[#d97757] dark:text-[#e08264] rounded-md font-mono text-xs font-semibold">
                        {simulatedDecision.selectedModel}
                      </span>
                      {simulatedDecision.thinkingLevel && (
                        <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded text-[10px] font-mono font-semibold">
                          Thinking: {simulatedDecision.thinkingLevel}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Complexity Score:</span>
                      <span className="px-2 py-0.5 bg-black/10 dark:bg-white/10 text-slate-800 dark:text-slate-200 font-mono text-xs font-medium rounded">
                        {simulatedDecision.complexityScore} / 100 ({simulatedDecision.complexityTier})
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mb-1 font-mono">
                      Routing Rationale:
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-[#18181b] p-3 rounded-lg border border-black/10 dark:border-white/10 leading-relaxed">
                      {simulatedDecision.reason}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Adaptive Orchestration Engine Online</span>
          </div>
          <button
            id="orchestrator-done-btn"
            onClick={onClose}
            className="px-4 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 rounded-xl font-mono font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
