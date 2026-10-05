import React, { useEffect, useRef } from 'react';
import {
  Search,
  Sparkles,
  Plus,
  Menu,
  X,
  LayoutGrid,
  List,
  Keyboard,
} from 'lucide-react';
import { ViewMode } from '../types';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenAddModal: () => void;
  onOpenAskRepo: () => void;
  onToggleMobileSidebar: () => void;
  onOpenShortcutsHelp?: () => void;
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
      } else if (e.key === 'Escape') {
        if (document.activeElement === searchInputRef.current) {
          onSearchChange('');
          searchInputRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenAskRepo, onOpenAddModal, onOpenShortcutsHelp, onSearchChange]);

  return (
    <header
      className="sticky top-0 z-30 px-3 sm:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 border-b backdrop-blur-md transition-colors"
      style={{
        backgroundColor: 'var(--bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      {/* Left: Mobile Toggle & Dominant Editorial Search Field */}
      <div className="flex items-center gap-1.5 sm:gap-3 flex-1 min-w-0 max-w-xl">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="relative flex-1 min-w-0 search-container">
          <Search className="w-3.5 sm:w-4 h-3.5 sm:h-4 absolute left-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            id="navbar-search-input"
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search repository..."
            className="w-full pl-6 sm:pl-7 pr-8 sm:pr-16 py-1 bg-transparent border-b border-transparent focus:border-accent text-sm sm:text-[15px] text-slate-900 dark:text-ink placeholder:text-slate-400/80 dark:placeholder:text-slate-500 outline-none transition-all"
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
              <span className="hidden sm:inline-flex items-center text-xs text-slate-400 dark:text-slate-500 bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded border border-black/5 dark:border-white/5">
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
              ? 'bg-white dark:bg-surface text-slate-900 dark:text-ink shadow-xs font-semibold'
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
              ? 'bg-white dark:bg-surface text-slate-900 dark:text-ink shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <List className="w-3.5 h-3.5" />
          <span>List</span>
        </button>
      </div>

      {/* Right: Distilled Tools Menu & Primary Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Primary AI Button: Ask Repo AI */}
        <button
          id="btn-ask-repo-ai"
          onClick={onOpenAskRepo}
          className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-md text-xs font-medium transition-all bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200 border border-black/10 dark:border-white/10 group shrink-0"
          title="Search your knowledge base with conversational AI (⌘J)"
        >
          <Sparkles className="w-3.5 h-3.5 text-accent group-hover:scale-110 transition-transform" />
          <span className="font-medium whitespace-nowrap">Ask AI</span>
          <span className="hidden sm:inline-flex text-xs opacity-60">
            ⌘J
          </span>
        </button>

        {/* Primary Action: + Add New Link */}
        <button
          id="btn-add-new-link"
          onClick={onOpenAddModal}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-md text-xs font-semibold transition-all bg-accent hover:bg-accent-hover text-on-accent shadow-2xs hover:scale-[1.01] active:scale-[0.99] shrink-0"
          title="Add a link to the knowledge repository (N)"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline whitespace-nowrap">Add New Link</span>
          <span className="sm:hidden whitespace-nowrap">Add</span>
        </button>
      </div>
    </header>
  );
};
