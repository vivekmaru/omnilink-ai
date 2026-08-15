import React, { useEffect, useRef } from 'react';
import {
  Search,
  Sparkles,
  Plus,
  Menu,
  X,
  LayoutGrid,
  List,
  Columns3,
  Network,
  Keyboard,
  FileDown,
  Rss,
  Cpu,
  BarChart3,
} from 'lucide-react';
import { ViewMode } from '../types';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenAddModal: () => void;
  onOpenAskRepo: () => void;
  onToggleMobileSidebar: () => void;
  onOpenShortcutsHelp?: () => void;
  onOpenExportMarkdown?: () => void;
  onOpenRssFeeds?: () => void;
  onOpenModelOrchestrator?: () => void;
  onOpenAnalytics?: () => void;
  rssFeedsCount?: number;
  currentView: ViewMode;
  onViewChange: (mode: ViewMode) => void;
}

export const Navbar: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenAddModal,
  onOpenAskRepo,
  onToggleMobileSidebar,
  onOpenShortcutsHelp,
  onOpenExportMarkdown,
  onOpenRssFeeds,
  onOpenModelOrchestrator,
  onOpenAnalytics,
  rssFeedsCount = 0,
  currentView,
  onViewChange,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard Shortcuts: ⌘K or / for search, ⌘J for Ask AI, N for Add Link, ? or ⌘/ for Help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA';

      if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        onOpenAskRepo();
      } else if (
        (e.key === '?' && !isInput) ||
        ((e.metaKey || e.ctrlKey) && e.key === '/')
      ) {
        e.preventDefault();
        onOpenShortcutsHelp?.();
      } else if (e.key.toLowerCase() === 'n' && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onOpenAddModal();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        onSearchChange('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenAskRepo, onOpenAddModal, onOpenShortcutsHelp, onSearchChange]);

  return (
    <header
      className="sticky top-0 z-30 px-5 sm:px-8 py-3.5 flex items-center justify-between gap-4 border-b backdrop-blur-md transition-colors"
      style={{
        backgroundColor: 'var(--bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      {/* Left: Mobile Toggle & Dominant Editorial Search Field */}
      <div className="flex items-center gap-3 flex-1 max-w-2xl">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="relative flex-1 search-container">
          <Search className="w-4 h-4 absolute left-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            id="navbar-search-input"
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search knowledge base..."
            className="w-full pl-7 pr-16 py-1.5 bg-transparent border-b border-transparent focus:border-[#d97757] dark:focus:border-[#e08264] font-newsreader text-base sm:text-lg text-slate-900 dark:text-[#f7f6f3] placeholder:text-slate-400/80 dark:placeholder:text-slate-500 outline-none transition-all"
          />

          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery ? (
              <button
                onClick={() => {
                  onSearchChange('');
                  searchInputRef.current?.focus();
                }}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Clear search (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="hidden sm:inline-flex items-center font-mono text-[10px] text-slate-400 dark:text-slate-500 bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded border border-black/5 dark:border-white/5">
                ⌘K
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Middle: Integrated View Switcher */}
      <div className="hidden lg:flex items-center p-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
        <button
          onClick={() => onViewChange('grid')}
          title="Card Grid View"
          className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
            currentView === 'grid'
              ? 'bg-white dark:bg-[#1f1e1c] text-slate-900 dark:text-[#f7f6f3] shadow-2xs font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Grid</span>
        </button>
        <button
          onClick={() => onViewChange('list')}
          title="High-Density Compact List"
          className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
            currentView === 'list'
              ? 'bg-white dark:bg-[#1f1e1c] text-slate-900 dark:text-[#f7f6f3] shadow-2xs font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <List className="w-3.5 h-3.5" />
          <span>List</span>
        </button>
        <button
          onClick={() => onViewChange('kanban')}
          title="Kanban Board Lanes"
          className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
            currentView === 'kanban'
              ? 'bg-white dark:bg-[#1f1e1c] text-slate-900 dark:text-[#f7f6f3] shadow-2xs font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Columns3 className="w-3.5 h-3.5" />
          <span>Kanban</span>
        </button>
        <button
          onClick={() => onViewChange('cluster')}
          title="AI Semantic Clusters"
          className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
            currentView === 'cluster'
              ? 'bg-white dark:bg-[#1f1e1c] text-slate-900 dark:text-[#f7f6f3] shadow-2xs font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span>Clusters</span>
        </button>
      </div>

      {/* Right: Primary AI & Add Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Help & Shortcuts Button */}
        <button
          id="btn-navbar-shortcuts"
          onClick={onOpenShortcutsHelp}
          className="p-2 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-black/10 dark:hover:border-white/10"
          title="Keyboard Shortcuts Guide (? or ⌘/)"
          aria-label="Keyboard Shortcuts"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* RSS Feeds Button */}
        {onOpenRssFeeds && (
          <button
            id="btn-navbar-rss-feeds"
            onClick={onOpenRssFeeds}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 border border-black/10 dark:border-white/10 group"
            title="Manage RSS Feeds & Subscriptions"
          >
            <Rss className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline font-medium">RSS Feeds</span>
            {rssFeedsCount > 0 && (
              <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-500">
                {rssFeedsCount}
              </span>
            )}
          </button>
        )}

        {/* Export Markdown Button */}
        {onOpenExportMarkdown && (
          <button
            id="btn-navbar-export-markdown"
            onClick={onOpenExportMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 border border-black/10 dark:border-white/10 group"
            title="Export Markdown for Obsidian & Notion (⌘⇧E)"
          >
            <FileDown className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264] group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline font-medium">Export .md</span>
          </button>
        )}

        {/* Analytics Insights Button */}
        {onOpenAnalytics && (
          <button
            id="btn-navbar-analytics"
            onClick={onOpenAnalytics}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 border border-black/10 dark:border-white/10 group"
            title="Knowledge Analytics & Usage Insights (⌘A)"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264] group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline font-medium">Analytics</span>
          </button>
        )}

        {/* Model Orchestration Engine Button */}
        {onOpenModelOrchestrator && (
          <button
            id="btn-model-orchestrator"
            onClick={onOpenModelOrchestrator}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group"
            title="Gemini Multi-Tier Model Orchestrator & Live Routing Matrix"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-500 group-hover:scale-110 transition-transform" />
            <span className="font-mono text-[11px] font-semibold">Gemini Router</span>
          </button>
        )}

        {/* Primary AI Button: Ask Repo AI */}
        <button
          id="btn-ask-repo-ai"
          onClick={onOpenAskRepo}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200 border border-black/10 dark:border-white/10 group"
          title="Search your knowledge base with conversational AI (⌘J)"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264] group-hover:scale-110 transition-transform" />
          <span className="font-medium">Ask AI</span>
          <span className="hidden sm:inline-flex font-mono text-[10px] opacity-60">
            ⌘J
          </span>
        </button>

        {/* Primary Action: + Add New Link */}
        <button
          id="btn-add-new-link"
          onClick={onOpenAddModal}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition-all bg-[#d97757] hover:bg-[#c46243] dark:bg-[#e08264] dark:hover:bg-[#e9957a] text-white shadow-2xs hover:scale-[1.01] active:scale-[0.99]"
          title="Add a link to the knowledge repository (N)"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Link</span>
        </button>
      </div>
    </header>
  );
};
