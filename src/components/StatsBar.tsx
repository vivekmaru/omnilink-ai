import React from 'react';
import {
  Github,
  MessageSquare,
  Instagram,
  Youtube,
  Twitter,
  FileText,
  Bookmark,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { PlatformType, SystemStats } from '../types';

interface StatsBarProps {
  stats: SystemStats | null;
  onSelectPlatform: (platform: PlatformType | 'all') => void;
  selectedPlatform: PlatformType | 'all';
  onSelectCategory: (category: string | 'all') => void;
  selectedCategory: string | 'all';
  onOpenAnalytics?: () => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  stats,
  onSelectPlatform,
  selectedPlatform,
  onSelectCategory,
  selectedCategory,
  onOpenAnalytics,
}) => {
  if (!stats) return null;

  const platforms: { id: PlatformType; label: string; icon: React.ReactNode }[] = [
    { id: 'github', label: 'GitHub', icon: <Github className="w-3.5 h-3.5" /> },
    { id: 'reddit_post', label: 'Reddit Posts', icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: 'reddit_comment', label: 'Reddit Comments', icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: 'instagram_short', label: 'Instagram', icon: <Instagram className="w-3.5 h-3.5" /> },
    { id: 'youtube', label: 'YouTube', icon: <Youtube className="w-3.5 h-3.5" /> },
    { id: 'twitter_x', label: 'X / Twitter', icon: <Twitter className="w-3.5 h-3.5" /> },
    { id: 'article', label: 'Articles', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'paper', label: 'Papers', icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 overflow-x-auto no-scrollbar text-xs">
          
          {/* Platform Filter Badges */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onSelectPlatform('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                selectedPlatform === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs font-semibold'
                  : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              All ({stats.totalLinks})
            </button>

            {platforms.map((p) => {
              const count = stats.platformCounts[p.id] || 0;
              if (count === 0) return null;
              const isActive = selectedPlatform === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectPlatform(isActive ? 'all' : p.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs font-semibold'
                      : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {p.icon}
                  <span>{p.label}</span>
                  <span className={`text-[10px] px-1 rounded ${isActive ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900 font-semibold' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 font-medium'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Metrics Triage & Analytics Trigger */}
          <div
            onClick={onOpenAnalytics}
            className="hidden lg:flex items-center gap-3 text-zinc-500 dark:text-zinc-400 shrink-0 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors py-1 px-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5"
            title="Open Detailed Knowledge Analytics & Usage Insights (⌘A)"
          >
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>{stats.unreadCount} unread</span>
            </div>
            <span className="opacity-40">•</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>{stats.totalLinks - stats.unreadCount} reviewed</span>
            </div>
            <span className="opacity-40">•</span>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />
              <span className="font-mono text-[11px]">Insights &rarr;</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
