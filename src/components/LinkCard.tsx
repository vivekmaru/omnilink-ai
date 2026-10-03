import React, { useState } from 'react';
import {
  ExternalLink,
  Star,
  Github,
  MessageSquare,
  Instagram,
  Youtube,
  Twitter,
  FileText,
  Copy,
  Check,
  MoreVertical,
  Trash2,
  Archive,
  RotateCw,
  Folder,
  User,
  CheckCircle2,
  Circle,
  Rss,
} from 'lucide-react';
import { LinkItem, PlatformType, ReadStatus } from '../types';

interface LinkCardProps {
  link: LinkItem;
  isSelected?: boolean;
  onToggleSelect?: (id: string, e: React.MouseEvent) => void;
  selectionMode?: boolean;
  onSelect: (link: LinkItem) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onToggleArchive: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
  onReExtractAI?: (id: string) => void;
  onExportMarkdown?: (link: LinkItem) => void;
}

export const LinkCard: React.FC<LinkCardProps> = ({
  link,
  isSelected = false,
  onToggleSelect,
  selectionMode = false,
  onSelect,
  onToggleFavorite,
  onToggleArchive,
  onDelete,
  onReExtractAI,
  onExportMarkdown,
}) => {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(link.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(link.id, !!link.isFavorite);
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleArchive(link.id, !!link.isArchived);
    setMenuOpen(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(link.id);
    setMenuOpen(false);
  };

  const handleReExtract = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onReExtractAI) {
      onReExtractAI(link.id);
    }
    setMenuOpen(false);
  };

  // Platform metadata with disciplined neutral tones
  const getPlatformMeta = (platform: PlatformType) => {
    switch (platform) {
      case 'github':
        return {
          name: 'GitHub',
          icon: <Github className="w-3 h-3 text-slate-500 dark:text-slate-400" />,
        };
      case 'reddit_post':
      case 'reddit_comment':
        return {
          name: 'Reddit',
          icon: <MessageSquare className="w-3 h-3 text-slate-500 dark:text-slate-400" />,
        };
      case 'instagram_short':
        return {
          name: 'Instagram',
          icon: <Instagram className="w-3 h-3 text-slate-500 dark:text-slate-400" />,
        };
      case 'youtube':
        return {
          name: 'YouTube',
          icon: <Youtube className="w-3 h-3 text-slate-500 dark:text-slate-400" />,
        };
      case 'twitter_x':
        return {
          name: 'X / Twitter',
          icon: <Twitter className="w-3 h-3 text-slate-500 dark:text-slate-400" />,
        };
      case 'paper':
        return {
          name: 'Paper',
          icon: <FileText className="w-3 h-3 text-slate-500 dark:text-slate-400" />,
        };
      default:
        return {
          name: 'Article',
          icon: <FileText className="w-3 h-3 text-slate-500 dark:text-slate-400" />,
        };
    }
  };

  const platformMeta = getPlatformMeta(link.platform);

  // Status is a quiet dot; unread is the default, so only show it when it carries meaning
  const getStatusBadge = (status: ReadStatus) => {
    switch (status) {
      case 'read':
        return (
          <span title="Reviewed" aria-label="Reviewed" className="flex items-center px-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </span>
        );
      case 'reading':
        return (
          <span title="In progress" aria-label="In progress" className="flex items-center px-1.5">
            <span className="w-2 h-2 rounded-full bg-[#d97757] dark:bg-[#e08264]" />
          </span>
        );
      default:
        return (
          <span title="Unread" aria-label="Unread" className="flex items-center px-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500/80" />
          </span>
        );
    }
  };

  return (
    <div
      id={`link-card-${link.id}`}
      onClick={(e) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          e.preventDefault();
          if (onToggleSelect) {
            onToggleSelect(link.id, e);
            return;
          }
        }
        onSelect(link);
      }}
      className={`group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer bg-white dark:bg-[#18181b] ${
        isSelected
          ? 'ring-2 ring-[#d97757] dark:ring-[#e08264] border-[#d97757] dark:border-[#e08264] bg-[#d97757]/[0.03] dark:bg-[#e08264]/[0.04] shadow-md'
          : 'border-slate-200/80 dark:border-white/[0.07] hover:border-[#d97757]/50 dark:hover:border-[#e08264]/40 hover:shadow-md hover:-translate-y-0.5'
      } min-h-[170px] animate-card-entrance card-interactive ${
        link.isArchived ? 'opacity-60' : ''
      }`}
    >
      <div className="space-y-2.5 sm:space-y-3">
        {/* Card Header: Platform Tag & Clean Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Multi-Select Checkbox */}
            {onToggleSelect && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(link.id, e);
                }}
                className={`p-1 -ml-1.5 rounded-md transition-all cursor-pointer ${
                  isSelected
                    ? 'opacity-100 text-[#d97757] dark:text-[#e08264]'
                    : 'opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                } ${selectionMode ? '!opacity-100' : ''}`}
                title={isSelected ? 'Deselect bookmark' : 'Select bookmark for batch actions'}
                aria-label={isSelected ? 'Deselect bookmark' : 'Select bookmark for batch actions'}
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-[#d97757] dark:bg-[#e08264] border-[#d97757] dark:border-[#e08264] text-white shadow-2xs'
                      : 'border-slate-300 dark:border-white/30 bg-black/5 dark:bg-white/5 hover:border-[#d97757] dark:hover:border-[#e08264]'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </button>
            )}

            <span className="inline-flex items-center gap-1.5 text-[0.8rem] text-slate-500 dark:text-slate-400 min-w-0">
              {link.isRssFeedItem || link.feedTitle ? (
                <Rss className="w-3 h-3 shrink-0 text-slate-400" />
              ) : (
                platformMeta.icon
              )}
              <span className="truncate">{link.feedTitle || platformMeta.name}</span>
              {link.aiSummary?.estimatedReadTimeMinutes && (
                <span className="shrink-0 text-slate-400 dark:text-slate-500">
                  · {link.aiSummary.estimatedReadTimeMinutes} min read
                </span>
              )}
            </span>
          </div>

          {/* Top Right: Status Badge & Consistent Action Buttons */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {getStatusBadge(link.readStatus)}

            {/* Quick Actions Cluster (touch-friendly on mobile) */}
            <div className="flex items-center gap-0.5 ml-0.5">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hidden sm:block p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all"
                title="Open original URL in new tab"
                aria-label="Open original URL in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={handleStar}
                className={`p-1.5 rounded-lg transition-all ${
                  link.isFavorite
                    ? 'text-amber-400 bg-amber-500/10'
                    : 'text-slate-400 hover:text-amber-400 hover:bg-black/5 dark:hover:bg-white/5 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
                }`}
                title={link.isFavorite ? 'Remove Star' : 'Star Link'}
                aria-label={link.isFavorite ? 'Remove Star' : 'Star Link'}
              >
                <Star className={`w-3.5 h-3.5 ${link.isFavorite ? 'fill-current' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="hidden sm:block p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all"
                title="Copy URL"
                aria-label="Copy URL"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-all"
                  title="More Actions"
                  aria-label="More Actions"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-0 top-8 z-20 w-44 py-1.5 rounded-xl bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-white/10 shadow-xl text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={handleArchive}
                      className="w-full px-3 py-1.5 flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>{link.isArchived ? 'Unarchive' : 'Archive'}</span>
                    </button>
                    {onExportMarkdown && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onExportMarkdown(link);
                        }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Export Markdown</span>
                      </button>
                    )}
                    {onReExtractAI && (
                      <button
                        type="button"
                        onClick={handleReExtract}
                        className="w-full px-3 py-1.5 flex items-center gap-2 text-[#d97757] dark:text-[#e08264] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Re-extract AI</span>
                      </button>
                    )}
                    <div className="my-1 border-t border-slate-100 dark:border-white/5" />
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="w-full px-3 py-1.5 flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Serif Editorial Title */}
        <h3 className="font-newsreader text-xl font-medium leading-snug text-slate-900 dark:text-[#f7f6f3] group-hover:text-[#d97757] dark:group-hover:text-[#e08264] transition-colors line-clamp-2">
          {link.title || link.url}
        </h3>

        {/* Editorial Description */}
        <p className="text-[0.88rem] leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-3">
          {link.summary?.tldr || link.aiSummary?.tldr || link.description || 'No description available.'}
        </p>
      </div>
    </div>
  );
};
