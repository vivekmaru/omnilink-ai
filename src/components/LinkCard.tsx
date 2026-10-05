import React, { useEffect, useRef, useState } from 'react';
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
  MoreHorizontal,
  CheckSquare,
  Trash2,
  Archive,
  RotateCw,
  Rss,
} from 'lucide-react';
import { LinkItem, PlatformType } from '../types';

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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

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

  // Unread is the default, so it gets no marker; only progress is spelled out
  const statusLabel =
    link.readStatus === 'read' ? 'Read' : link.readStatus === 'reading' ? 'Reading' : null;
  const showCheckbox = !!onToggleSelect && (selectionMode || isSelected);

  const menuItemClass =
    'w-full px-3 py-1.5 flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors';

  return (
    <div
      id={`link-card-${link.id}`}
      onClick={(e) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey || selectionMode) {
          e.preventDefault();
          if (onToggleSelect) {
            onToggleSelect(link.id, e);
            return;
          }
        }
        onSelect(link);
      }}
      className={`group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl border transition-colors duration-200 cursor-pointer bg-white dark:bg-surface ${
        isSelected
          ? 'ring-2 ring-accent border-accent bg-accent/[0.03] dark:bg-accent/[0.04]'
          : 'border-slate-200/80 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.16]'
      } min-h-[170px] animate-card-entrance ${link.isArchived ? 'opacity-60' : ''}`}
    >
      <div className="space-y-2.5 sm:space-y-3">
        {/* Header: source line on the left, star and menu in a fixed spot on the right */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {showCheckbox && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect!(link.id, e);
                }}
                className="p-1 -ml-1.5 rounded-md cursor-pointer"
                title={isSelected ? 'Deselect' : 'Select'}
                aria-label={isSelected ? 'Deselect' : 'Select'}
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-accent border-accent text-on-accent'
                      : 'border-slate-300 dark:border-white/30 bg-black/5 dark:bg-white/5'
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
              {statusLabel && (
                <span
                  className={`shrink-0 ${
                    link.readStatus === 'reading'
                      ? 'text-accent-hover dark:text-accent'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  · {statusLabel}
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {link.isFavorite && (
              <button
                type="button"
                onClick={handleStar}
                className="p-1.5 rounded-lg text-amber-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="Remove star"
                aria-label="Remove star"
              >
                <Star className="w-3.5 h-3.5 fill-current" />
              </button>
            )}

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className={`p-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
                  menuOpen
                    ? 'text-slate-700 dark:text-slate-200 bg-black/5 dark:bg-white/5'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title="Actions"
                aria-label="Actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-8 z-20 w-48 py-1.5 rounded-xl bg-white dark:bg-surface border border-slate-200 dark:border-white/10 shadow-xl text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <a
                    role="menuitem"
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className={menuItemClass}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open original</span>
                  </a>
                  <button type="button" role="menuitem" onClick={handleCopy} className={menuItemClass}>
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copied ? 'Copied' : 'Copy link'}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      handleStar(e);
                      setMenuOpen(false);
                    }}
                    className={menuItemClass}
                  >
                    <Star className="w-3.5 h-3.5" />
                    <span>{link.isFavorite ? 'Remove star' : 'Star'}</span>
                  </button>
                  {onToggleSelect && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(e) => {
                        setMenuOpen(false);
                        onToggleSelect(link.id, e);
                      }}
                      className={menuItemClass}
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>{isSelected ? 'Deselect' : 'Select'}</span>
                    </button>
                  )}
                  <div className="my-1 border-t border-slate-100 dark:border-white/5" />
                  <button type="button" role="menuitem" onClick={handleArchive} className={menuItemClass}>
                    <Archive className="w-3.5 h-3.5" />
                    <span>{link.isArchived ? 'Unarchive' : 'Archive'}</span>
                  </button>
                  {onExportMarkdown && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onExportMarkdown(link);
                      }}
                      className={menuItemClass}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Export Markdown</span>
                    </button>
                  )}
                  {onReExtractAI && (
                    <button type="button" role="menuitem" onClick={handleReExtract} className={menuItemClass}>
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Re-extract AI</span>
                    </button>
                  )}
                  <div className="my-1 border-t border-slate-100 dark:border-white/5" />
                  <button
                    type="button"
                    role="menuitem"
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

        {/* Serif Editorial Title */}
        <h3
          className={`text-base font-semibold leading-snug line-clamp-2 ${
            link.readStatus === 'read'
              ? 'text-slate-500 dark:text-slate-400'
              : 'text-slate-900 dark:text-ink'
          }`}
        >
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
