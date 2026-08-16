import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Send,
  BookOpen,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  Bookmark,
  Lightbulb,
  Cpu,
  Zap,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { AskRepoResponse, LinkItem, GeminiModelId } from '../types';

interface AskRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  links: LinkItem[];
  onOpenLinkDetail: (link: LinkItem) => void;
  onOpenModelOrchestrator?: () => void;
}

export const AskRepoModal: React.FC<AskRepoModalProps> = ({
  isOpen,
  onClose,
  links,
  onOpenLinkDetail,
  onOpenModelOrchestrator,
}) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<GeminiModelId>('gemini-3.7-flash');
  const [response, setResponse] = useState<(AskRepoResponse & { orchestration?: any }) | null>(null);
  const [history, setHistory] = useState<{ q: string; a: AskRepoResponse; orch?: any }[]>([]);

  if (!isOpen) return null;

  const samplePrompts = [
    'What GitHub projects do I have for UI components & LLM agents?',
    'Summarize all Reddit database tips and SQLite best practices saved',
    'What Instagram shorts or desk setup productivity tricks do I have?',
    'Synthesize key takeaways across all my AI & machine learning bookmarks',
  ];

  const handleAsk = async (queryText: string) => {
    if (!queryText.trim() || loading) return;
    setLoading(true);
    setResponse(null);

    try {
      const res = await ApiService.askRepository(queryText, selectedTier);
      setResponse(res as any);
      setHistory((prev) => [{ q: queryText, a: res, orch: (res as any).orchestration }, ...prev]);
      setQuestion('');
    } catch (e: any) {
      setResponse({
        answer: 'Failed to process inquiry: ' + (e.message || 'Unknown error'),
        referencedLinkIds: [],
        suggestions: ['Try rephrasing your search query'],
      });
    } finally {
      setLoading(false);
    }
  };

  const getReferencedLinks = (ids: string[]) => {
    return links.filter((l) => ids.includes(l.id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        id="ask-repo-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-repo-modal-title"
        className="w-full max-w-3xl max-h-[85vh] border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10 shrink-0 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] flex items-center justify-center border border-[#d97757]/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="ask-repo-modal-title" className="font-newsreader text-lg font-medium text-slate-900 dark:text-[#f7f6f3]">
                  Ask Your Saved Repository
                </h3>
                {onOpenModelOrchestrator && (
                  <button
                    onClick={onOpenModelOrchestrator}
                    className="flex items-center gap-1 font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] hover:bg-[#d97757]/20 transition-colors border border-[#d97757]/20"
                    title="View Model Orchestration Architecture & Telemetry"
                  >
                    <Cpu className="w-3 h-3" />
                    <span>Gemini 3.7 Flash • Thinking HIGH</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Grounded conversational synthesis across {links.length} bookmarks & notes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat / Results Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Starter Suggestions */}
          {!response && history.length === 0 && (
            <div className="space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5 font-semibold">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                <span>Suggested Knowledge Queries</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {samplePrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleAsk(prompt)}
                    className="text-left p-3.5 rounded-xl border border-black/10 dark:border-white/10 hover:border-[#d97757]/40 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-[#d97757]/5 text-xs text-slate-800 dark:text-slate-200 transition-all flex items-start justify-between gap-3 group"
                  >
                    <span className="leading-relaxed">{prompt}</span>
                    <ArrowRight className="w-4 h-4 shrink-0 text-[#d97757] dark:text-[#e08264] opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all mt-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Current Active Response */}
          {response && (
            <div className="space-y-4 bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs font-semibold text-[#d97757] dark:text-[#e08264] uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>AI Repository Synthesis</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(response as any).retrieval && (
                    <span className="text-[10px] normal-case text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <span>Hybrid RAG (FTS5 + text-embedding-004)</span>
                    </span>
                  )}
                  {response.orchestration && (
                    <span className="text-[10px] normal-case text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-1 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded border border-black/5 dark:border-white/5">
                      <Zap className="w-3 h-3 text-amber-500" />
                      {response.orchestration.model} ({response.orchestration.latencyMs}ms)
                    </span>
                  )}
                </div>
              </div>

              <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {response.answer}
              </div>

              {/* Referenced Link Cards & Retrieval Telemetry */}
              {response.referencedLinkIds && response.referencedLinkIds.length > 0 && (
                <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
                      Referenced Knowledge Sources:
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {response.referencedLinkIds.length} items cited
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {getReferencedLinks(response.referencedLinkIds).map((refLink) => {
                      const matchInfo = (response as any).retrieval?.topMatches?.find((m: any) => m.id === refLink.id);
                      return (
                        <div
                          key={refLink.id}
                          onClick={() => onOpenLinkDetail(refLink)}
                          className="p-3 bg-white dark:bg-[#18181b] border border-black/10 dark:border-white/10 rounded-xl hover:border-[#d97757]/40 transition-colors cursor-pointer flex items-center justify-between gap-2 group"
                        >
                          <div className="truncate">
                            <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate font-newsreader group-hover:text-[#d97757] dark:group-hover:text-[#e08264] transition-colors">
                              {refLink.title}
                            </div>
                            <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                              <span>{refLink.category}</span>
                              <span>•</span>
                              <span>{refLink.platform}</span>
                              {matchInfo?.vectorSimilarity && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-500">
                                    {Math.round(matchInfo.vectorSimilarity * 100)}% match
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264] shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Exploration Suggestions */}
              {response.suggestions && response.suggestions.length > 0 && (
                <div className="pt-3 border-t border-black/10 dark:border-white/10 space-y-2">
                  <span className="font-mono text-[10px] uppercase text-slate-400 font-semibold tracking-wider">
                    Follow-Up Deep Dives:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {response.suggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAsk(sug)}
                        className="text-left text-[11px] px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-[#d97757]/10 text-slate-700 dark:text-slate-300 hover:text-[#d97757] dark:hover:text-[#e08264] border border-black/5 dark:border-white/5 transition-colors"
                      >
                        {sug} &rarr;
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Past Query History */}
          {history.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
                Previous Inquiries
              </div>
              {history.slice(1).map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 space-y-1.5 text-xs"
                >
                  <div className="font-semibold text-slate-900 dark:text-slate-100">Q: {item.q}</div>
                  <div className="text-slate-600 dark:text-slate-400 line-clamp-2">{item.a.answer}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(question);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about your saved links, code snippets, or notes..."
              className="flex-1 px-4 py-2.5 text-xs bg-white dark:bg-[#18181b] border border-black/10 dark:border-white/10 rounded-xl focus:outline-none focus:border-[#d97757] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 font-mono transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="px-5 py-2.5 bg-[#d97757] hover:bg-[#c46243] dark:bg-[#e08264] dark:hover:bg-[#e9957a] text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0 active:scale-[0.98]"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Synthesize</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
