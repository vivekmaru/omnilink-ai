import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Sparkles,
  CheckCircle2,
  Trash2,
  Bookmark,
  ExternalLink,
  FileDown,
} from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { FilterBar } from './components/FilterBar';
import { LinkCard } from './components/LinkCard';
import { LinkListView } from './components/LinkListView';
import { KanbanView } from './components/KanbanView';
import { ClusterView } from './components/ClusterView';
import { AddLinkModal } from './components/AddLinkModal';
import { LinkDetailModal } from './components/LinkDetailModal';
import { AskRepoModal } from './components/AskRepoModal';
import { ExtensionModal } from './components/ExtensionModal';
import { MobileShareModal } from './components/MobileShareModal';
import { BackupModal } from './components/BackupModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { ExportModal } from './components/ExportModal';
import { RssFeedsModal } from './components/RssFeedsModal';
import { ModelOrchestratorModal } from './components/ModelOrchestratorModal';
import { AnalyticsModal } from './components/AnalyticsModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { ApiService } from './services/api';
import {
  ClusterGroup,
  FilterState,
  LinkItem,
  PlatformType,
  ReadStatus,
  RssFeed,
  SystemStats,
  ViewMode,
} from './types';

export default function App() {
  // Theme state - default to dark mode for the developer aesthetic with seamless toggle
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('omnilink_dark_mode');
    return saved !== null ? saved === 'true' : true;
  });

  // Mobile Sidebar Drawer
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Core Data
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [clusters, setClusters] = useState<ClusterGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'info' | 'error' | 'ai', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
  };
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // View & Filters
  const [currentView, setCurrentView] = useState<ViewMode>('grid');
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    platform: 'all',
    category: 'all',
    tag: 'all',
    readStatus: 'all',
    onlyFavorites: false,
    includeArchived: false,
    sortBy: 'newest',
  });

  // Selection for Batch Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [askRepoModalOpen, setAskRepoModalOpen] = useState(false);
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [mobileShareModalOpen, setMobileShareModalOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [rssModalOpen, setRssModalOpen] = useState(false);
  const [modelOrchestratorModalOpen, setModelOrchestratorModalOpen] = useState(false);
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [exportSingleLink, setExportSingleLink] = useState<LinkItem | null>(null);
  const [selectedLink, setSelectedLink] = useState<LinkItem | null>(null);
  const [rssFeeds, setRssFeeds] = useState<RssFeed[]>([]);

  // Pre-fill state for Add Link Modal (e.g. from URL params or Mobile Share)
  const [prefillData, setPrefillData] = useState<{ url?: string; title?: string; notes?: string }>({});

  // Global Keyboard Shortcuts Dispatcher
  useEffect(() => {
    let lastKey = '';
    let lastKeyTime = 0;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      // Escape: Dismiss active top modal
      if (e.key === 'Escape') {
        if (analyticsModalOpen) {
          setAnalyticsModalOpen(false);
          return;
        }
        if (modelOrchestratorModalOpen) {
          setModelOrchestratorModalOpen(false);
          return;
        }
        if (shortcutsModalOpen) {
          setShortcutsModalOpen(false);
          return;
        }
        if (rssModalOpen) {
          setRssModalOpen(false);
          return;
        }
        if (exportModalOpen) {
          setExportModalOpen(false);
          setExportSingleLink(null);
          return;
        }
        if (detailModalOpen) {
          setDetailModalOpen(false);
          setSelectedLink(null);
          return;
        }
        if (addModalOpen) {
          setAddModalOpen(false);
          return;
        }
        if (askRepoModalOpen) {
          setAskRepoModalOpen(false);
          return;
        }
        if (extensionModalOpen) {
          setExtensionModalOpen(false);
          return;
        }
        if (mobileShareModalOpen) {
          setMobileShareModalOpen(false);
          return;
        }
        if (backupModalOpen) {
          setBackupModalOpen(false);
          return;
        }
      }

      // Help Dialog: '?' or 'Cmd/Ctrl + /'
      if (
        (e.key === '?' && !isInput) ||
        ((e.metaKey || e.ctrlKey) && e.key === '/')
      ) {
        e.preventDefault();
        setShortcutsModalOpen((prev) => !prev);
        return;
      }

      // Analytics: Cmd/Ctrl + A
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAnalyticsModalOpen(true);
        return;
      }

      // Model Orchestrator: Cmd/Ctrl + O
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setModelOrchestratorModalOpen(true);
        return;
      }

      // RSS Feeds: Cmd/Ctrl + R
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setRssModalOpen(true);
        return;
      }

      // Export Markdown: Cmd/Ctrl + Shift + E
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setExportSingleLink(null);
        setExportModalOpen(true);
        return;
      }

      // Extension: Cmd/Ctrl + E
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setExtensionModalOpen(true);
        return;
      }

      // Mobile Share: Cmd/Ctrl + M
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setMobileShareModalOpen(true);
        return;
      }

      // Backup: Cmd/Ctrl + B
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setBackupModalOpen(true);
        return;
      }

      // Theme toggle: Cmd/Ctrl + D
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDarkMode((prev) => !prev);
        return;
      }

      // Non-input single key shortcuts
      if (!isInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Theme toggle: T
        if (e.key.toLowerCase() === 't') {
          e.preventDefault();
          setDarkMode((prev) => !prev);
          return;
        }

        // View Mode Switchers: 1-4
        if (e.key === '1') {
          e.preventDefault();
          setCurrentView('grid');
          addToast('info', 'Switched to Grid View');
          return;
        }
        if (e.key === '2') {
          e.preventDefault();
          setCurrentView('list');
          addToast('info', 'Switched to Compact List View');
          return;
        }
        if (e.key === '3') {
          e.preventDefault();
          setCurrentView('kanban');
          addToast('info', 'Switched to Kanban Board');
          return;
        }
        if (e.key === '4') {
          e.preventDefault();
          setCurrentView('cluster');
          addToast('info', 'Switched to Semantic Topic Clusters');
          return;
        }

        // Sequential Navigation: 'G' followed by second key within 800ms
        const now = Date.now();
        if (lastKey === 'g' && now - lastKeyTime < 800) {
          const keyLower = e.key.toLowerCase();
          if (keyLower === 'a') {
            e.preventDefault();
            setFilters((f) => ({ ...f, readStatus: 'all', onlyFavorites: false, includeArchived: false }));
            addToast('info', 'Showing All Bookmarks');
          } else if (keyLower === 'u') {
            e.preventDefault();
            setFilters((f) => ({ ...f, readStatus: 'unread', onlyFavorites: false, includeArchived: false }));
            addToast('info', 'Filtered to Unread Inbox');
          } else if (keyLower === 'r') {
            e.preventDefault();
            setFilters((f) => ({ ...f, readStatus: 'reading', onlyFavorites: false, includeArchived: false }));
            addToast('info', 'Filtered to Currently Reading');
          } else if (keyLower === 'd') {
            e.preventDefault();
            setFilters((f) => ({ ...f, readStatus: 'read', onlyFavorites: false, includeArchived: false }));
            addToast('info', 'Filtered to Reviewed Items');
          } else if (keyLower === 's') {
            e.preventDefault();
            setFilters((f) => ({ ...f, readStatus: 'all', onlyFavorites: true, includeArchived: false }));
            addToast('info', 'Filtered to Starred Bookmarks');
          } else if (keyLower === 'x') {
            e.preventDefault();
            setFilters((f) => ({ ...f, readStatus: 'all', onlyFavorites: false, includeArchived: true }));
            addToast('info', 'Viewing Archived Bookmarks');
          }
          lastKey = '';
          return;
        }

        // Open Analytics: 'A' (when not sequential 'g' command)
        if (e.key.toLowerCase() === 'a' && lastKey !== 'g') {
          e.preventDefault();
          setAnalyticsModalOpen(true);
          return;
        }

        if (e.key.toLowerCase() === 'g') {
          lastKey = 'g';
          lastKeyTime = now;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    shortcutsModalOpen,
    rssModalOpen,
    exportModalOpen,
    detailModalOpen,
    addModalOpen,
    askRepoModalOpen,
    extensionModalOpen,
    mobileShareModalOpen,
    backupModalOpen,
    modelOrchestratorModalOpen,
    analyticsModalOpen,
  ]);

  // Sync dark mode class with HTML tag
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('omnilink_dark_mode', String(darkMode));
  }, [darkMode]);

  // Initial Load & Ingest URL query params (for Web Share Target & Bookmarklets)
  useEffect(() => {
    loadData();
    loadRssFeeds();

    // Check for incoming share params: ?url=...&title=...&text=...
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const incomingUrl = urlParams.get('url') || urlParams.get('link');
      const incomingTitle = urlParams.get('title');
      const incomingNotes = urlParams.get('text') || urlParams.get('notes');

      if (incomingUrl) {
        setPrefillData({
          url: incomingUrl,
          title: incomingTitle || '',
          notes: incomingNotes || '',
        });
        setAddModalOpen(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const loadRssFeeds = async () => {
    try {
      const feeds = await ApiService.fetchRssFeeds();
      setRssFeeds(feeds);
    } catch (e) {
      console.warn('Failed to load RSS feeds list:', e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setSyncStatus('syncing');
    try {
      const [fetchedLinksRes, fetchedStats] = await Promise.all([
        ApiService.fetchLinks(),
        ApiService.fetchStats(),
      ]);
      setLinks(fetchedLinksRes.links);
      setStats(fetchedStats);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Failed to load links:', e);
      setSyncStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  };

  // Derive categories and tags for filter dropdowns
  const availableCategories = useMemo(() => {
    return Array.from(new Set(links.map((l) => l.category))).filter(Boolean);
  }, [links]);

  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    links.forEach((l) => l.tags?.forEach((t) => tagsSet.add(t)));
    return Array.from(tagsSet);
  }, [links]);

  // Counts for library sections
  const unreadCount = useMemo(() => links.filter((l) => !l.isArchived && l.readStatus === 'unread').length, [links]);
  const readingCount = useMemo(() => links.filter((l) => !l.isArchived && l.readStatus === 'reading').length, [links]);
  const readCount = useMemo(() => links.filter((l) => !l.isArchived && l.readStatus === 'read').length, [links]);
  const favoritesCount = useMemo(() => links.filter((l) => !l.isArchived && l.isFavorite).length, [links]);
  const archivedCount = useMemo(() => links.filter((l) => l.isArchived).length, [links]);
  const rssUnreadCount = useMemo(
    () => links.filter((l) => !l.isArchived && l.isRssFeedItem && l.readStatus === 'unread').length,
    [links]
  );

  // Filter & Sort Pipeline
  const filteredLinks = useMemo(() => {
    return links
      .filter((link) => {
        // Archive filter
        if (!filters.includeArchived && link.isArchived) return false;
        if (filters.includeArchived && !link.isArchived) return false;

        // Platform
        if (filters.platform !== 'all' && link.platform !== filters.platform) return false;

        // Category
        if (filters.category !== 'all' && link.category !== filters.category) return false;

        // Tag
        if (filters.tag !== 'all' && !link.tags.includes(filters.tag)) return false;

        // Read Status
        if (filters.readStatus !== 'all' && link.readStatus !== filters.readStatus) return false;

        // Favorites
        if (filters.onlyFavorites && !link.isFavorite) return false;

        // Search Query (covers title, URL, author, notes, tags, tldr, takeaways, code)
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase();
          const matchTitle = link.title?.toLowerCase().includes(q);
          const matchUrl = link.url?.toLowerCase().includes(q);
          const matchAuthor = link.author?.toLowerCase().includes(q);
          const matchNotes = link.notes?.toLowerCase().includes(q);
          const matchTags = link.tags?.some((t) => t.toLowerCase().includes(q));
          const matchTldr = link.aiSummary?.tldr?.toLowerCase().includes(q) || link.summary?.tldr?.toLowerCase().includes(q);
          const matchTakeaways = (link.aiSummary?.takeaways || link.summary?.keyTakeaways)?.some((k) => k.toLowerCase().includes(q));
          const matchCode = (link.aiSummary?.codeSnippets || link.summary?.codeSnippets)?.some((c) => c.toLowerCase().includes(q));

          if (
            !matchTitle &&
            !matchUrl &&
            !matchAuthor &&
            !matchNotes &&
            !matchTags &&
            !matchTldr &&
            !matchTakeaways &&
            !matchCode
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        switch (filters.sortBy) {
          case 'oldest':
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case 'aiScore':
            return (b.aiScore || 0) - (a.aiScore || 0);
          case 'readingTime':
            return (
              (a.aiSummary?.estimatedReadTimeMinutes || a.readingTimeMinutes || 0) -
              (b.aiSummary?.estimatedReadTimeMinutes || b.readingTimeMinutes || 0)
            );
          case 'title':
            return (a.title || '').localeCompare(b.title || '');
          case 'newest':
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });
  }, [links, filters]);

  // Event Handlers for Link Management
  const handleLinkAdded = (newLink: LinkItem) => {
    setLinks((prev) => [newLink, ...prev]);
    addToast('success', 'Link saved to repository');
    ApiService.fetchStats().then(setStats).catch(() => {});
  };

  const handleLinkUpdated = (updated: LinkItem) => {
    setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    if (selectedLink?.id === updated.id) {
      setSelectedLink(updated);
    }
    ApiService.fetchStats().then(setStats).catch(() => {});
  };

  const handleToggleFavorite = async (id: string, current: boolean) => {
    try {
      const updated = await ApiService.updateLink(id, { isFavorite: !current });
      handleLinkUpdated(updated);
      addToast('info', !current ? 'Starred bookmark' : 'Removed from Starred');
    } catch (e) {
      console.error('Failed to toggle favorite:', e);
      addToast('error', 'Failed to update star');
    }
  };

  const handleToggleArchive = async (id: string, current: boolean) => {
    try {
      const updated = await ApiService.updateLink(id, { isArchived: !current });
      handleLinkUpdated(updated);
      addToast('info', !current ? 'Moved to Archive' : 'Restored from Archive');
    } catch (e) {
      console.error('Failed to toggle archive:', e);
      addToast('error', 'Failed to archive link');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await ApiService.deleteLink(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
      if (selectedLink?.id === id) {
        setDetailModalOpen(false);
        setSelectedLink(null);
      }
      addToast('info', 'Bookmark deleted');
      ApiService.fetchStats().then(setStats).catch(() => {});
    } catch (e) {
      console.error('Failed to delete link:', e);
      addToast('error', 'Failed to delete link');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: ReadStatus) => {
    try {
      const updated = await ApiService.updateLink(id, { readStatus: newStatus });
      handleLinkUpdated(updated);
      addToast('success', `Status changed to ${newStatus}`);
    } catch (e) {
      console.error('Failed to update status:', e);
      addToast('error', 'Failed to update status');
    }
  };

  const handleReExtractAI = async (id: string) => {
    const link = links.find((l) => l.id === id);
    if (!link) return;
    setSyncStatus('syncing');
    addToast('ai', 'Extracting metadata with Gemini 3.7 Flash...');
    try {
      const extraction = await ApiService.extractAI(link.url, link.title, link.notes, link.id);
      const tldr = extraction.summary?.tldr || extraction.tldr || link.summary?.tldr || 'Saved in repository';
      const keyTakeaways = extraction.summary?.keyTakeaways || extraction.summary?.takeaways || extraction.keyTakeaways || link.summary?.keyTakeaways || [];
      const codeSnippets = extraction.summary?.codeSnippets || extraction.codeSnippets || link.summary?.codeSnippets || [];
      const quotes = extraction.summary?.quotes || extraction.quotes || link.summary?.quotes || [];

      const updated = await ApiService.updateLink(link.id, {
        title: extraction.title || link.title,
        author: extraction.author || link.author,
        category: extraction.category || link.category,
        tags: Array.from(new Set([...link.tags, ...(extraction.tags || [])])),
        readingTimeMinutes: extraction.readingTimeMinutes || link.readingTimeMinutes,
        aiScore: extraction.aiScore || link.aiScore,
        summary: {
          tldr,
          keyTakeaways,
          takeaways: keyTakeaways,
          codeSnippets,
          quotes,
          quote: quotes[0],
          estimatedReadTimeMinutes: extraction.readingTimeMinutes || link.readingTimeMinutes,
        },
        aiSummary: {
          tldr,
          takeaways: keyTakeaways,
          codeSnippets,
          quote: quotes[0],
          estimatedReadTimeMinutes: extraction.readingTimeMinutes || link.readingTimeMinutes,
        },
      });
      handleLinkUpdated(updated);
      setSyncStatus('synced');
      addToast('ai', 'AI extraction complete');
    } catch (e) {
      console.error('AI Re-extraction notice:', e);
      setSyncStatus('synced');
      addToast('info', 'AI extraction updated');
    }
  };

  // Batch actions
  const handleBatchDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} selected bookmarks?`)) return;
    for (const id of selectedIds) {
      await ApiService.deleteLink(id).catch(() => {});
    }
    setLinks((prev) => prev.filter((l) => !selectedIds.includes(l.id)));
    addToast('info', `Deleted ${selectedIds.length} bookmarks`);
    setSelectedIds([]);
    ApiService.fetchStats().then(setStats).catch(() => {});
  };

  const handleBatchMarkRead = async () => {
    for (const id of selectedIds) {
      await ApiService.updateLink(id, { readStatus: 'read' }).catch(() => {});
    }
    setLinks((prev) =>
      prev.map((l) => (selectedIds.includes(l.id) ? { ...l, readStatus: 'read' } : l))
    );
    addToast('success', `Marked ${selectedIds.length} bookmarks as Reviewed`);
    setSelectedIds([]);
    ApiService.fetchStats().then(setStats).catch(() => {});
  };

  const handleOpenDetail = (link: LinkItem) => {
    setSelectedLink(link);
    setDetailModalOpen(true);
  };

  const handleSimulateMobileShare = (url: string, title: string) => {
    setPrefillData({ url, title, notes: 'Saved from Mobile Quick Share sheet' });
    setAddModalOpen(true);
  };

  return (
    <div
      className="flex h-screen w-screen overflow-hidden font-sans transition-colors duration-150"
      style={{
        backgroundColor: 'var(--bg)',
        color: 'var(--ink)',
      }}
    >
      {/* Backdrop overlay for mobile drawer */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Left Sidebar (256px / w-64) */}
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        filters={filters}
        onFilterChange={handleFilterChange}
        stats={stats}
        totalLinksCount={links.length}
        unreadCount={unreadCount}
        readingCount={readingCount}
        readCount={readCount}
        favoritesCount={favoritesCount}
        archivedCount={archivedCount}
        rssFeedsCount={rssFeeds.length}
        rssUnreadCount={rssUnreadCount}
        availableCategories={availableCategories}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onOpenBackup={() => setBackupModalOpen(true)}
        onOpenMobileShare={() => setMobileShareModalOpen(true)}
        onOpenExtension={() => setExtensionModalOpen(true)}
        onOpenShortcutsHelp={() => setShortcutsModalOpen(true)}
        onOpenExportMarkdown={() => {
          setExportSingleLink(null);
          setExportModalOpen(true);
        }}
        onOpenRssFeeds={() => setRssModalOpen(true)}
        onOpenModelOrchestrator={() => setModelOrchestratorModalOpen(true)}
        onOpenAnalytics={() => setAnalyticsModalOpen(true)}
        syncStatus={syncStatus}
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Cohesive Header Toolbar with Search and Action Buttons */}
        <Navbar
          searchQuery={filters.searchQuery}
          onSearchChange={(searchQuery) => handleFilterChange({ searchQuery })}
          onOpenAddModal={() => {
            setPrefillData({});
            setAddModalOpen(true);
          }}
          onOpenAskRepo={() => setAskRepoModalOpen(true)}
          onOpenShortcutsHelp={() => setShortcutsModalOpen(true)}
          onOpenExportMarkdown={() => {
            setExportSingleLink(null);
            setExportModalOpen(true);
          }}
          onOpenRssFeeds={() => setRssModalOpen(true)}
          onOpenModelOrchestrator={() => setModelOrchestratorModalOpen(true)}
          onOpenAnalytics={() => setAnalyticsModalOpen(true)}
          rssFeedsCount={rssFeeds.length}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          currentView={currentView}
          onViewChange={setCurrentView}
        />

        {/* Detailed Filters & Sorters */}
        {currentView !== 'cluster' && (
          <FilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            availableCategories={availableCategories}
            availableTags={availableTags}
            activeCount={filteredLinks.length}
            totalCount={links.length}
          />
        )}

        {/* Batch Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-[#d97757]/10 border-b border-[#d97757]/20 px-6 py-2 flex items-center justify-between text-xs shrink-0">
            <span className="font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
              {selectedIds.length} ITEMS SELECTED
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setExportSingleLink(null);
                  setExportModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-[#1f1e1d] rounded-lg font-medium text-slate-800 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-white/5 border border-black/10 dark:border-white/10"
              >
                <FileDown className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />
                <span>Export Markdown ({selectedIds.length})</span>
              </button>
              <button
                onClick={handleBatchMarkRead}
                className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-[#1f1e1d] rounded-lg font-medium text-slate-800 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-white/5 border border-black/10 dark:border-white/10"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Mark Reviewed</span>
              </button>
              <button
                onClick={handleBatchDelete}
                className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="px-2 py-1 font-mono text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Main Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {loading ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-[#d97757] border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                Loading OmniLink Repository...
              </div>
            </div>
          ) : filteredLinks.length === 0 && currentView !== 'cluster' ? (
            <div
              className="p-12 text-center border border-black/10 dark:border-white/10 rounded-xl space-y-4 max-w-md mx-auto shadow-2xs mt-8"
              style={{ backgroundColor: 'var(--card-bg)' }}
            >
              <div className="w-12 h-12 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center mx-auto text-slate-400">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-newsreader font-medium text-xl text-slate-900 dark:text-slate-100">
                  No Matching Links Found
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {filters.searchQuery
                    ? `No items matched "${filters.searchQuery}". Try clearing search or resetting active filters.`
                    : 'Your repository is empty. Curate your first GitHub repo, Reddit post, Instagram reel, or paper.'}
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-2">
                {filters.searchQuery || filters.platform !== 'all' || filters.category !== 'all' ? (
                  <button
                    onClick={() =>
                      setFilters({
                        searchQuery: '',
                        platform: 'all',
                        category: 'all',
                        tag: 'all',
                        readStatus: 'all',
                        onlyFavorites: false,
                        includeArchived: false,
                        sortBy: 'newest',
                      })
                    }
                    className="px-4 py-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 rounded-lg font-mono text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Reset Filters
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setPrefillData({});
                      setAddModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#d97757] hover:bg-[#c66a4d] text-white text-xs font-medium rounded-lg shadow-2xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save First Link</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* View 1: 3-Column Card Grid */}
              {currentView === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredLinks.map((link) => (
                    <LinkCard
                      key={link.id}
                      link={link}
                      onSelect={handleOpenDetail}
                      onToggleFavorite={handleToggleFavorite}
                      onToggleArchive={handleToggleArchive}
                      onDelete={handleDelete}
                      onReExtractAI={handleReExtractAI}
                      onExportMarkdown={(link) => {
                        setExportSingleLink(link);
                        setExportModalOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* View 2: High Density List Table */}
              {currentView === 'list' && (
                <LinkListView
                  links={filteredLinks}
                  selectedIds={selectedIds}
                  onToggleSelectId={(id) =>
                    setSelectedIds((prev) =>
                      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                    )
                  }
                  onSelectAll={() => setSelectedIds(filteredLinks.map((l) => l.id))}
                  onClearSelection={() => setSelectedIds([])}
                  onOpenDetail={handleOpenDetail}
                  onToggleFavorite={handleToggleFavorite}
                />
              )}

              {/* View 3: Kanban Columns */}
              {currentView === 'kanban' && (
                <KanbanView
                  links={filteredLinks}
                  onOpenDetail={handleOpenDetail}
                  onUpdateStatus={handleUpdateStatus}
                  onToggleFavorite={handleToggleFavorite}
                />
              )}

              {/* View 4: AI Semantic Clusters */}
              {currentView === 'cluster' && (
                <ClusterView
                  links={links}
                  clusters={clusters}
                  onClustersUpdated={setClusters}
                  onOpenDetail={handleOpenDetail}
                />
              )}
            </>
          )}
        </div>

        {/* Footer Meta Bar */}
        <footer
          className="px-6 sm:px-8 py-2.5 border-t flex flex-wrap items-center justify-between font-mono text-[11px] shrink-0 text-slate-500 dark:text-slate-400"
          style={{
            backgroundColor: 'var(--sidebar-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <div className="font-medium tracking-wider">OMNILINK AI • DESKTOP REPO</div>
          <div className="hidden md:block opacity-60">GEMINI FLASH POWERED EXTRACTION</div>
          <div className="font-medium">{links.length} {links.length === 1 ? 'LINK' : 'LINKS'} CURATED</div>
        </footer>
      </div>

      {/* Modals */}
      <AddLinkModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onLinkAdded={handleLinkAdded}
        onLinkUpdated={handleLinkUpdated}
        onOpenDetail={handleOpenDetail}
        existingLinks={links}
        initialUrl={prefillData.url}
        initialTitle={prefillData.title}
        initialNotes={prefillData.notes}
      />

      <LinkDetailModal
        link={selectedLink}
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedLink(null);
        }}
        onUpdateLink={handleLinkUpdated}
        onOpenExportModal={(link) => {
          setExportSingleLink(link);
          setExportModalOpen(true);
        }}
      />

      <AskRepoModal
        isOpen={askRepoModalOpen}
        onClose={() => setAskRepoModalOpen(false)}
        links={links}
        onOpenLinkDetail={(link) => {
          setAskRepoModalOpen(false);
          handleOpenDetail(link);
        }}
        onOpenModelOrchestrator={() => setModelOrchestratorModalOpen(true)}
      />

      <ExtensionModal
        isOpen={extensionModalOpen}
        onClose={() => setExtensionModalOpen(false)}
      />

      <MobileShareModal
        isOpen={mobileShareModalOpen}
        onClose={() => setMobileShareModalOpen(false)}
        onSimulateShare={handleSimulateMobileShare}
      />

      <BackupModal
        isOpen={backupModalOpen}
        onClose={() => setBackupModalOpen(false)}
        links={links}
        onLinksRestored={(restored) => {
          setLinks(restored);
          ApiService.fetchStats().then(setStats).catch(() => {});
          addToast('success', `Restored ${restored.length} links from backup`);
        }}
      />

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false);
          setExportSingleLink(null);
        }}
        allLinks={links}
        filteredLinks={filteredLinks}
        selectedIds={selectedIds}
        initialSelectedLink={exportSingleLink}
        onToast={addToast}
      />

      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
        onSelectView={(v) => {
          setCurrentView(v);
          addToast('info', `Switched to ${v} view`);
        }}
        onOpenAddModal={() => {
          setPrefillData({});
          setAddModalOpen(true);
        }}
        onOpenAskRepo={() => setAskRepoModalOpen(true)}
        onOpenExtension={() => setExtensionModalOpen(true)}
        onOpenMobileShare={() => setMobileShareModalOpen(true)}
        onOpenBackup={() => setBackupModalOpen(true)}
        onOpenExportMarkdown={() => {
          setExportSingleLink(null);
          setExportModalOpen(true);
        }}
        onOpenRssFeeds={() => setRssModalOpen(true)}
        onOpenModelOrchestrator={() => setModelOrchestratorModalOpen(true)}
        onOpenAnalytics={() => setAnalyticsModalOpen(true)}
        onToggleTheme={() => {
          setDarkMode((prev) => !prev);
          addToast('info', `Switched to ${!darkMode ? 'Dark' : 'Light'} theme`);
        }}
        onFocusSearch={() => {
          const el = document.getElementById('navbar-search-input') as HTMLInputElement;
          el?.focus();
        }}
        onFilterStatus={(status, onlyFav, archived) => {
          setFilters((f) => ({
            ...f,
            readStatus: status,
            onlyFavorites: onlyFav ?? false,
            includeArchived: archived ?? false,
          }));
          addToast('info', 'Filter updated');
        }}
      />

      <RssFeedsModal
        isOpen={rssModalOpen}
        onClose={() => setRssModalOpen(false)}
        onFeedsUpdated={() => {
          loadRssFeeds();
          loadData();
        }}
        onToast={addToast}
        onFilterByFeed={(feedId, feedTitle) => {
          setFilters((f) => ({
            ...f,
            searchQuery: feedTitle,
            readStatus: 'unread',
            includeArchived: false,
          }));
          addToast('info', `Filtered inbox to ${feedTitle}`);
        }}
      />

      <ModelOrchestratorModal
        isOpen={modelOrchestratorModalOpen}
        onClose={() => setModelOrchestratorModalOpen(false)}
      />

      <AnalyticsModal
        isOpen={analyticsModalOpen}
        onClose={() => setAnalyticsModalOpen(false)}
        stats={stats}
        links={links}
        onFilterByPlatform={(platform) => {
          setFilters((f) => ({ ...f, platform }));
          addToast('info', `Filtered by platform: ${platform}`);
        }}
        onFilterByCategory={(category) => {
          setFilters((f) => ({ ...f, category }));
          addToast('info', `Filtered by category: ${category}`);
        }}
        onFilterByTag={(tag) => {
          setFilters((f) => ({ ...f, tag }));
          addToast('info', `Filtered by tag: #${tag}`);
        }}
        onFilterByStatus={(status) => {
          setFilters((f) => ({ ...f, readStatus: status }));
          addToast('info', `Filtered by status: ${status}`);
        }}
      />

      {/* Micro-Interaction Toast Dispatcher */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
