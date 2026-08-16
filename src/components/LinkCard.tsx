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
  MoreVertical,
  Sparkles,
  Code2,
  Quote,
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
  onSelect: (link: LinkItem) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onToggleArchive: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
  onReExtractAI?: (id: string) => void;
  onExportMarkdown?: (link: LinkItem) => void;
}

export const LinkCard: React.FC<LinkCardProps> = ({
  link,
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

  // Platform icon and subtle accent color
  const getPlatformMeta = (platform: PlatformType) => {
    switch (platform) {
      case 'github':
        return {
          name: 'GitHub',
          icon: <Github className="w-3 h-3 text-slate-700 dark:text-slate-300" />,
          badgeBg: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
          topAccent: 'border-t-slate-400 dark:border-t-slate-400',
        };
      case 'reddit_post':
      case 'reddit_comment':
        return {
          name: 'Reddit',
          icon: <MessageSquare className="w-3 h-3 text-amber-500" />,
          badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          topAccent: 'border-t-amber-500',
        };
      case 'instagram_short':
        return {
          name: 'Instagram',
          icon: <Instagram className="w-3 h-3 text-rose-500" />,
          badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
          topAccent: 'border-t-rose-500',
        };
      case 'youtube':
        return {
          name: 'YouTube',
          icon: <Youtube className="w-3 h-3 text-red-500" />,
          badgeBg: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
          topAccent: 'border-t-red-500',
        };
      case 'twitter_x':
        return {
          name: 'X / Twitter',
          icon: <Twitter className="w-3 h-3 text-sky-500" />,
          badgeBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
          topAccent: 'border-t-sky-500',
        };
      case 'paper':
        return {
          name: 'Paper',
          icon: <FileText className="w-3 h-3 text-emerald-500" />,
          badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          topAccent: 'border-t-emerald-500',
        };
      default:
        return {
          name: 'Article',
          icon: <FileText className="w-3 h-3 text-indigo-500" />,
          badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          topAccent: 'border-t-indigo-500',
        };
    }
  };

  const platformMeta = getPlatformMeta(link.platform);

  // Status badge config
  const getStatusBadge = (status: ReadStatus) => {
    switch (status) {
      case 'read':
        return (
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Reviewed</span>
          </span>
        );
      case 'reading':
        return (
          <span className="flex items-center gap-1 text-[10px] font-medium text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <span>Reading</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
            <Circle className="w-2 h-2 fill-amber-500 text-amber-500" />
            <span>Unread</span>
          </span>
        );
    }
  };

  return (
    <div
      id={`link-card-${link.id}`}
      onClick={() => onSelect(link)}
      className={`group relative flex flex-col justify-between p-5 sm:p-6 rounded-xl border transition-all duration-200 cursor-pointer bg-white dark:bg-[#1b1b1f] border-slate-200/80 dark:border-white/10 hover:border-[#d97757] dark:hover:border-[#e08264] hover:shadow-md hover:-translate-y-0.5 min-h-[250px] ${
        link.isArchived ? 'opacity-60' : ''
      }`}
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      <div className="space-y-3">
        {/* Card Meta & Quick Controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-[0.65rem] uppercase tracking-wider text-[#c25e3e] dark:text-[#e08264] truncate font-semibold">
              {platformMeta.name} {link.category ? `• ${link.category}` : ''}
            </span>
            {(link.isRssFeedItem || link.feedTitle) && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
                <Rss className="w-2.5 h-2.5" />
                <span className="truncate max-w-[90px]">{link.feedTitle || 'RSS'}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Read Status Badge */}
            {getStatusBadge(link.readStatus)}

            <button
              onClick={handleStar}
              className={`p-1.5 rounded transition-colors ${
                link.isFavorite
                  ? 'text-amber-500 bg-amber-500/10'
                  : 'text-slate-400 hover:text-amber-500 hover:bg-black/5 dark:hover:bg-white/5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100'
              }`}
              title={link.isFavorite ? 'Remove Star' : 'Star Link'}
              aria-label={link.isFavorite ? 'Remove Star' : 'Star Link'}
            >
              <Star className={`w-3.5 h-3.5 ${link.isFavorite ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={handleCopy}
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-all"
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
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-all"
                title="More Actions"
                aria-label="More Actions"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-7 z-20 w-40 py-1 rounded-lg bg-white dark:bg-[#151518] border border-slate-200 dark:border-white/10 shadow-lg text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={handleArchive}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>{link.isArchived ? 'Unarchive' : 'Archive'}</span>
                  </button>
                  {onExportMarkdown && (
                    <button
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
                      onClick={handleReExtract}
                      className="w-full px-3 py-1.5 flex items-center gap-2 text-[#d97757] dark:text-[#e08264] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Re-extract AI</span>
                    </button>
                  )}
                  <div className="my-1 border-t border-slate-100 dark:border-white/5" />
                  <button
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
        <h3 className="font-newsreader text-xl sm:text-[1.3rem] font-medium leading-snug text-slate-900 dark:text-slate-100 group-hover:text-[#d97757] dark:group-hover:text-[#e08264] transition-colors line-clamp-2">
          {link.title || link.url}
        </h3>

        {/* Editorial Description */}
        <p className="text-[0.88rem] leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-3">
          {link.summary?.tldr || link.aiSummary?.tldr || link.description || 'No description available.'}
        </p>

        {/* Extracted Code & Quote Badges */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {((link.summary?.codeSnippets && link.summary.codeSnippets.length > 0) ||
            (link.aiSummary?.codeSnippets && link.aiSummary.codeSnippets.length > 0)) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <Code2 className="w-3 h-3" />
              <span>
                {(link.summary?.codeSnippets || link.aiSummary?.codeSnippets || []).length} Snippet
              </span>
            </span>
          )}

          {(link.summary?.quotes?.[0] || link.summary?.quote || link.aiSummary?.quote) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
              <Quote className="w-3 h-3" />
              <span>Quote</span>
            </span>
          )}

          {((link.summary?.keyTakeaways && link.summary.keyTakeaways.length > 0) ||
            (link.aiSummary?.takeaways && link.aiSummary.takeaways.length > 0)) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#d97757]/10 text-[#c25e3e] dark:text-[#e08264] border border-[#d97757]/20 font-semibold">
              <Sparkles className="w-3 h-3" />
              <span>
                {(link.summary?.keyTakeaways || link.aiSummary?.takeaways || []).length} Insights
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Tag Row & Footer Link */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
        <div className="tag-row flex flex-wrap gap-1.5 overflow-hidden">
          {link.tags && link.tags.length > 0 ? (
            link.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="font-mono text-[0.65rem] px-2 py-0.5 bg-slate-100 dark:bg-[#26262b] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/5 rounded font-medium"
              >
                #{tag}
              </span>
            ))
          ) : (
            <span className="font-mono text-[0.65rem] text-slate-400 opacity-60">#curated</span>
          )}
          {link.tags && link.tags.length > 3 && (
            <span className="font-mono text-[0.65rem] text-slate-500 dark:text-slate-400 self-center">
              +{link.tags.length - 3}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {link.aiSummary?.estimatedReadTimeMinutes && (
            <span className="flex items-center gap-1 font-mono text-[0.65rem] text-slate-500 dark:text-slate-400">
              <Clock className="w-3 h-3 opacity-60" />
              <span>{link.aiSummary.estimatedReadTimeMinutes}m</span>
            </span>
          )}
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded text-slate-400 hover:text-[#d97757] dark:hover:text-[#e08264] transition-colors"
            title="Open original URL in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
