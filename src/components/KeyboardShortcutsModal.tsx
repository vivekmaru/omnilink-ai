import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Keyboard, Search } from 'lucide-react';
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
  { id: 'all', label: 'All' },
  { id: 'navigation', label: 'Search' },
  { id: 'actions', label: 'Actions' },
  { id: 'views', label: 'Views' },
  { id: 'filters', label: 'Filters' },
] as const;

const SHORTCUTS_DATA: ShortcutItem[] = [
  // Navigation & Search
  {
    id: 'search',
    category: 'navigation',
    title: 'Search links',
    description: 'Jump to the search box',
    keys: [['⌘', 'K'], ['/']],
    actionId: 'focus-search',
  },
  {
    id: 'ask-ai',
    category: 'navigation',
    title: 'Ask AI',
    description: 'Ask a question about your saved links',
    keys: [['⌘', 'J']],
    actionId: 'open-ask-ai',
  },
  {
    id: 'help',
    category: 'navigation',
    title: 'Keyboard shortcuts',
    description: 'Show this list',
    keys: [['?'], ['⌘', '/']],
    actionId: 'open-help',
  },
  {
    id: 'dismiss',
    category: 'navigation',
    title: 'Close or clear',
    description: 'Close the open window or clear the search',
    keys: [['Esc']],
    actionId: 'dismiss',
  },

  // Actions & Modals
  {
    id: 'add-link',
    category: 'actions',
    title: 'Add link',
    description: 'Save a new link',
    keys: [['N'], ['⌘', 'N']],
    actionId: 'open-add-link',
  },
  {
    id: 'extension',
    category: 'actions',
    title: 'Browser extension',
    description: 'Set up the Chrome extension or bookmarklet',
    keys: [['⌘', 'E']],
    actionId: 'open-extension',
  },
  {
    id: 'mobile-share',
    category: 'actions',
    title: 'Save from your phone',
    description: 'Connect your phone with a QR code',
    keys: [['⌘', 'M']],
    actionId: 'open-mobile-share',
  },
  {
    id: 'backup',
    category: 'actions',
    title: 'Backup',
    description: 'Export or restore an encrypted backup',
    keys: [['⌘', 'B']],
    actionId: 'open-backup',
  },
  {
    id: 'export-markdown',
    category: 'actions',
    title: 'Export Markdown',
    description: 'Export links as Markdown for Obsidian or Notion',
    keys: [['⌘', '⇧', 'E']],
    actionId: 'open-export-markdown',
  },
  {
    id: 'rss-feeds',
    category: 'actions',
    title: 'RSS feeds',
    description: 'Manage and sync your feeds',
    keys: [['⌘', 'R']],
    actionId: 'open-rss-feeds',
  },
  {
    id: 'model-orchestrator',
    category: 'actions',
    title: 'AI models',
    description: 'See which models are used and how they perform',
    keys: [['⌘', 'O']],
    actionId: 'open-model-orchestrator',
  },
  {
    id: 'analytics',
    category: 'actions',
    title: 'Analytics',
    description: 'Reading stats, sources and tags',
    keys: [['⌘', '⇧', 'A'], ['⌘', 'A']],
    actionId: 'open-analytics',
  },
  {
    id: 'toggle-theme',
    category: 'actions',
    title: 'Dark or light theme',
    description: 'Switch between dark and light',
    keys: [['⌘', 'D'], ['T']],
    actionId: 'toggle-theme',
  },

  // Views & Layout
  {
    id: 'view-grid',
    category: 'views',
    title: 'Grid',
    description: 'Show links as cards',
    keys: [['1']],
    actionId: 'view-grid',
  },
  {
    id: 'view-list',
    category: 'views',
    title: 'List',
    description: 'Show links as a compact list',
    keys: [['2']],
    actionId: 'view-list',
  },
  {
    id: 'view-kanban',
    category: 'views',
    title: 'Board',
    description: 'Drag links between To read, Reading and Read',
    keys: [['3']],
    actionId: 'view-kanban',
  },
  {
    id: 'view-cluster',
    category: 'views',
    title: 'Topics',
    description: 'Group links by topic',
    keys: [['4']],
    actionId: 'view-cluster',
  },

  // Triage & Filters
  {
    id: 'filter-all',
    category: 'filters',
    title: 'All links',
    description: 'Show everything except archived links',
    keys: [['G', 'A']],
    actionId: 'filter-all',
  },
  {
    id: 'filter-unread',
    category: 'filters',
    title: 'To read',
    description: 'Show links you have not read yet',
    keys: [['G', 'U']],
    actionId: 'filter-unread',
  },
  {
    id: 'filter-reading',
    category: 'filters',
    title: 'Reading',
    description: 'Show links you are partway through',
    keys: [['G', 'R']],
    actionId: 'filter-reading',
  },
  {
    id: 'filter-read',
    category: 'filters',
    title: 'Read',
    description: 'Show links you have finished',
    keys: [['G', 'D']],
    actionId: 'filter-read',
  },
  {
    id: 'filter-starred',
    category: 'filters',
    title: 'Starred',
    description: 'Show starred links',
    keys: [['G', 'S']],
    actionId: 'filter-starred',
  },
  {
    id: 'filter-archived',
    category: 'filters',
    title: 'Archived',
    description: 'Show archived links',
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

  return (
    <div
      id="keyboard-shortcuts-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl border shadow-xl overflow-hidden text-slate-900 dark:text-slate-100"
        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 pt-4 border-b border-black/[0.08] dark:border-white/[0.08]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 id="shortcuts-modal-title" className="text-base font-semibold text-slate-900 dark:text-ink">
                Keyboard shortcuts
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Press a key, or click a row to run it
              </p>
            </div>

            <button
              id="close-shortcuts-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              aria-label="Close"
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
              placeholder="Search shortcuts"
              className="w-full pl-9.5 pr-8 py-2 rounded-md text-sm outline-none transition-colors border text-slate-900 dark:text-ink placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-white dark:bg-surface border-black/10 dark:border-white/10 focus:border-accent"
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
          <div className="flex items-center gap-5 overflow-x-auto no-scrollbar text-sm">
            {SHORTCUT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`py-2 -mb-px border-b-2 transition-colors shrink-0 ${
                  selectedCategory === cat.id
                    ? 'border-accent text-slate-900 dark:text-ink font-medium'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Shortcuts List Content */}
        <div className="flex-1 overflow-y-auto px-3 py-2 sm:px-4">
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
                className="mt-2 text-xs font-medium text-accent hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
              {filteredShortcuts.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleTriggerAction(item.actionId)}
                  className="group flex items-center justify-between px-2 py-2.5 rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  <div className="min-w-0 pr-4">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-ink">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {item.description}
                    </p>
                  </div>

                  {/* Key Combo Display */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.keys.map((combo, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && (
                          <span className="text-xs text-slate-400 px-0.5">
                            or
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          {combo.map((key, kIdx) => (
                            <kbd
                              key={kIdx}
                              className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded font-sans text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10"
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
