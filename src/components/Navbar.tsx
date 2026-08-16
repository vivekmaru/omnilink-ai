import React, { useEffect, useRef, useState } from 'react';
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
  Wrench,
  ChevronDown,
  ShieldCheck,
  Share2,
  Chrome,
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
  onOpenBackup?: () => void;
  onOpenMobileShare?: () => void;
  onOpenExtension?: () => void;
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
  onOpenBackup,
  onOpenMobileShare,
  onOpenExtension,
  rssFeedsCount = 0,
  currentView,
  onViewChange,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

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
      } else if (e.key === 'Escape') {
        if (toolsOpen) {
          setToolsOpen(false);
        } else if (document.activeElement === searchInputRef.current) {
          onSearchChange('');
          searchInputRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenAskRepo, onOpenAddModal, onOpenShortcutsHelp, onSearchChange, toolsOpen]);

  // Click outside to close tools menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    if (toolsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [toolsOpen]);

  return (
    <header
      className="sticky top-0 z-30 px-5 sm:px-8 py-3 flex items-center justify-between gap-4 border-b backdrop-blur-md transition-colors"
      style={{
        backgroundColor: 'var(--bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      {/* Left: Mobile Toggle & Dominant Editorial Search Field */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
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
            placeholder="Search knowledge repository..."
            className="w-full pl-7 pr-16 py-1 bg-transparent border-b border-transparent focus:border-[#d97757] dark:focus:border-[#e08264] font-newsreader text-base sm:text-lg text-slate-900 dark:text-[#f7f6f3] placeholder:text-slate-400/80 dark:placeholder:text-slate-500 outline-none transition-all"
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

      {/* Middle: Integrated Canonical View Switcher */}
      <div className="hidden lg:flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
        <button
          onClick={() => onViewChange('grid')}
          title="Card Grid View (1)"
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
            currentView === 'grid'
              ? 'bg-white dark:bg-[#1f1e1c] text-slate-900 dark:text-[#f7f6f3] shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Grid</span>
        </button>
        <button
          onClick={() => onViewChange('list')}
          title="High-Density Compact List (2)"
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
            currentView === 'list'
              ? 'bg-white dark:bg-[#1f1e1c] text-slate-900 dark:text-[#f7f6f3] shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <List className="w-3.5 h-3.5" />
          <span>List</span>
        </button>
        <button
          onClick={() => onViewChange('kanban')}
          title="Kanban Triage Lanes (3)"
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
            currentView === 'kanban'
              ? 'bg-white dark:bg-[#1f1e1c] text-slate-900 dark:text-[#f7f6f3] shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Columns3 className="w-3.5 h-3.5" />
          <span>Kanban</span>
        </button>
        <button
          onClick={() => onViewChange('cluster')}
          title="AI Vector Clusters (4)"
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
            currentView === 'cluster'
              ? 'bg-white dark:bg-[#1f1e1c] text-slate-900 dark:text-[#f7f6f3] shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span>Clusters</span>
        </button>
      </div>

      {/* Right: Distilled Tools Menu & Primary Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Consolidated Tools Dropdown */}
        <div className="relative" ref={toolsMenuRef}>
          <button
            id="btn-navbar-tools"
            onClick={() => setToolsOpen(!toolsOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
              toolsOpen
                ? 'bg-black/10 dark:bg-white/10 text-slate-900 dark:text-white border-black/20 dark:border-white/20'
                : 'bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10'
            }`}
            title="Tools & Utilities"
            aria-expanded={toolsOpen}
            aria-haspopup="true"
          >
            <Wrench className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />
            <span className="hidden sm:inline">Tools</span>
            {rssFeedsCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            )}
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
          </button>

          {toolsOpen && (
            <div
              className="absolute right-0 top-10 z-50 w-60 p-1.5 rounded-xl border shadow-xl animate-in fade-in zoom-in-95 duration-100"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
              }}
            >
              <div className="px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-black/5 dark:border-white/5 mb-1">
                Tools & Integrations
              </div>

              {onOpenModelOrchestrator && (
                <button
                  onClick={() => {
                    onOpenModelOrchestrator();
                    setToolsOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <Cpu className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:scale-110 transition-transform" />
                    <span>Gemini Model Router</span>
                  </div>
                  <span className="font-mono text-[10px] opacity-50">⌘O</span>
                </button>
              )}

              {onOpenRssFeeds && (
                <button
                  onClick={() => {
                    onOpenRssFeeds();
                    setToolsOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <Rss className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:scale-110 transition-transform" />
                    <span>RSS Feeds</span>
                  </div>
                  {rssFeedsCount > 0 ? (
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-semibold">
                      {rssFeedsCount}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] opacity-50">⌘R</span>
                  )}
                </button>
              )}

              {onOpenExportMarkdown && (
                <button
                  onClick={() => {
                    onOpenExportMarkdown();
                    setToolsOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <FileDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:scale-110 transition-transform" />
                    <span>Export Markdown (.md)</span>
                  </div>
                  <span className="font-mono text-[10px] opacity-50">⌘⇧E</span>
                </button>
              )}

              {onOpenExtension && (
                <button
                  onClick={() => {
                    onOpenExtension();
                    setToolsOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <Chrome className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:scale-110 transition-transform" />
                    <span>Chrome Extension Hub</span>
                  </div>
                  <span className="font-mono text-[10px] opacity-50">⌘E</span>
                </button>
              )}

              {onOpenMobileShare && (
                <button
                  onClick={() => {
                    onOpenMobileShare();
                    setToolsOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <Share2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:scale-110 transition-transform" />
                    <span>Mobile Share & QR</span>
                  </div>
                  <span className="font-mono text-[10px] opacity-50">⌘M</span>
                </button>
              )}
            </div>
          )}
        </div>

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
