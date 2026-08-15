import React, { useState } from 'react';
import {
  Network,
  Sparkles,
  RefreshCw,
  Tag,
  ArrowRight,
  Bookmark,
  Folder,
} from 'lucide-react';
import { ClusterGroup, LinkItem } from '../types';
import { ApiService } from '../services/api';

interface ClusterViewProps {
  links: LinkItem[];
  clusters: ClusterGroup[];
  onClustersUpdated: (clusters: ClusterGroup[]) => void;
  onOpenDetail: (link: LinkItem) => void;
}

export const ClusterView: React.FC<ClusterViewProps> = ({
  links,
  clusters,
  onClustersUpdated,
  onOpenDetail,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  const handleGenerateClusters = async () => {
    setLoading(true);
    try {
      const newClusters = await ApiService.fetchClusters();
      onClustersUpdated(newClusters);
      if (newClusters.length > 0) {
        setSelectedClusterId(newClusters[0].id);
      }
    } catch (e) {
      console.error('Failed to generate clusters:', e);
    } finally {
      setLoading(false);
    }
  };

  const activeCluster = clusters.find((c) => c.id === selectedClusterId) || clusters[0];
  const activeClusterLinks = activeCluster
    ? links.filter((l) => activeCluster.linkIds.includes(l.id))
    : [];

  return (
    <div className="space-y-6">
      {/* Header & Trigger */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border rounded-2xl shadow-2xs"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] flex items-center justify-center border border-[#d97757]/20">
              <Network className="w-4 h-4" />
            </div>
            <h3 className="font-newsreader text-xl font-medium text-slate-900 dark:text-[#f7f6f3]">
              AI Semantic Topic Clusters
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gemini 3.7 Flash analyzes links, summaries, and code snippets to discover high-level knowledge domains.
          </p>
        </div>

        <button
          id="btn-recluster-ai"
          onClick={handleGenerateClusters}
          disabled={loading || links.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-[#d97757] hover:bg-[#c46243] text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-all shrink-0 active:scale-[0.99]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{clusters.length > 0 ? 'Re-Cluster Repository' : 'Synthesize Topic Clusters'}</span>
        </button>
      </div>

      {loading && (
        <div
          className="p-16 text-center border rounded-2xl shadow-2xs"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <div className="w-8 h-8 border-2 border-[#d97757]/30 border-t-[#d97757] dark:border-t-[#e08264] rounded-full animate-spin mx-auto mb-4" />
          <div className="font-newsreader text-lg font-medium text-slate-900 dark:text-[#f7f6f3]">
            Synthesizing Knowledge Domains with Gemini 3.7 Flash...
          </div>
          <div className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-1">
            Correlating Reddit discussions, GitHub repos, reels, and research papers
          </div>
        </div>
      )}

      {!loading && clusters.length === 0 && (
        <div
          className="p-12 text-center border rounded-2xl space-y-4 max-w-md mx-auto shadow-2xs"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <div className="w-12 h-12 rounded-xl bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] flex items-center justify-center mx-auto border border-[#d97757]/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-newsreader text-lg font-medium text-slate-900 dark:text-[#f7f6f3]">
              No Semantic Clusters Generated Yet
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Click below to let Gemini analyze your repository and cluster items into intelligent thematic graphs.
            </p>
          </div>
          <button
            onClick={handleGenerateClusters}
            className="px-4 py-2 bg-[#d97757] hover:bg-[#c46243] text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
          >
            Run Topic Clustering
          </button>
        </div>
      )}

      {!loading && clusters.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cluster List / Selector */}
          <div className="space-y-3">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Knowledge Clusters ({clusters.length})
            </div>
            <div className="space-y-2">
              {clusters.map((c) => {
                const count = links.filter((l) => c.linkIds.includes(l.id)).length;
                const isSelected = (activeCluster?.id || clusters[0].id) === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedClusterId(c.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white dark:bg-[#1f1e1c] border-[#d97757] dark:border-[#e08264] shadow-xs ring-1 ring-[#d97757]/30'
                        : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/[0.06] hover:border-black/20 dark:hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className="font-newsreader text-base font-medium text-slate-900 dark:text-slate-100">
                        {c.title}
                      </h4>
                      <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                        {count} links
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-2.5">
                      {c.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {c.keywords.map((k) => (
                        <span
                          key={k}
                          className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[#d97757]/10 text-[#c25e3e] dark:text-[#e08264] font-medium"
                        >
                          #{k}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Cluster Deep Dive Content */}
          <div className="lg:col-span-2 space-y-4">
            {activeCluster && (
              <div
                className="border rounded-2xl p-6 shadow-2xs space-y-6"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--card-border)',
                }}
              >
                <div>
                  <div className="font-mono text-[11px] text-[#c25e3e] dark:text-[#e08264] font-semibold uppercase tracking-wider mb-1">
                    Active Cluster Focus
                  </div>
                  <h3 className="font-newsreader text-2xl font-medium text-slate-900 dark:text-slate-100">
                    {activeCluster.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                    {activeCluster.description}
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Links in this Domain ({activeClusterLinks.length})
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeClusterLinks.map((link) => (
                      <div
                        key={link.id}
                        onClick={() => onOpenDetail(link)}
                        className="p-3.5 rounded-xl bg-white dark:bg-[#1b1b1f] border border-slate-200 dark:border-white/10 hover:border-[#d97757] dark:hover:border-[#e08264] cursor-pointer transition-all space-y-2 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                            {link.platform.replace('_', ' ')}
                          </span>
                          <span className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                            {link.readStatus}
                          </span>
                        </div>
                        <h5 className="font-newsreader text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
                          {link.title || link.url}
                        </h5>
                        {(link.aiSummary?.tldr || link.description) && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                            {link.aiSummary?.tldr || link.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
