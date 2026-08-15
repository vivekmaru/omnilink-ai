import React, { useState } from 'react';
import {
  Bookmark,
  Sparkles,
  LayoutGrid,
  List,
  Columns3,
  Network,
  ShieldCheck,
  Share2,
  Chrome,
  Sun,
  Moon,
  Star,
  Archive,
  CheckCircle2,
  BookOpen,
  Inbox,
  Github,
  MessageSquare,
  Instagram,
  Youtube,
  Twitter,
  FileText,
  ChevronDown,
  ChevronRight,
  Folder,
  Layers,
  Circle,
  RefreshCw,
  Keyboard,
  FileDown,
  Rss,
  Radio,
  Cpu,
  BarChart3,
} from 'lucide-react';
import { FilterState, PlatformType, ReadStatus, SystemStats, ViewMode } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  filters: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  stats: SystemStats | null;
  totalLinksCount: number;
  unreadCount: number;
  readingCount: number;
  readCount: number;
  favoritesCount: number;
  archivedCount: number;
  rssFeedsCount?: number;
  rssUnreadCount?: number;
  availableCategories: string[];
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenBackup: () => void;
  onOpenMobileShare: () => void;
  onOpenExtension: () => void;
  onOpenShortcutsHelp?: () => void;
  onOpenExportMarkdown?: () => void;
  onOpenRssFeeds?: () => void;
  onOpenModelOrchestrator?: () => void;
  onOpenAnalytics?: () => void;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  filters,
  onFilterChange,
  stats,
  totalLinksCount,
  unreadCount,
  readingCount,
  readCount,
  favoritesCount,
  archivedCount,
  rssFeedsCount = 0,
  rssUnreadCount = 0,
  availableCategories,
  darkMode,
  onToggleDarkMode,
  onOpenBackup,
  onOpenMobileShare,
  onOpenExtension,
  onOpenShortcutsHelp,
  onOpenExportMarkdown,
  onOpenRssFeeds,
  onOpenModelOrchestrator,
  onOpenAnalytics,
  syncStatus,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  // Collapsible section states
  const [viewsOpen, setViewsOpen] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [platformsOpen, setPlatformsOpen] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(true);

  const getCategoryCount = (cat: string) => {
    if (stats?.categoriesBreakdown?.[cat] !== undefined) {
      return stats.categoriesBreakdown[cat];
    }
    const fromTop = stats?.topCategories?.find((c) => c.category === cat)?.count;
    if (fromTop !== undefined) return fromTop;
    return 0;
  };

  const getPlatformCount = (platform: PlatformType) => {
    if (stats?.platformCounts?.[platform] !== undefined) {
      return stats.platformCounts[platform];
    }
    if (stats?.platformBreakdown?.[platform] !== undefined) {
      return stats.platformBreakdown[platform];
    }
    return 0;
  };

  const handleLibrarySelect = (
    readStatus: ReadStatus | 'all',
    onlyFavorites = false,
    includeArchived = false
  ) => {
    onFilterChange({
      readStatus,
      onlyFavorites,
      includeArchived,
      platform: 'all',
      category: 'all',
      tag: 'all',
    });
    if (onCloseMobile) onCloseMobile();
  };

  const isLibraryActive = (
    status: ReadStatus | 'all',
    fav: boolean,
    archived: boolean
  ) => {
    return (
      filters.readStatus === status &&
      filters.onlyFavorites === fav &&
      filters.includeArchived === archived &&
      filters.platform === 'all' &&
      filters.category === 'all'
    );
  };

  return (
    <aside
      id="main-sidebar"
      className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col justify-between p-5 transition-all duration-200 border-r md:static md:translate-x-0 select-none ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      <div className="flex flex-col h-full overflow-y-auto pr-1 space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-baseline gap-2">
            <span className="font-newsreader text-2xl font-medium tracking-tight text-slate-900 dark:text-[#f7f6f3]">
              OmniLink
            </span>
            <span className="badge-ai">
              AI
            </span>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <nav className="space-y-6 flex-1 text-xs">
          {/* Section 1: Views */}
          <div className="nav-section">
            <button
              onClick={() => setViewsOpen(!viewsOpen)}
              className="w-full flex items-center justify-between px-1 py-1 nav-label hover:opacity-90 transition-opacity"
            >
              <span>Views</span>
              {viewsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {viewsOpen && (
              <div className="mt-1.5 space-y-0.5">
                <button
                  onClick={() => {
                    onViewChange('grid');
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[0.85rem] transition-colors ${
                    currentView === 'grid'
                      ? 'bg-[#d97757]/10 text-[#d97757] dark:bg-[#e08264]/15 dark:text-[#e08264] font-medium'
                      : 'text-[#1a1a18]/80 dark:text-[#f7f6f3]/80 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Card Grid</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">3-Col</span>
                </button>

                <button
                  onClick={() => {
                    onViewChange('list');
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[0.85rem] transition-colors ${
                    currentView === 'list'
                      ? 'bg-[#d97757]/10 text-[#d97757] dark:bg-[#e08264]/15 dark:text-[#e08264] font-medium'
                      : 'text-[#1a1a18]/80 dark:text-[#f7f6f3]/80 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <List className="w-3.5 h-3.5" />
                    <span>Compact List</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onViewChange('kanban');
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[0.85rem] transition-colors ${
                    currentView === 'kanban'
                      ? 'bg-[#d97757]/10 text-[#d97757] dark:bg-[#e08264]/15 dark:text-[#e08264] font-medium'
                      : 'text-[#1a1a18]/80 dark:text-[#f7f6f3]/80 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Columns3 className="w-3.5 h-3.5" />
                    <span>Kanban Lanes</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onViewChange('cluster');
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[0.85rem] transition-colors ${
                    currentView === 'cluster'
                      ? 'bg-[#d97757]/10 text-[#d97757] dark:bg-[#e08264]/15 dark:text-[#e08264] font-medium'
                      : 'text-[#1a1a18]/80 dark:text-[#f7f6f3]/80 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Network className="w-3.5 h-3.5" />
                    <span>AI Clusters</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#d97757] dark:text-[#e08264] bg-[#d97757]/10 px-1.5 py-0.5 rounded">
                    Auto
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Repository / Library */}
          <div className="nav-section">
            <button
              onClick={() => setLibraryOpen(!libraryOpen)}
              className="w-full flex items-center justify-between px-1 py-1 nav-label hover:opacity-90 transition-opacity"
            >
              <span>Repository</span>
              {libraryOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {libraryOpen && (
              <div className="mt-1.5 space-y-0.5">
                <button
                  onClick={() => handleLibrarySelect('all', false, false)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[0.85rem] transition-colors ${
                    isLibraryActive('all', false, false)
                      ? 'bg-[#d97757]/10 text-[#d97757] dark:bg-[#e08264]/15 dark:text-[#e08264] font-medium'
                      : 'text-[#1a1a18]/80 dark:text-[#f7f6f3]/80 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Inbox className="w-3.5 h-3.5 opacity-75" />
                    <span>All Links</span>
                  </div>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                    {totalLinksCount}
                  </span>
                </button>

                <button
                  onClick={() => handleLibrarySelect('unread', false, false)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[0.85rem] transition-colors ${
                    isLibraryActive('unread', false, false)
                      ? 'bg-[#d97757]/10 text-[#d97757] dark:bg-[#e08264]/15 dark:text-[#e08264] font-medium'
                      : 'text-[#1a1a18]/80 dark:text-[#f7f6f3]/80 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Circle className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                    <span>Reading Queue</span>
                  </div>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                    {unreadCount}
                  </span>
                </button>

                <button
                  onClick={() => handleLibrarySelect('reading', false, false)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[0.85rem] transition-colors ${
                    isLibraryActive('reading', false, false)
                      ? 'bg-[#d97757]/10 text-[#d97757] dark:bg-[#e08264]/15 dark:text-[#e08264] font-medium'
                      : 'text-[#1a1a18]/80 dark:text-[#f7f6f3]/80 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Circle className="w-2.5 h-2.5 fill-cyan-500 text-cyan-500" />
                    <span>In Progress</span>
                  </div>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                    {readingCount}
                  </span>
                </button>

                <button
                  onClick={() => handleLibrarySelect('read', false, false)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[0.85rem] transition-colors ${
                    isLibraryActive('read', false, false)
                      ? 'bg-[#d97757]/10 text-[#d97757] dark:bg-[#e08264]/15 dark:text-[#e08264] font-medium'
                      : 'text-[#1a1a18]/80 dark:text-[#f7f6f3]/80 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Reviewed</span>
                  </div>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                    {readCount}
                  </span>
                </button>

                <button
                  onClick={() => handleLibrarySelect('all', true, false)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[0.85rem] transition-colors ${
                    isLibraryActive('all', true, false)
                      ? 'bg-[#d97757]/10 text-[#d97757] dark:bg-[#e08264]/15 dark:text-[#e08264] font-medium'
                      : 'text-[#1a1a18]/80 dark:text-[#f7f6f3]/80 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>Starred</span>
                  </div>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                    {favoritesCount}
                  </span>
                </button>

                <button
                  onClick={() => handleLibrarySelect('all', false, true)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[0.85rem] transition-colors ${
                    isLibraryActive('all', false, true)
                      ? 'bg-[#d97757]/10 text-[#d97757] dark:bg-[#e08264]/15 dark:text-[#e08264] font-medium'
                      : 'text-[#1a1a18]/80 dark:text-[#f7f6f3]/80 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Archive className="w-3.5 h-3.5 opacity-75" />
                    <span>Archived</span>
                  </div>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                    {archivedCount}
                  </span>
                </button>

                {/* RSS Feeds Direct Access */}
                <button
                  id="sidebar-btn-rss-feeds"
                  onClick={() => {
                    if (onOpenRssFeeds) onOpenRssFeeds();
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[0.85rem] text-[#1a1a18]/80 dark:text-[#f7f6f3]/80 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <Rss className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
                    <span>RSS Feeds</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {rssUnreadCount > 0 && (
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
                        {rssUnreadCount}
                      </span>
                    )}
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                      {rssFeedsCount}
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Section 3: Platforms */}
          <div className="nav-section">
            <button
              onClick={() => setPlatformsOpen(!platformsOpen)}
              className="w-full flex items-center justify-between px-1 py-1 nav-label hover:opacity-90 transition-opacity"
            >
              <span>Platforms</span>
              {platformsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {platformsOpen && (
              <div className="mt-1.5 space-y-0.5">
                {[
                  { id: 'github', label: 'GitHub', icon: <Github className="w-3.5 h-3.5" /> },
                  { id: 'reddit_post', label: 'Reddit', icon: <MessageSquare className="w-3.5 h-3.5 text-amber-500" /> },
                  { id: 'instagram_short', label: 'Instagram', icon: <Instagram className="w-3.5 h-3.5 text-rose-500" /> },
                  { id: 'youtube', label: 'YouTube', icon: <Youtube className="w-3.5 h-3.5 text-red-500" /> },
                  { id: 'twitter_x', label: 'X / Twitter', icon: <Twitter className="w-3.5 h-3.5 text-sky-500" /> },
                  { id: 'paper', label: 'Papers & Docs', icon: <FileText className="w-3.5 h-3.5 text-emerald-500" /> },
                ].map((item) => {
                  const count = getPlatformCount(item.id as PlatformType);
                  const isSelected = filters.platform === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onFilterChange({
                          platform: isSelected ? 'all' : (item.id as PlatformType),
                          includeArchived: false,
                        });
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[0.85rem] transition-colors ${
                        isSelected
                          ? 'bg-[#d97757]/10 text-[#d97757] dark:bg-[#e08264]/15 dark:text-[#e08264] font-medium'
                          : 'text-[#1a1a18]/80 dark:text-[#f7f6f3]/80 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </div>
                      {count > 0 && (
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 4: Categories */}
          {availableCategories.length > 0 && (
            <div className="nav-section">
              <button
                onClick={() => setCategoriesOpen(!categoriesOpen)}
                className="w-full flex items-center justify-between px-1 py-1 nav-label hover:opacity-90 transition-opacity"
              >
                <span>Categories</span>
                {categoriesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              {categoriesOpen && (
                <div className="mt-1.5 space-y-0.5">
                  {availableCategories.map((cat) => {
                    const count = getCategoryCount(cat);
                    const isSelected = filters.category === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          onFilterChange({
                            category: isSelected ? 'all' : cat,
                            includeArchived: false,
                          });
                          if (onCloseMobile) onCloseMobile();
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[0.85rem] transition-colors ${
                          isSelected
                            ? 'bg-[#d97757]/10 text-[#d97757] dark:bg-[#e08264]/15 dark:text-[#e08264] font-medium'
                            : 'text-[#1a1a18]/80 dark:text-[#f7f6f3]/80 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Folder className="w-3.5 h-3.5 opacity-60 shrink-0" />
                          <span className="truncate">{cat}</span>
                        </div>
                        {count > 0 && (
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Sidebar Utilities Footer */}
        <div className="pt-3 border-t border-black/10 dark:border-white/10 space-y-2">
          {/* Quick Access Tools */}
          <div className="grid grid-cols-4 gap-1">
            <button
              id="sidebar-btn-analytics"
              onClick={onOpenAnalytics}
              title="Knowledge Analytics & Usage Insights (⌘A)"
              className="p-1.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[9.5px] font-medium text-[#d97757] dark:text-[#e08264] hover:bg-[#d97757]/10 transition-colors group"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264] group-hover:scale-110 transition-transform" />
              <span>Stats</span>
            </button>

            <button
              id="sidebar-btn-model-orchestrator"
              onClick={onOpenModelOrchestrator}
              title="Gemini Multi-Tier Model Orchestrator & Telemetry (⌘O)"
              className="p-1.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[9.5px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors group"
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-500 group-hover:scale-110 transition-transform" />
              <span>Router</span>
            </button>

            <button
              id="sidebar-btn-shortcuts"
              onClick={onOpenShortcutsHelp}
              title="Keyboard Shortcuts Guide (? or ⌘/)"
              className="p-1.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[9.5px] font-medium text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-100 transition-colors group"
            >
              <Keyboard className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264] group-hover:scale-110 transition-transform" />
              <span>Keys</span>
            </button>

            <button
              id="sidebar-btn-rss-manage"
              onClick={onOpenRssFeeds}
              title="RSS Feeds & Dev Blogs Subscriptions (⌘R)"
              className="p-1.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[9.5px] font-medium text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-100 transition-colors group"
            >
              <Rss className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
              <span>RSS</span>
            </button>

            <button
              id="sidebar-btn-export-markdown"
              onClick={onOpenExportMarkdown}
              title="Export Markdown for Obsidian & Notion (⌘⇧E)"
              className="p-1.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[9.5px] font-medium text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-100 transition-colors group"
            >
              <FileDown className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264] group-hover:scale-110 transition-transform" />
              <span>Export</span>
            </button>

            <button
              onClick={onOpenExtension}
              title="Chrome Extension Generator & Guide (⌘E)"
              className="p-1.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[9.5px] font-medium text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              <Chrome className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />
              <span>Ext</span>
            </button>

            <button
              onClick={onOpenMobileShare}
              title="Mobile Quick Share & QR Connect (⌘M)"
              className="p-1.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[9.5px] font-medium text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />
              <span>Mobile</span>
            </button>

            <button
              onClick={onOpenBackup}
              title="AES Encrypted Backups & Export (⌘B)"
              className="p-1.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[9.5px] font-medium text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />
              <span>Vault</span>
            </button>
          </div>

          {/* Theme Switch & Sync Status */}
          <div className="flex items-center justify-between px-1 pt-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-500'
                    : syncStatus === 'syncing'
                    ? 'bg-[#d97757] animate-ping'
                    : 'bg-rose-500'
                }`}
              />
              <span className="capitalize">{syncStatus}</span>
            </div>

            <button
              onClick={onToggleDarkMode}
              className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title={darkMode ? 'Switch to Light mode' : 'Switch to Dark mode'}
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
