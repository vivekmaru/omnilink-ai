import React, { useState } from 'react';
import {
  ExternalLink,
  Star,
  Clock,
  Github,
  MessageSquare,
  Instagram,
  Youtube,
  Twitter,
  FileText,
  Copy,
  Check,
  Code2,
  Quote,
  Sparkles,
  CheckCircle2,
  Circle,
  Rss,
} from 'lucide-react';
import { LinkItem, PlatformType } from '../types';

interface LinkListViewProps {
  links: LinkItem[];
  selectedIds: string[];
  onToggleSelectId: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onOpenDetail: (link: LinkItem) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
}

export const LinkListView: React.FC<LinkListViewProps> = ({
  links,
  selectedIds,
  onToggleSelectId,
  onSelectAll,
  onClearSelection,
  onOpenDetail,
  onToggleFavorite,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, id: string, url: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const getPlatformIcon = (platform: PlatformType) => {
    switch (platform) {
      case 'github':
        return <Github className="w-3.5 h-3.5 text-slate-400" />;
      case 'reddit_post':
      case 'reddit_comment':
        return <MessageSquare className="w-3.5 h-3.5 text-amber-500" />;
      case 'instagram_short':
        return <Instagram className="w-3.5 h-3.5 text-rose-500" />;
      case 'youtube':
        return <Youtube className="w-3.5 h-3.5 text-red-500" />;
      case 'twitter_x':
        return <Twitter className="w-3.5 h-3.5 text-sky-500" />;
      case 'paper':
        return <FileText className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />;
    }
  };

  const isAllSelected = links.length > 0 && selectedIds.length === links.length;

  return (
    <div
      className="border rounded-2xl overflow-hidden shadow-2xs"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/10 font-mono font-semibold uppercase tracking-wider text-[10px] text-slate-500 dark:text-slate-400">
            <tr>
              <th className="p-3.5 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={() => (isAllSelected ? onClearSelection() : onSelectAll())}
                  className="rounded border-slate-300 dark:border-white/20 text-[#d97757] focus:ring-0 cursor-pointer accent-[#d97757]"
                />
              </th>
              <th className="p-3.5 w-8"></th>
              <th className="p-3.5">Title & Summary</th>
              <th className="p-3.5 w-32">Category</th>
              <th className="p-3.5 w-36">Tags</th>
              <th className="p-3.5 w-28">Status</th>
              <th className="p-3.5 w-24 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
            {links.map((link) => {
              const isSelected = selectedIds.includes(link.id);
              return (
                <tr
                  key={link.id}
                  onClick={() => onOpenDetail(link)}
                  className={`group hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#d97757]/10 dark:bg-[#e08264]/10' : ''
                  }`}
                >
                  <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelectId(link.id)}
                      className="rounded border-slate-300 dark:border-white/20 text-[#d97757] focus:ring-0 cursor-pointer accent-[#d97757]"
                    />
                  </td>

                  <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onToggleFavorite(link.id, !!link.isFavorite)}
                      className="text-slate-400 hover:text-amber-500 dark:text-slate-500 dark:hover:text-amber-400 transition-colors"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          link.isFavorite ? 'fill-amber-400 text-amber-400' : ''
                        }`}
                      />
                    </button>
                  </td>

                  <td className="p-3.5 max-w-md">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">{getPlatformIcon(link.platform)}</div>
                      <div className="space-y-1 min-w-0">
                        <div className="font-newsreader text-base font-medium text-slate-900 dark:text-slate-100 group-hover:text-[#d97757] dark:group-hover:text-[#e08264] transition-colors truncate">
                          {link.title || link.url}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1">
                          {link.summary?.tldr || link.aiSummary?.tldr || link.description || 'Saved link'}
                        </div>

                        {/* Mini Insight Pills */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          {(link.isRssFeedItem || link.feedTitle) && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded font-medium">
                              <Rss className="w-2.5 h-2.5" /> {link.feedTitle || 'RSS'}
                            </span>
                          )}
                          {((link.summary?.codeSnippets && link.summary.codeSnippets.length > 0) ||
                            (link.aiSummary?.codeSnippets && link.aiSummary.codeSnippets.length > 0)) && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded font-medium">
                              <Code2 className="w-2.5 h-2.5" /> code
                            </span>
                          )}
                          {(link.summary?.quotes?.[0] || link.summary?.quote || link.aiSummary?.quote) && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] text-sky-700 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded font-medium">
                              <Quote className="w-2.5 h-2.5" /> quote
                            </span>
                          )}
                          {((link.summary?.keyTakeaways && link.summary.keyTakeaways.length > 0) ||
                            (link.aiSummary?.takeaways && link.aiSummary.takeaways.length > 0)) && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] text-[#c25e3e] dark:text-[#e08264] bg-[#d97757]/10 px-1.5 py-0.2 rounded font-semibold">
                              <Sparkles className="w-2.5 h-2.5" /> insights
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="p-3.5">
                    {link.category ? (
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-medium">
                        {link.category}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">—</span>
                    )}
                  </td>

                  <td className="p-3.5">
                    <div className="flex flex-wrap gap-1">
                      {link.tags?.slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 font-medium"
                        >
                          #{t}
                        </span>
                      ))}
                      {link.tags && link.tags.length > 2 && (
                        <span className="font-mono text-[10px] text-slate-400">
                          +{link.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="p-3.5">
                    {link.readStatus === 'read' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Reviewed
                      </span>
                    ) : link.readStatus === 'reading' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md">
                        <Circle className="w-1.5 h-1.5 fill-cyan-500 text-cyan-500" /> Reading
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                        <Circle className="w-1.5 h-1.5 fill-amber-500 text-amber-500" /> Unread
                      </span>
                    )}
                  </td>

                  <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => handleCopy(e, link.id, link.url)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        title="Copy Link URL"
                      >
                        {copiedId === link.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md text-slate-400 hover:text-[#d97757] dark:hover:text-[#e08264] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        title="Open Link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
