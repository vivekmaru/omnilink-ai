import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Sparkles,
  CheckCircle2,
  Trash2,
  Bookmark,
  ExternalLink,
  FileDown,
  Check,
  Circle,
  Folder,
} from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { FilterBar } from './components/FilterBar';
import { LinkCard } from './components/LinkCard';
import { LinkListView } from './components/LinkListView';
import { AddLinkModal } from './components/AddLinkModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { ApiService } from './services/api';

// Code-splitting heavy secondary views and modal bundles via React.lazy
const KanbanView = React.lazy(() => import('./components/KanbanView').then((m) => ({ default: m.KanbanView })));
const ClusterView = React.lazy(() => import('./components/ClusterView').then((m) => ({ default: m.ClusterView })));
const LinkDetailModal = React.lazy(() => import('./components/LinkDetailModal').then((m) => ({ default: m.LinkDetailModal })));
const AskRepoModal = React.lazy(() => import('./components/AskRepoModal').then((m) => ({ default: m.AskRepoModal })));
const ExtensionModal = React.lazy(() => import('./components/ExtensionModal').then((m) => ({ default: m.ExtensionModal })));
const MobileShareModal = React.lazy(() => import('./components/MobileShareModal').then((m) => ({ default: m.MobileShareModal })));
const BackupModal = React.lazy(() => import('./components/BackupModal').then((m) => ({ default: m.BackupModal })));
const KeyboardShortcutsModal = React.lazy(() => import('./components/KeyboardShortcutsModal').then((m) => ({ default: m.KeyboardShortcutsModal })));
const ExportModal = React.lazy(() => import('./components/ExportModal').then((m) => ({ default: m.ExportModal })));
const RssFeedsModal = React.lazy(() => import('./components/RssFeedsModal').then((m) => ({ default: m.RssFeedsModal })));
const ModelOrchestratorModal = React.lazy(() => import('./components/ModelOrchestratorModal').then((m) => ({ default: m.ModelOrchestratorModal })));
const AnalyticsModal = React.lazy(() => import('./components/AnalyticsModal').then((m) => ({ default: m.AnalyticsModal })));
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
import { parseShareTargetParams } from './utils/url';

export default function App() {
  // Theme state - default to dark mode for the developer aesthetic with seamless toggle
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('omnilink_dark_mode');
    return saved !== null ? saved === 'true' : true;
  });

  // Mobile Sidebar Drawer
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Core Data - Hydrated immediately from local storage cache for instant 0ms first paint
  const [links, setLinks] = useState<LinkItem[]>(() => ApiService.getLocalCache());
  const [stats, setStats] = useState<SystemStats | null>(() => ApiService.getLocalStats());
  const [clusters, setClusters] = useState<ClusterGroup[]>([]);
  const [loading, setLoading] = useState(() => ApiService.getLocalCache().length === 0);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');

  // Toasts & Safe Undo Management
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const pendingDeletionsRef = useRef<Map<string, { timer: ReturnType<typeof setTimeout>; link: LinkItem }>>(new Map());

  const addToast = (
    type: 'success' | 'info' | 'error' | 'ai',
    message: string,
    options?: { duration?: number; action?: { label: string; onClick: () => void } }
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => {
      // Prevent stacking identical toast messages
      const filtered = prev.filter((t) => t.message !== message);
      const nextList = [
        ...filtered,
        {
          id,
          type,
          message,
          duration: options?.duration,
          action: options?.action,
        },
      ];
      // Cap at 3 toasts
      return nextList.slice(-3);
    });
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

      // List View: Cmd/Ctrl + A selects all rows
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'a') {
        if (currentView === 'list' && !isInput) {
          e.preventDefault();
          if (selectedIds.length === filteredLinks.length && filteredLinks.length > 0) {
            setSelectedIds([]);
          } else {
            setSelectedIds(filteredLinks.map((l) => l.id));
          }
          return;
        }
      }

      // Analytics: Cmd/Ctrl + Shift + A (or Cmd/Ctrl + A when not in List view)
      if ((e.metaKey || e.ctrlKey) && ((e.shiftKey && e.key.toLowerCase() === 'a') || (!e.shiftKey && e.key.toLowerCase() === 'a' && currentView !== 'list'))) {
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
          return;
        }
        if (e.key === '2') {
          e.preventDefault();
          setCurrentView('list');
          return;
        }
        if (e.key === '3') {
          e.preventDefault();
          setCurrentView('kanban');
          return;
        }
        if (e.key === '4') {
          e.preventDefault();
          setCurrentView('cluster');
          return;
        }

        // Sequential Navigation: 'G' followed by second key within 800ms
        const now = Date.now();
        if (lastKey === 'g' && now - lastKeyTime < 800) {
          const keyLower = e.key.toLowerCase();
          if (keyLower === 'a') {
            e.preventDefault();
            setFilters((f) => ({ ...f, readStatus: 'all', onlyFavorites: false, includeArchived: false }));
          } else if (keyLower === 'u') {
            e.preventDefault();
            setFilters((f) => ({ ...f, readStatus: 'unread', onlyFavorites: false, includeArchived: false }));
          } else if (keyLower === 'r') {
            e.preventDefault();
            setFilters((f) => ({ ...f, readStatus: 'reading', onlyFavorites: false, includeArchived: false }));
          } else if (keyLower === 'd') {
            e.preventDefault();
            setFilters((f) => ({ ...f, readStatus: 'read', onlyFavorites: false, includeArchived: false }));
          } else if (keyLower === 's') {
            e.preventDefault();
            setFilters((f) => ({ ...f, readStatus: 'all', onlyFavorites: true, includeArchived: false }));
          } else if (keyLower === 'x') {
            e.preventDefault();
            setFilters((f) => ({ ...f, readStatus: 'all', onlyFavorites: false, includeArchived: true }));
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

    // Check for incoming share params: ?url=...&title=...&text=... (from Web Share Target or Apple Shortcuts)
    if (typeof window !== 'undefined' && window.location.search) {
      const shareData = parseShareTargetParams(window.location.search);

      if (shareData.url) {
        setPrefillData({
          url: shareData.url,
          title: shareData.title || '',
          notes: shareData.notes || '',
        });
        setAddModalOpen(true);
        addToast('ai', `Captured link from mobile share: ${shareData.url.slice(0, 35)}...`);
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
    // Only show full loading spinner if cache is empty
    if (links.length === 0) {
      setLoading(true);
    }
    setSyncStatus('syncing');
    try {
      const [fetchedLinksRes, fetchedStats] = await Promise.all([
        ApiService.fetchLinks(),
        ApiService.fetchStats(),
      ]);
      if (!fetchedLinksRes.notModified) {
        setLinks(fetchedLinksRes.links);
      }
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
    const nextFav = !current;
    // Optimistic state update (instant UI transition)
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, isFavorite: nextFav } : l)));
    if (selectedLink?.id === id) {
      setSelectedLink((prev) => (prev ? { ...prev, isFavorite: nextFav } : null));
    }
    try {
      const updated = await ApiService.updateLink(id, { isFavorite: nextFav });
      handleLinkUpdated(updated);
    } catch (e) {
      // Revert on error
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, isFavorite: current } : l)));
      if (selectedLink?.id === id) {
        setSelectedLink((prev) => (prev ? { ...prev, isFavorite: current } : null));
      }
      addToast('error', 'Failed to update star');
    }
  };

  const handleToggleArchive = async (id: string, current: boolean) => {
    const nextArchived = !current;
    // Optimistic state update (instant UI transition)
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, isArchived: nextArchived } : l)));
    if (selectedLink?.id === id) {
      setSelectedLink((prev) => (prev ? { ...prev, isArchived: nextArchived } : null));
    }
    try {
      const updated = await ApiService.updateLink(id, { isArchived: nextArchived });
      handleLinkUpdated(updated);
    } catch (e) {
      // Revert on error
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, isArchived: current } : l)));
      if (selectedLink?.id === id) {
        setSelectedLink((prev) => (prev ? { ...prev, isArchived: current } : null));
      }
      addToast('error', 'Failed to archive link');
    }
  };

  const handleDelete = (id: string) => {
    const linkToDelete = links.find((l) => l.id === id);
    if (!linkToDelete) return;

    // Optimistically remove from state
    setLinks((prev) => prev.filter((l) => l.id !== id));
    if (selectedLink?.id === id) {
      setDetailModalOpen(false);
      setSelectedLink(null);
    }

    // Hold deletion in buffer for 6 seconds before persisting to backend
    const timer = setTimeout(async () => {
      try {
        await ApiService.deleteLink(id);
        pendingDeletionsRef.current.delete(id);
        ApiService.fetchStats().then(setStats).catch(() => {});
      } catch (e) {
        console.error('Failed to permanently delete link:', e);
      }
    }, 6000);

    pendingDeletionsRef.current.set(id, { timer, link: linkToDelete });

    addToast('info', 'Bookmark deleted', {
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: () => {
          const pending = pendingDeletionsRef.current.get(id);
          if (pending) {
            clearTimeout(pending.timer);
            pendingDeletionsRef.current.delete(id);
            setLinks((prev) => [pending.link, ...prev]);
            addToast('success', 'Bookmark restored');
          }
        },
      },
    });
  };

  const handleUpdateStatus = async (id: string, newStatus: ReadStatus) => {
    const originalLink = links.find((l) => l.id === id);
    const prevStatus = originalLink?.readStatus;
    // Optimistic state update (instant UI transition in Kanban/grid)
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, readStatus: newStatus } : l)));
    if (selectedLink?.id === id) {
      setSelectedLink((prev) => (prev ? { ...prev, readStatus: newStatus } : null));
    }
    try {
      const updated = await ApiService.updateLink(id, { readStatus: newStatus });
      handleLinkUpdated(updated);
    } catch (e) {
      if (prevStatus) {
        setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, readStatus: prevStatus } : l)));
        if (selectedLink?.id === id) {
          setSelectedLink((prev) => (prev ? { ...prev, readStatus: prevStatus } : null));
        }
      }
      addToast('error', 'Failed to update reading status');
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

  // Batch actions with atomic backend execution & Undo
  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    const linksToDelete = links.filter((l) => selectedIds.includes(l.id));
    if (linksToDelete.length === 0) return;

    const batchIds = [...selectedIds];
    setSelectedIds([]);
    // Optimistic UI update
    setLinks((prev) => prev.filter((l) => !batchIds.includes(l.id)));

    const batchTimer = setTimeout(async () => {
      await ApiService.batchAction(batchIds, 'delete').catch(() => {});
      ApiService.fetchStats().then(setStats).catch(() => {});
    }, 6000);

    addToast('info', `Deleted ${batchIds.length} bookmarks`, {
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(batchTimer);
          setLinks((prev) => [...linksToDelete, ...prev.filter((l) => !batchIds.includes(l.id))]);
          addToast('success', `Restored ${batchIds.length} bookmarks`);
        },
      },
    });
  };

  const handleBatchMarkRead = async () => {
    if (selectedIds.length === 0) return;
    const batchIds = [...selectedIds];
    await ApiService.batchAction(batchIds, 'markRead').catch(() => {});
    setLinks((prev) =>
      prev.map((l) => (batchIds.includes(l.id) ? { ...l, readStatus: 'read' } : l))
    );
    addToast('success', `Marked ${batchIds.length} bookmarks as Reviewed`);
    setSelectedIds([]);
    ApiService.fetchStats().then(setStats).catch(() => {});
  };

  const handleBatchMarkUnread = async () => {
    if (selectedIds.length === 0) return;
    const batchIds = [...selectedIds];
    await ApiService.batchAction(batchIds, 'markUnread').catch(() => {});
    setLinks((prev) =>
      prev.map((l) => (batchIds.includes(l.id) ? { ...l, readStatus: 'unread' } : l))
    );
    addToast('success', `Marked ${batchIds.length} bookmarks as Unread`);
    setSelectedIds([]);
    ApiService.fetchStats().then(setStats).catch(() => {});
  };

  const handleBatchCategorize = async (newCategory: string) => {
    if (selectedIds.length === 0 || !newCategory) return;
    const batchIds = [...selectedIds];
    await ApiService.batchAction(batchIds, 'setCategory', newCategory).catch(() => {});
    setLinks((prev) =>
      prev.map((l) => (batchIds.includes(l.id) ? { ...l, category: newCategory } : l))
    );
    addToast('success', `Assigned ${batchIds.length} bookmarks to "${newCategory}"`);
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
          onOpenBackup={() => setBackupModalOpen(true)}
          onOpenMobileShare={() => setMobileShareModalOpen(true)}
          onOpenExtension={() => setExtensionModalOpen(true)}
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
            selectedCount={selectedIds.length}
            onSelectAllFiltered={() => setSelectedIds(filteredLinks.map((l) => l.id))}
            onClearSelection={() => setSelectedIds([])}
            isAllSelected={filteredLinks.length > 0 && filteredLinks.every((l) => selectedIds.includes(l.id))}
          />
        )}

        {/* Batch Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-[#d97757]/10 dark:bg-[#e08264]/10 border-b border-[#d97757]/20 dark:border-[#e08264]/20 px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold text-[#d97757] dark:text-[#e08264] flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>{selectedIds.length} {selectedIds.length === 1 ? 'ITEM' : 'ITEMS'} SELECTED</span>
              </span>
              {filteredLinks.length > selectedIds.length && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(filteredLinks.map((l) => l.id))}
                  className="font-mono text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline underline-offset-2 cursor-pointer"
                >
                  Select all {filteredLinks.length} filtered
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Category selector */}
              <div className="relative">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBatchCategorize(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="pl-2.5 pr-6 py-1 bg-white dark:bg-[#1f1e1d] rounded-lg font-medium text-xs text-slate-700 dark:text-slate-300 shadow-2xs border border-black/10 dark:border-white/10 cursor-pointer appearance-none"
                  aria-label="Move selected bookmarks to category"
                >
                  <option value="" disabled>Move to Category...</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <Folder className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <button
                type="button"
                onClick={() => {
                  setExportSingleLink(null);
                  setExportModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-[#1f1e1d] rounded-lg font-medium text-slate-800 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-white/5 border border-black/10 dark:border-white/10 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />
                <span className="hidden sm:inline">Export .md ({selectedIds.length})</span>
                <span className="sm:hidden">Export</span>
              </button>

              <button
                type="button"
                onClick={handleBatchMarkRead}
                className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-[#1f1e1d] rounded-lg font-medium text-slate-800 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-white/5 border border-black/10 dark:border-white/10 cursor-pointer"
                title="Mark all selected as Reviewed"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Mark Reviewed</span>
              </button>

              <button
                type="button"
                onClick={handleBatchMarkUnread}
                className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-[#1f1e1d] rounded-lg font-medium text-slate-800 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-white/5 border border-black/10 dark:border-white/10 cursor-pointer"
                title="Mark all selected as Unread"
              >
                <Circle className="w-3.5 h-3.5 text-amber-500" />
                <span>Mark Unread</span>
              </button>

              <button
                type="button"
                onClick={handleBatchDelete}
                className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium shadow-2xs cursor-pointer transition-colors"
                title="Delete all selected bookmarks (with 6s Undo)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedIds.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-2.5 py-1 font-mono text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-md border border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Main Content */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-8">
          {loading ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-[#d97757] border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                Loading OmniLink Repository...
              </div>
            </div>
          ) : filteredLinks.length === 0 && currentView !== 'cluster' ? (
            <div
              className="p-8 sm:p-12 text-center border border-black/10 dark:border-white/10 rounded-2xl space-y-5 max-w-lg mx-auto shadow-sm mt-4 sm:mt-8 animate-card-entrance"
              style={{ backgroundColor: 'var(--card-bg)' }}
            >
              <div className="w-14 h-14 rounded-2xl bg-[#d97757]/10 dark:bg-[#e08264]/10 flex items-center justify-center mx-auto text-[#d97757] dark:text-[#e08264]">
                <Search className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-newsreader font-medium text-2xl text-slate-900 dark:text-slate-100">
                  {filters.searchQuery || filters.platform !== 'all' || filters.category !== 'all' || filters.tag !== 'all'
                    ? 'No Matching Links'
                    : 'Your Repository is Ready'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {filters.searchQuery || filters.platform !== 'all' || filters.category !== 'all' || filters.tag !== 'all'
                    ? 'No links match your active filters or query. Try resetting filters or adjusting terms.'
                    : 'Extract web articles, GitHub repositories, Reddit threads, or YouTube videos with Gemini AI.'}
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                {filters.searchQuery || filters.platform !== 'all' || filters.category !== 'all' || filters.tag !== 'all' ? (
                  <button
                    onClick={() =>
                      handleFilterChange({
                        searchQuery: '',
                        platform: 'all',
                        category: 'all',
                        tag: 'all',
                        readStatus: 'all',
                        onlyFavorites: false,
                        includeArchived: false,
                      })
                    }
                    className="px-4 py-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 rounded-xl font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    Reset All Filters
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setPrefillData({});
                        setAddModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#d97757] hover:bg-[#c46243] dark:bg-[#e08264] dark:hover:bg-[#e9957a] text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add New Link (N)</span>
                    </button>
                    <button
                      onClick={() => {
                        setPrefillData({
                          url: 'https://github.com/google/gemini-api',
                          title: 'Google Gemini API Official Repository',
                          notes: 'Official SDKs and examples for Gemini multimodal models',
                        });
                        setAddModalOpen(true);
                      }}
                      className="px-3 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/5 dark:border-white/5 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      + Sample GitHub Repo
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* View 1: 3-Column Card Grid */}
              {currentView === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-5">
                  {filteredLinks.map((link) => (
                    <LinkCard
                      key={link.id}
                      link={link}
                      isSelected={selectedIds.includes(link.id)}
                      onToggleSelect={(id) =>
                        setSelectedIds((prev) =>
                          prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                        )
                      }
                      selectionMode={selectedIds.length > 0}
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
                  onToggleArchive={handleToggleArchive}
                  onDelete={handleDelete}
                />
              )}

              {/* View 3: Kanban Triaging Lanes */}
              {currentView === 'kanban' && (
                <React.Suspense
                  fallback={
                    <div className="p-12 text-center font-mono text-xs text-slate-400">
                      Loading Kanban Lanes...
                    </div>
                  }
                >
                  <KanbanView
                    links={filteredLinks}
                    selectedIds={selectedIds}
                    onToggleSelectId={(id) =>
                      setSelectedIds((prev) =>
                        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                      )
                    }
                    onOpenDetail={handleOpenDetail}
                    onUpdateStatus={handleUpdateStatus}
                    onToggleFavorite={handleToggleFavorite}
                  />
                </React.Suspense>
              )}

              {/* View 4: Vector AI Spatial Cluster Map */}
              {currentView === 'cluster' && (
                <React.Suspense
                  fallback={
                    <div className="p-12 text-center font-mono text-xs text-slate-400">
                      Loading Vector Knowledge Space...
                    </div>
                  }
                >
                  <ClusterView
                    links={links}
                    clusters={clusters}
                    onClustersUpdated={setClusters}
                    onOpenDetail={handleOpenDetail}
                  />
                </React.Suspense>
              )}
            </>
          )}
        </div>

        {/* Footer Meta Bar */}
        <footer
          className="px-4 sm:px-8 py-2 sm:py-2.5 border-t flex flex-wrap items-center justify-between font-mono text-[11px] shrink-0 text-slate-500 dark:text-slate-400 gap-2"
          style={{
            backgroundColor: 'var(--sidebar-bg)',
            borderColor: 'var(--card-border)',
          }}
        >
          <div className="font-medium tracking-wider">OMNILINK AI • KNOWLEDGE REPO</div>
          <div className="hidden md:block opacity-60">GEMINI FLASH POWERED EXTRACTION</div>
          <div className="font-medium">{links.length} {links.length === 1 ? 'LINK' : 'LINKS'} CURATED</div>
        </footer>
      </div>

      {/* Lazy Loaded Modals */}
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

      <React.Suspense fallback={null}>
        {detailModalOpen && (
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
        )}

        {askRepoModalOpen && (
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
        )}

        {extensionModalOpen && (
          <ExtensionModal
            isOpen={extensionModalOpen}
            onClose={() => setExtensionModalOpen(false)}
          />
        )}

        {mobileShareModalOpen && (
          <MobileShareModal
            isOpen={mobileShareModalOpen}
            onClose={() => setMobileShareModalOpen(false)}
            onSimulateShare={handleSimulateMobileShare}
          />
        )}

        {backupModalOpen && (
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
        )}

        {exportModalOpen && (
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
        )}

        {shortcutsModalOpen && (
          <KeyboardShortcutsModal
            isOpen={shortcutsModalOpen}
            onClose={() => setShortcutsModalOpen(false)}
            onSelectView={(v) => {
              setCurrentView(v);
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
            }}
          />
        )}

        {rssModalOpen && (
          <RssFeedsModal
            isOpen={rssModalOpen}
            onClose={() => setRssModalOpen(false)}
            onFeedsUpdated={() => {
              loadRssFeeds();
            }}
            onToast={addToast}
            onFilterByFeed={(feedId, feedTitle) => {
              setFilters((f) => ({
                ...f,
                searchQuery: feedTitle,
                readStatus: 'unread',
                includeArchived: false,
              }));
            }}
          />
        )}

        {modelOrchestratorModalOpen && (
          <ModelOrchestratorModal
            isOpen={modelOrchestratorModalOpen}
            onClose={() => setModelOrchestratorModalOpen(false)}
          />
        )}

        {analyticsModalOpen && (
          <AnalyticsModal
            isOpen={analyticsModalOpen}
            onClose={() => setAnalyticsModalOpen(false)}
            stats={stats}
            links={links}
            onFilterByPlatform={(platform) => {
              setFilters((f) => ({ ...f, platform }));
            }}
            onFilterByCategory={(category) => {
              setFilters((f) => ({ ...f, category }));
            }}
            onFilterByTag={(tag) => {
              setFilters((f) => ({ ...f, tag }));
            }}
            onFilterByStatus={(status) => {
              setFilters((f) => ({ ...f, readStatus: status }));
            }}
          />
        )}
      </React.Suspense>

      {/* Micro-Interaction Toast Dispatcher */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
