import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Send,
  ArrowRight,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { AskRepoResponse, LinkItem, GeminiModelId } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';

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
}) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<GeminiModelId>('gemini-3.7-flash');
  const [response, setResponse] = useState<(AskRepoResponse & { orchestration?: any }) | null>(null);
  const [history, setHistory] = useState<{ q: string; a: AskRepoResponse; orch?: any }[]>([]);

  if (!isOpen) return null;

  const samplePrompts = [
    'Which of my saved links should I read first?',
    'Summarize the main ideas across my saved links',
    'What have I saved about databases?',
    'What are the key takeaways from my AI links?',
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
        answer: 'Something went wrong: ' + (e.message || 'Unknown error'),
        referencedLinkIds: [],
        suggestions: ['Try asking in a different way'],
      });
    } finally {
      setLoading(false);
    }
  };

  const getReferencedLinks = (ids: string[]) => {
    return links.filter((l) => ids.includes(l.id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        id="ask-repo-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-repo-modal-title"
        className="w-full max-w-3xl max-h-[85vh] border rounded-xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.08] dark:border-white/[0.08] shrink-0">
          <div>
            <h3 id="ask-repo-modal-title" className="text-base font-semibold text-slate-900 dark:text-ink">
              Ask AI
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Answers come from your {links.length} saved links
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat / Results Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Starter Suggestions */}
          {!response && history.length === 0 && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Try asking</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {samplePrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleAsk(prompt)}
                    className="text-left px-3.5 py-3 rounded-lg border border-black/[0.08] dark:border-white/[0.08] hover:border-black/20 dark:hover:border-white/20 text-sm text-slate-800 dark:text-slate-200 transition-colors flex items-start justify-between gap-3"
                  >
                    <span className="leading-relaxed">{prompt}</span>
                    <ArrowRight className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Current Active Response */}
          {response && (
            <div className="space-y-4 border border-black/[0.08] dark:border-white/[0.08] rounded-lg p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span>Answer</span>
                </div>
                {response.orchestration && (
                  <span className="text-slate-400 dark:text-slate-500">
                    {response.orchestration.model} · {(response.orchestration.latencyMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>

              <MarkdownRenderer
                content={response.answer}
                links={links}
                onOpenLinkDetail={onOpenLinkDetail}
              />

              {/* Referenced Link Cards & Retrieval Telemetry */}
              {response.referencedLinkIds && response.referencedLinkIds.length > 0 && (
                <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Sources
                    </span>
                    <span className="text-xs text-slate-400">
                      {response.referencedLinkIds.length} {response.referencedLinkIds.length === 1 ? 'link' : 'links'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {getReferencedLinks(response.referencedLinkIds).map((refLink) => {
                      const matchInfo = (response as any).retrieval?.topMatches?.find((m: any) => m.id === refLink.id);
                      return (
                        <div
                          key={refLink.id}
                          onClick={() => onOpenLinkDetail(refLink)}
                          className="p-3 border border-black/[0.08] dark:border-white/[0.08] rounded-lg hover:border-black/20 dark:hover:border-white/20 transition-colors cursor-pointer flex items-center justify-between gap-2 group"
                        >
                          <div className="truncate">
                            <div className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                              {refLink.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                              <span>{refLink.category}</span>
                              <span>•</span>
                              <span>{refLink.platform}</span>
                              {matchInfo?.vectorSimilarity && (
                                <>
                                  <span>•</span>
                                  <span>
                                    {Math.round(matchInfo.vectorSimilarity * 100)}% match
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Exploration Suggestions */}
              {response.suggestions && response.suggestions.length > 0 && (
                <div className="pt-3 border-t border-black/10 dark:border-white/10 space-y-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Ask next
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {response.suggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAsk(sug)}
                        className="text-left text-xs px-2.5 py-1 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        {sug}
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
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Earlier questions
              </div>
              {history.slice(1).map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setResponse(item.a as any)}
                  className="p-3.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] hover:border-black/20 dark:hover:border-white/20 space-y-1 text-sm cursor-pointer transition-colors"
                >
                  <div className="font-medium text-slate-900 dark:text-slate-100">{item.q}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{item.a.answer}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-black/[0.08] dark:border-white/[0.08] shrink-0">
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
              placeholder="Ask a question about your saved links"
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-surface border border-black/10 dark:border-white/10 rounded-md focus:outline-none focus:border-accent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-on-accent text-sm font-medium rounded-md disabled:opacity-50 transition-colors flex items-center gap-1.5 shrink-0"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Ask</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
