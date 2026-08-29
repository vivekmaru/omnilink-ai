import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Keyboard,
  Search,
  Sparkles,
  Plus,
  LayoutGrid,
  List,
  Columns3,
  Network,
  ShieldCheck,
  Share2,
  Chrome,
  Sun,
  Moon,
  Bookmark,
  Star,
  Archive,
  ArrowRight,
  Command,
  Cpu,
} from 'lucide-react';
import { ViewMode } from '../types';

export interface ShortcutItem {
  id: string;
  category: 'navigation' | 'actions' | 'views' | 'filters';
  title: string;
  description: string;
  keys: string[][]; // e.g. [['⌘', 'K'], ['/']]
  actionId?: string;
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectView?: (view: ViewMode) => void;
  onOpenAddModal?: () => void;
  onOpenAskRepo?: () => void;
  onOpenExtension?: () => void;
  onOpenMobileShare?: () => void;
  onOpenBackup?: () => void;
  onOpenExportMarkdown?: () => void;
  onOpenRssFeeds?: () => void;
  onOpenModelOrchestrator?: () => void;
  onOpenAnalytics?: () => void;
  onToggleTheme?: () => void;
  onFocusSearch?: () => void;
  onFilterStatus?: (status: 'all' | 'unread' | 'reading' | 'read', onlyFav?: boolean, archived?: boolean) => void;
}

const SHORTCUT_CATEGORIES = [
  { id: 'all', label: 'All Shortcuts' },
  { id: 'navigation', label: 'Navigation & Search' },
  { id: 'actions', label: 'Actions & Modals' },
  { id: 'views', label: 'Views & Layout' },
  { id: 'filters', label: 'Triage & Filters' },
] as const;

const SHORTCUTS_DATA: ShortcutItem[] = [
  // Navigation & Search
  {
    id: 'search',
    category: 'navigation',
    title: 'Search Repository',
    description: 'Instantly focus the global search bar across titles, tags, and AI insights',
    keys: [['⌘', 'K'], ['/']],
    actionId: 'focus-search',
  },
  {
    id: 'ask-ai',
    category: 'navigation',
    title: 'Ask Repo AI Assistant',
    description: 'Open conversational RAG search over your saved knowledge base',
    keys: [['⌘', 'J']],
    actionId: 'open-ask-ai',
  },
  {
    id: 'help',
    category: 'navigation',
    title: 'Keyboard Shortcuts Help',
    description: 'Open this searchable keyboard navigation and actions reference',
    keys: [['?'], ['⌘', '/']],
    actionId: 'open-help',
  },
  {
    id: 'dismiss',
    category: 'navigation',
    title: 'Dismiss / Clear Search',
    description: 'Close the active modal or clear search query input',
    keys: [['Esc']],
    actionId: 'dismiss',
  },

  // Actions & Modals
  {
    id: 'add-link',
    category: 'actions',
    title: 'Add New Link',
    description: 'Open the link ingestion modal with real-time keyword auto-tagging',
    keys: [['N'], ['⌘', 'N']],
    actionId: 'open-add-link',
  },
  {
    id: 'extension',
    category: 'actions',
    title: 'Chrome Extension & Bookmarklet',
    description: 'Open extension generator package and 1-click drag-to-bookmarks setup',
    keys: [['⌘', 'E']],
    actionId: 'open-extension',
  },
  {
    id: 'mobile-share',
    category: 'actions',
    title: 'Mobile Quick Share & QR Connect',
    description: 'Connect mobile device or simulate Web Share Target payload ingestion',
    keys: [['⌘', 'M']],
    actionId: 'open-mobile-share',
  },
  {
    id: 'backup',
    category: 'actions',
    title: 'AES-256 Encrypted Vault Backup',
    description: 'Export or restore zero-knowledge encrypted backups and JSON datasets',
    keys: [['⌘', 'B']],
    actionId: 'open-backup',
  },
  {
    id: 'export-markdown',
    category: 'actions',
    title: 'Export Markdown (Obsidian / Notion)',
    description: 'Generate Markdown with YAML frontmatter, Obsidian callouts, and code blocks',
    keys: [['⌘', '⇧', 'E']],
    actionId: 'open-export-markdown',
  },
  {
    id: 'rss-feeds',
    category: 'actions',
    title: 'RSS Feeds & Dev Blogs Subscriptions',
    description: 'Manage RSS feed subscriptions, discover feeds, and run instant background sync',
    keys: [['⌘', 'R']],
    actionId: 'open-rss-feeds',
  },
  {
    id: 'model-orchestrator',
    category: 'actions',
    title: 'Gemini Model Orchestrator & Router',
    description: 'Inspect multi-tier model routing matrix, latency telemetry, and failover chains',
    keys: [['⌘', 'O']],
    actionId: 'open-model-orchestrator',
  },
  {
    id: 'analytics',
    category: 'actions',
    title: 'Knowledge Analytics & Usage Insights',
    description: 'Inspect reading velocity, platform breakdown, tag frequencies, and completion ratios',
    keys: [['⌘', '⇧', 'A'], ['⌘', 'A']],
    actionId: 'open-analytics',
  },
  {
    id: 'toggle-theme',
    category: 'actions',
    title: 'Toggle Dark / Light Mode',
    description: 'Switch between near-black technical canvas and crisp light theme',
    keys: [['⌘', 'D'], ['T']],
    actionId: 'toggle-theme',
  },

  // Views & Layout
  {
    id: 'view-grid',
    category: 'views',
    title: 'Card Grid View',
    description: 'Switch to spacious 3-column desktop card grid with full insight badges',
    keys: [['1']],
    actionId: 'view-grid',
  },
  {
    id: 'view-list',
    category: 'views',
    title: 'Compact List View',
    description: 'Switch to high-density tabular view for rapid triage and keyboard scanning',
    keys: [['2']],
    actionId: 'view-list',
  },
  {
    id: 'view-kanban',
    category: 'views',
    title: 'Kanban Workflow Board',
    description: 'Switch to drag-and-drop lanes for Unread, Reading, and Reviewed links',
    keys: [['3']],
    actionId: 'view-kanban',
  },
  {
    id: 'view-cluster',
    category: 'views',
    title: 'AI Semantic Topic Clusters',
    description: 'Switch to neural knowledge graph grouping links by high-dimensional topics',
    keys: [['4']],
    actionId: 'view-cluster',
  },

  // Triage & Filters
  {
    id: 'filter-all',
    category: 'filters',
    title: 'Filter: All Bookmarks',
    description: 'Show all unarchived bookmarks in repository',
    keys: [['G', 'A']],
    actionId: 'filter-all',
  },
  {
    id: 'filter-unread',
    category: 'filters',
    title: 'Filter: Unread Inbox',
    description: 'Show links waiting for triage and deep reading',
    keys: [['G', 'U']],
    actionId: 'filter-unread',
  },
  {
    id: 'filter-reading',
    category: 'filters',
    title: 'Filter: Currently Reading',
    description: 'Show active in-progress study materials',
    keys: [['G', 'R']],
    actionId: 'filter-reading',
  },
  {
    id: 'filter-read',
    category: 'filters',
    title: 'Filter: Reviewed & Done',
    description: 'Show finished and processed knowledge assets',
    keys: [['G', 'D']],
    actionId: 'filter-read',
  },
  {
    id: 'filter-starred',
    category: 'filters',
    title: 'Filter: Starred / Favorites',
    description: 'Show pinned and favorite bookmarks',
    keys: [['G', 'S']],
    actionId: 'filter-starred',
  },
  {
    id: 'filter-archived',
    category: 'filters',
    title: 'Filter: Archive Vault',
    description: 'View archived items removed from main library',
    keys: [['G', 'X']],
    actionId: 'filter-archived',
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  onSelectView,
  onOpenAddModal,
  onOpenAskRepo,
  onOpenExtension,
  onOpenMobileShare,
  onOpenBackup,
  onOpenExportMarkdown,
  onOpenRssFeeds,
  onOpenModelOrchestrator,
  onOpenAnalytics,
  onToggleTheme,
  onFocusSearch,
  onFilterStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input on modal open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedCategory('all');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Filter shortcuts based on category and search query
  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return SHORTCUTS_DATA.filter((shortcut) => {
      // Category filter
      if (selectedCategory !== 'all' && shortcut.category !== selectedCategory) {
        return false;
      }

      // Search query filter
      if (!q) return true;

      const titleMatch = shortcut.title.toLowerCase().includes(q);
      const descMatch = shortcut.description.toLowerCase().includes(q);
      const categoryMatch = shortcut.category.toLowerCase().includes(q);
      const keysMatch = shortcut.keys.some((combo) =>
        combo.join('').toLowerCase().includes(q) || combo.some((k) => k.toLowerCase().includes(q))
      );

      return titleMatch || descMatch || categoryMatch || keysMatch;
    });
  }, [searchQuery, selectedCategory]);

  if (!isOpen) return null;

  const handleTriggerAction = (actionId?: string) => {
    if (!actionId) return;

    onClose();

    switch (actionId) {
      case 'focus-search':
        setTimeout(() => onFocusSearch?.(), 100);
        break;
      case 'open-ask-ai':
        setTimeout(() => onOpenAskRepo?.(), 100);
        break;
      case 'open-add-link':
        setTimeout(() => onOpenAddModal?.(), 100);
        break;
      case 'open-extension':
        setTimeout(() => onOpenExtension?.(), 100);
        break;
      case 'open-mobile-share':
        setTimeout(() => onOpenMobileShare?.(), 100);
        break;
      case 'open-backup':
        setTimeout(() => onOpenBackup?.(), 100);
        break;
      case 'open-export-markdown':
        setTimeout(() => onOpenExportMarkdown?.(), 100);
        break;
      case 'open-rss-feeds':
        setTimeout(() => onOpenRssFeeds?.(), 100);
        break;
      case 'open-model-orchestrator':
        setTimeout(() => onOpenModelOrchestrator?.(), 100);
        break;
      case 'open-analytics':
        setTimeout(() => onOpenAnalytics?.(), 100);
        break;
      case 'toggle-theme':
        onToggleTheme?.();
        break;
      case 'view-grid':
        onSelectView?.('grid');
        break;
      case 'view-list':
        onSelectView?.('list');
        break;
      case 'view-kanban':
        onSelectView?.('kanban');
        break;
      case 'view-cluster':
        onSelectView?.('cluster');
        break;
      case 'filter-all':
        onFilterStatus?.('all', false, false);
        break;
      case 'filter-unread':
        onFilterStatus?.('unread', false, false);
        break;
      case 'filter-reading':
        onFilterStatus?.('reading', false, false);
        break;
      case 'filter-read':
        onFilterStatus?.('read', false, false);
        break;
      case 'filter-starred':
        onFilterStatus?.('all', true, false);
        break;
      case 'filter-archived':
        onFilterStatus?.('all', false, true);
        break;
      default:
        break;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'navigation':
        return <Search className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />;
      case 'actions':
        return <Plus className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />;
      case 'views':
        return <LayoutGrid className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />;
      case 'filters':
        return <Bookmark className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />;
      default:
        return <Keyboard className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div
      id="keyboard-shortcuts-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden transition-all bg-white dark:bg-[#18181b] text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 pb-4 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/5 text-[#d97757] dark:text-[#e08264] flex items-center justify-center border border-black/5 dark:border-white/5">
                <Keyboard className="w-4 h-4" />
              </div>
              <div>
                <h3 id="shortcuts-modal-title" className="font-newsreader text-lg font-medium text-slate-900 dark:text-[#f7f6f3] flex items-center gap-2">
                  Keyboard Shortcuts
                  <span className="font-mono text-[11px] font-normal px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                    {filteredShortcuts.length} of {SHORTCUTS_DATA.length}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Navigate, triage, and trigger actions with rapid desktop hotkeys
                </p>
              </div>
            </div>

            <button
              id="close-shortcuts-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Close dialog (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Shortcuts Input */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              id="shortcuts-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcuts by action, description, or key..."
              className="w-full pl-9.5 pr-8 py-2 rounded-xl text-xs outline-none transition-all border text-slate-900 dark:text-[#f7f6f3] placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-black/5 dark:bg-white/[0.04] border-transparent focus:border-[#d97757] focus:bg-white dark:focus:bg-[#18181b]"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
            {SHORTCUT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-[#d97757]/15 text-[#d97757] dark:text-[#e08264] border border-[#d97757]/30 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Shortcuts List Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2 bg-white dark:bg-[#18181b]">
          {filteredShortcuts.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Keyboard className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No shortcuts found for "{searchQuery}"
              </p>
              <p className="text-xs text-slate-400">
                Try searching for "view", "search", "add", or "filter"
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs font-medium text-[#d97757] hover:underline"
              >
                Clear Search Query
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredShortcuts.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleTriggerAction(item.actionId)}
                  className="group flex items-center justify-between p-3 rounded-xl border border-black/5 dark:border-white/5 hover:border-[#d97757]/40 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-3 min-w-0 pr-4">
                    <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-white dark:bg-[#1e1e24] border border-black/10 dark:border-white/10 shadow-2xs">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold text-slate-900 dark:text-[#f7f6f3] group-hover:text-[#d97757] dark:group-hover:text-[#e08264] transition-colors">
                          {item.title}
                        </h4>
                        <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-wider text-slate-400">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Key Combo Display */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.keys.map((combo, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && (
                          <span className="text-[10px] text-slate-400 font-mono px-0.5">
                            or
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          {combo.map((key, kIdx) => (
                            <kbd
                              key={kIdx}
                              className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#1e1e24] border border-black/10 dark:border-white/15 shadow-2xs group-hover:border-[#d97757]/40 transition-all"
                            >
                              {key === '⌘' ? (
                                <span className="text-[11px]">⌘</span>
                              ) : (
                                key
                              )}
                            </kbd>
                          ))}
                        </div>
                      </React.Fragment>
                    ))}
                    <div className="hidden group-hover:flex items-center pl-1.5 text-[#d97757] dark:text-[#e08264]">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer Tip */}
        <div className="p-3.5 px-5 border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 font-medium">
              ?
            </kbd>
            <span>anywhere to toggle this guide</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Click any item to execute</span>
            <span>•</span>
            <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 font-medium">
              Esc
            </kbd>
            <span>to close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
