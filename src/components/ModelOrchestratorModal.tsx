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
  ChevronRight,
} from 'lucide-react';
import {
  ModelOrchestratorStats,
  ModelRouteDecision,
  ModelTaskType,
  GeminiModelId,
} from '../types';

interface ModelOrchestratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModelOrchestratorModal: React.FC<ModelOrchestratorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [stats, setStats] = useState<ModelOrchestratorStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'matrix' | 'simulator' | 'telemetry'>('matrix');

  // Simulator Test State
  const [testUrl, setTestUrl] = useState('https://github.com/astral-sh/uv');
  const [testTask, setTestTask] = useState<ModelTaskType>('standard_extraction');
  const [testSnippet, setTestSnippet] = useState('High-performance Python package and project manager written in Rust.');
  const [simulatedDecision, setSimulatedDecision] = useState<ModelRouteDecision | null>(null);
  const [simulating, setSimulating] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/orchestrator-stats');
      if (res.ok) {
        const data = await res.json();
        if (data.stats) {
          setStats(data.stats);
        }
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
      runSimulator();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="model-orchestrator-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-orchestrator-modal-title"
        className="border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#d97757]/10 border border-[#d97757]/20 flex items-center justify-center text-[#d97757] dark:text-[#e08264]">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="model-orchestrator-modal-title" className="font-newsreader text-lg font-medium text-slate-900 dark:text-[#f7f6f3]">
                  Gemini Model Orchestration Layer
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Multi-Tier Router Active
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dynamically routes tasks between Flash-Lite, Flash 3.7 (Thinking), and Pro for optimal latency and accuracy.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-black/10 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.01]">
          <button
            id="orchestrator-tab-matrix"
            onClick={() => setActiveTab('matrix')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'matrix'
                ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264] font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Routing Matrix & Tiers
          </button>
          <button
            id="orchestrator-tab-simulator"
            onClick={() => setActiveTab('simulator')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'simulator'
                ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264] font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Live Route Simulator
          </button>
          <button
            id="orchestrator-tab-telemetry"
            onClick={() => setActiveTab('telemetry')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'telemetry'
                ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264] font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Execution Telemetry & Logs
            {stats && stats.totalRequests > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-black/10 dark:bg-white/10 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px]">
                {stats.totalRequests}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'matrix' && (
            <div className="space-y-6">
              {/* Architecture Tier Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tier 1: Fast Lite */}
                <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">
                        Tier 1 • Ultra-Fast
                      </span>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">~250-400ms</span>
                    </div>
                    <h3 className="text-sm font-semibold font-newsreader text-slate-900 dark:text-[#f7f6f3] mb-1">gemini-3.1-flash-lite</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                      Sub-second latency with low compute footprint. Optimized for real-time keystroke tag suggestions, URL metadata previews, and batch RSS feed parsing.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span>Target: Quick Metadata</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Cost: Minimal</span>
                  </div>
                </div>

                {/* Tier 2: Balanced Standard */}
                <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-[#d97757]/30 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#d97757]/5 rounded-full blur-xl pointer-events-none"></div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#d97757] dark:text-[#e08264] bg-[#d97757]/10 px-2 py-0.5 rounded border border-[#d97757]/20 font-semibold">
                        Tier 2 • Primary Standard
                      </span>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">~600-850ms</span>
                    </div>
                    <h3 className="text-sm font-semibold font-newsreader text-slate-900 dark:text-[#f7f6f3] mb-1">gemini-3.7-flash</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                      Gold standard for deep single-link extraction. Delivers structured 1-sentence TL;DRs, actionable takeaway bullets, code blocks, and quote extraction.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span>Target: Link Extraction</span>
                    <span className="text-[#d97757] dark:text-[#e08264] font-semibold">Precision: High</span>
                  </div>
                </div>

                {/* Tier 3: Deep Reasoning Pro */}
                <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-semibold">
                        Tier 3 • Deep Reasoning
                      </span>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">~1.2-2.0s</span>
                    </div>
                    <h3 className="text-sm font-semibold font-newsreader text-slate-900 dark:text-[#f7f6f3] mb-1">gemini-3.7-flash (Thinking: HIGH)</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                      Activated with high reasoning budget. Powers multi-link repository clustering, cross-citation RAG exploration, and complex technical comparisons.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span>Target: Clustering & Q&A</span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">Reasoning: Deep</span>
                  </div>
                </div>
              </div>

              {/* Failover and Routing Specification Matrix Table */}
              <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-[#f7f6f3]">
                    Dynamic Task Routing & Failover Matrix
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Automatic Step-Down Resilience
                  </div>
                </div>
                <div className="divide-y divide-black/5 dark:divide-white/5 text-xs">
                  <div className="p-3.5 grid grid-cols-12 gap-3 items-center hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <div className="col-span-3 font-medium text-slate-900 dark:text-[#f7f6f3] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Quick Metadata & Tags
                    </div>
                    <div className="col-span-3 font-mono text-emerald-600 dark:text-emerald-400">gemini-3.1-flash-lite</div>
                    <div className="col-span-4 text-slate-500 dark:text-slate-400">
                      Sub-second latency for instant pre-submission suggestions & batch tags.
                    </div>
                    <div className="col-span-2 font-mono text-[11px] text-slate-400 text-right">
                      → flash → latest
                    </div>
                  </div>

                  <div className="p-3.5 grid grid-cols-12 gap-3 items-center hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <div className="col-span-3 font-medium text-slate-900 dark:text-[#f7f6f3] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#d97757]"></span>
                      Standard Link Summaries
                    </div>
                    <div className="col-span-3 font-mono text-[#d97757] dark:text-[#e08264]">gemini-3.7-flash</div>
                    <div className="col-span-4 text-slate-500 dark:text-slate-400">
                      High-accuracy structured schema with TL;DR, bullets, and code blocks.
                    </div>
                    <div className="col-span-2 font-mono text-[11px] text-slate-400 text-right">
                      → latest → lite
                    </div>
                  </div>

                  <div className="p-3.5 grid grid-cols-12 gap-3 items-center hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <div className="col-span-3 font-medium text-slate-900 dark:text-[#f7f6f3] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Repository Clustering & Q&A
                    </div>
                    <div className="col-span-3 font-mono text-amber-600 dark:text-amber-400">
                      gemini-3.7-flash <span className="text-[10px] text-slate-400">(Thinking)</span>
                    </div>
                    <div className="col-span-4 text-slate-500 dark:text-slate-400">
                      Multi-hop knowledge synthesis over your full saved repository.
                    </div>
                    <div className="col-span-2 font-mono text-[11px] text-slate-400 text-right">
                      → latest → lite
                    </div>
                  </div>

                  <div className="p-3.5 grid grid-cols-12 gap-3 items-center hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <div className="col-span-3 font-medium text-slate-900 dark:text-[#f7f6f3] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#d97757]"></span>
                      RSS Batch Feed Ingestion
                    </div>
                    <div className="col-span-3 font-mono text-[#d97757] dark:text-[#e08264]">
                      gemini-3.1-flash-lite <span className="text-[10px] text-slate-400">(Batch)</span>
                    </div>
                    <div className="col-span-4 text-slate-500 dark:text-slate-400">
                      High-throughput stream processing of background RSS items.
                    </div>
                    <div className="col-span-2 font-mono text-[11px] text-slate-400 text-right">
                      → flash → latest
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'simulator' && (
            <div className="space-y-5">
              <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-[#f7f6f3] flex items-center gap-2 font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />
                    Interactive Route Evaluator
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Tests real-time scoring algorithm on the server
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 font-mono">
                      Task Type
                    </label>
                    <select
                      value={testTask}
                      onChange={(e) => setTestTask(e.target.value as ModelTaskType)}
                      className="w-full bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 text-slate-900 dark:text-[#f7f6f3] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#d97757]"
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
                      className="w-full bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 text-slate-900 dark:text-[#f7f6f3] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#d97757] font-mono"
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
                    className="w-full bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 text-slate-900 dark:text-[#f7f6f3] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#d97757] font-mono"
                  />
                </div>

                <button
                  id="orchestrator-eval-btn"
                  onClick={runSimulator}
                  disabled={simulating}
                  className="w-full py-2 bg-[#d97757] hover:bg-[#c46243] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 font-mono"
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
                    <p className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-[#1c1b18] p-3 rounded-lg border border-black/10 dark:border-white/10 leading-relaxed">
                      {simulatedDecision.reason}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mb-1.5 font-mono">
                      Failover Chain:
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {simulatedDecision.fallbackChain.map((model, idx) => (
                        <React.Fragment key={model}>
                          <span
                            className={`px-2.5 py-1 rounded text-xs font-mono border ${
                              idx === 0
                                ? 'bg-[#d97757]/10 border-[#d97757]/30 text-[#d97757] dark:text-[#e08264] font-semibold'
                                : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {idx + 1}. {model}
                          </span>
                          {idx < simulatedDecision.fallbackChain.length - 1 && (
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'telemetry' && (
            <div className="space-y-6">
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-mono">Total Routed Calls</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-[#f7f6f3] font-mono">
                    {stats?.totalRequests || 0}
                  </span>
                </div>
                <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-mono">Avg Execution Latency</span>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {stats?.avgLatencyMs || 480} ms
                  </span>
                </div>
                <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-mono">Success Rate</span>
                  <span className="text-lg font-bold text-[#d97757] dark:text-[#e08264] font-mono">
                    {stats && stats.totalRequests > 0
                      ? Math.round((stats.successCount / stats.totalRequests) * 100)
                      : 100}
                    %
                  </span>
                </div>
                <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-mono">Failovers Triggered</span>
                  <span className="text-lg font-bold text-slate-700 dark:text-slate-300 font-mono">
                    {stats?.fallbackCount || 0}
                  </span>
                </div>
              </div>

              {/* Execution Log Stream */}
              <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-[#f7f6f3]">
                    Live Execution Telemetry Trace
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Last {stats?.recentLogs?.length || 0} operations
                  </span>
                </div>

                <div className="divide-y divide-black/5 dark:divide-white/5 max-h-72 overflow-y-auto">
                  {stats && stats.recentLogs && stats.recentLogs.length > 0 ? (
                    stats.recentLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 grid grid-cols-12 gap-2 items-center text-xs hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="col-span-3 flex items-center gap-2">
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
                        <div className="col-span-3 text-right">
                          {log.fallbackUsed ? (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded text-[10px] font-mono">
                              Fallback ({log.fallbackHops} hops)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-mono">
                              Direct Tier 1
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No external AI calls logged in this session yet. Try asking Ask Repo AI, adding a link, or syncing RSS feeds to observe live orchestration!
                    </div>
                  )}
                </div>
              </div>
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
            className="px-4 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 rounded-lg font-mono font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
