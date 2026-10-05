import React, { useState } from 'react';
import {
  Inbox,
  BookOpen,
  BookMarked,
  CheckCircle2,
  Star,
  Archive,
  Rss,
  Github,
  MessageSquare,
  Instagram,
  Youtube,
  Twitter,
  FileText,
  ChevronDown,
  ChevronRight,
  Folder,
  BarChart3,
  Keyboard,
  Settings,
  Columns3,
  Network,
  Sun,
  Moon,
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
  onOpenShortcutsHelp?: () => void;
  onOpenSettings: () => void;
  /** True while the Settings page is showing, to highlight its entry. */
  settingsActive?: boolean;
  onOpenRssFeeds?: () => void;
  onOpenAnalytics?: () => void;
  /** Only provided when the signed-in user may manage service tokens. */
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
  onOpenShortcutsHelp,
  onOpenSettings,
  settingsActive = false,
  onOpenRssFeeds,
  onOpenAnalytics,
  syncStatus,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  // Collapsible section states
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [platformsOpen, setPlatformsOpen] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [utilitiesOpen, setUtilitiesOpen] = useState(true);

  const rowClass = (active: boolean) =>
    `w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[0.85rem] transition-colors ${
      active
        ? 'bg-black/[0.06] dark:bg-white/10 text-slate-900 dark:text-ink font-medium'
        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
    }`;
  const iconClass = 'w-3.5 h-3.5 shrink-0 text-slate-500 dark:text-slate-400';
  // Plain number, hidden when zero so empty rows stay quiet
  const renderCount = (count?: number) =>
    count ? <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{count}</span> : null;

  const renderNavAction = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    { active = false, count }: { active?: boolean; count?: number } = {}
  ) => (
    <button
      key={label}
      onClick={() => {
        onClick();
        if (onCloseMobile) onCloseMobile();
      }}
      className={rowClass(active)}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      {renderCount(count)}
    </button>
  );

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

  const visiblePlatforms = (
    [
      { id: 'github', label: 'GitHub', icon: <Github className={iconClass} /> },
      { id: 'reddit_post', label: 'Reddit', icon: <MessageSquare className={iconClass} /> },
      { id: 'instagram_short', label: 'Instagram', icon: <Instagram className={iconClass} /> },
      { id: 'youtube', label: 'YouTube', icon: <Youtube className={iconClass} /> },
      { id: 'twitter_x', label: 'X / Twitter', icon: <Twitter className={iconClass} /> },
      { id: 'paper', label: 'Papers & Docs', icon: <FileText className={iconClass} /> },
    ] as { id: PlatformType; label: string; icon: React.ReactNode }[]
  )
    .map((item) => ({ ...item, count: getPlatformCount(item.id) }))
    .filter((item) => item.count > 0 || filters.platform === item.id);

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
      <div className="flex flex-col h-full overflow-y-auto pr-1 space-y-5">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold tracking-tight text-slate-900 dark:text-ink">
              OmniLink
            </span>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <nav className="space-y-5 flex-1 text-xs">
          {/* Section 1: Repository / Triage Stages */}
          <div className="nav-section">
            <button
              onClick={() => setLibraryOpen(!libraryOpen)}
              className="w-full flex items-center justify-between px-1 py-1 nav-label hover:opacity-90 transition-opacity"
            >
              <span>Library</span>
              {libraryOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {libraryOpen && (
              <div className="mt-1.5 space-y-0.5">
                {(
                  [
                    { label: 'All links', icon: <Inbox className={iconClass} />, status: 'all', fav: false, archived: false, count: totalLinksCount },
                    { label: 'To read', icon: <BookOpen className={iconClass} />, status: 'unread', fav: false, archived: false, count: unreadCount },
                    { label: 'Reading', icon: <BookMarked className={iconClass} />, status: 'reading', fav: false, archived: false, count: readingCount },
                    { label: 'Read', icon: <CheckCircle2 className={iconClass} />, status: 'read', fav: false, archived: false, count: readCount },
                    { label: 'Starred', icon: <Star className={iconClass} />, status: 'all', fav: true, archived: false, count: favoritesCount },
                    { label: 'Archived', icon: <Archive className={iconClass} />, status: 'all', fav: false, archived: true, count: archivedCount },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleLibrarySelect(item.status, item.fav, item.archived)}
                    className={rowClass(isLibraryActive(item.status, item.fav, item.archived))}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    {renderCount(item.count)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Platforms, only the ones that have links (or the active filter) */}
          {visiblePlatforms.length > 0 && (
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
                  {visiblePlatforms.map((item) => {
                    const isSelected = filters.platform === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onFilterChange({
                            platform: isSelected ? 'all' : item.id,
                            includeArchived: false,
                          });
                          if (onCloseMobile) onCloseMobile();
                        }}
                        className={rowClass(isSelected)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.icon}
                          <span className="truncate">{item.label}</span>
                        </div>
                        {renderCount(item.count)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Section 3: Categories */}
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
                        className={rowClass(isSelected)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Folder className={iconClass} />
                          <span className="truncate">{cat}</span>
                        </div>
                        {renderCount(count)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Section 4: Workspace (views and daily tools) */}
          <div className="nav-section">
            <button
              onClick={() => setUtilitiesOpen(!utilitiesOpen)}
              className="w-full flex items-center justify-between px-1 py-1 nav-label hover:opacity-90 transition-opacity"
            >
              <span>Workspace</span>
              {utilitiesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {utilitiesOpen && (
              <div className="mt-1.5 space-y-0.5">
                {renderNavAction(<Columns3 className={iconClass} />, 'Kanban board', () => onViewChange('kanban'), { active: currentView === 'kanban' })}
                {renderNavAction(<Network className={iconClass} />, 'Topic clusters', () => onViewChange('cluster'), { active: currentView === 'cluster' })}
                {onOpenRssFeeds &&
                  renderNavAction(<Rss className={iconClass} />, 'RSS feeds', onOpenRssFeeds, {
                    count: rssFeedsCount > 0 ? rssFeedsCount : undefined,
                  })}
                {onOpenAnalytics &&
                  renderNavAction(<BarChart3 className={iconClass} />, 'Analytics', onOpenAnalytics)}
              </div>
            )}
          </div>

          {/* Section 5: Settings and help */}
          <div className="nav-section space-y-0.5">
            {renderNavAction(<Settings className={iconClass} />, 'Settings', onOpenSettings, { active: settingsActive })}
            {onOpenShortcutsHelp &&
              renderNavAction(<Keyboard className={iconClass} />, 'Keyboard shortcuts', onOpenShortcutsHelp)}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400">
          {/* Sync status */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                syncStatus === 'synced'
                  ? 'bg-emerald-500'
                  : syncStatus === 'syncing'
                  ? 'bg-accent animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <span className="capitalize">{syncStatus}</span>
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title={darkMode ? 'Switch to Light mode' : 'Switch to Dark mode'}
            aria-label={darkMode ? 'Switch to Light mode' : 'Switch to Dark mode'}
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </aside>
  );
};
