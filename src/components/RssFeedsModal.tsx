import React, { useState, useEffect } from 'react';
import {
  Rss,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  FileCode,
  Download,
  Upload,
  BookOpen,
  Tag,
  Compass,
  X,
  Pause,
  Play,
  Flame,
  Globe,
  Sliders,
  Check,
  Zap,
} from 'lucide-react';
import { RssFeed, RssDiscoveryResult } from '../types';
import { ApiService } from '../services/api';

interface RssFeedsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFeedsUpdated: () => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onFilterByFeed?: (feedId: string, feedTitle: string) => void;
}

type TabType = 'subscriptions' | 'add' | 'catalog' | 'opml';

export const RssFeedsModal: React.FC<RssFeedsModalProps> = ({
  isOpen,
  onClose,
  onFeedsUpdated,
  onToast,
  onFilterByFeed,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('subscriptions');
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [catalog, setCatalog] = useState<
    Array<Omit<RssFeed, 'id' | 'createdAt' | 'updatedAt' | 'totalFetchedCount'> & { isSubscribed: boolean }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingFeedId, setSyncingFeedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedFilterStatus, setFeedFilterStatus] = useState<'all' | 'active' | 'paused'>('all');

  // Add Feed Form State
  const [inputUrl, setInputUrl] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<RssDiscoveryResult | null>(null);
  const [feedTitle, setFeedTitle] = useState('');
  const [feedCategory, setFeedCategory] = useState('Dev & Tech');
  const [feedTagsInput, setFeedTagsInput] = useState('rss, engineering');
  const [autoAiExtract, setAutoAiExtract] = useState(true);
  const [pollInterval, setPollInterval] = useState(30);
  const [subscribing, setSubscribing] = useState(false);

  // OPML State
  const [opmlText, setOpmlText] = useState('');
  const [opmlImporting, setOpmlImporting] = useState(false);

  // Unsubscribe Confirmation State
  const [feedToUnsubscribe, setFeedToUnsubscribe] = useState<RssFeed | null>(null);
  const [deleteAssociatedArticles, setDeleteAssociatedArticles] = useState(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);

  // Load feeds and catalog (silent option prevents modal flickering)
  const loadData = async (silent = false) => {
    if (!silent && feeds.length === 0) {
      setLoading(true);
    }
    try {
      const [feedsData, catalogData] = await Promise.all([
        ApiService.fetchRssFeeds(),
        ApiService.fetchRssCatalog(),
      ]);
      setFeeds(feedsData);
      setCatalog(catalogData);
    } catch (err: any) {
      console.warn('Failed loading RSS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle URL Discovery
  const handleDiscover = async () => {
    if (!inputUrl.trim()) return;
    setDiscovering(true);
    setDiscoveryResult(null);

    try {
      const result = await ApiService.discoverRssFeed(inputUrl.trim());
      setDiscoveryResult(result);
      if (result.title) setFeedTitle(result.title);
      if (result.discovered) {
        onToast('success', `Found ${result.feedType.toUpperCase()} feed: ${result.title}`);
      } else {
        onToast('info', 'No standard feed tag detected; will attempt direct endpoint connection.');
      }
    } catch (err: any) {
      onToast('error', err.message || 'Feed inspection failed');
    } finally {
      setDiscovering(false);
    }
  };

  // Handle Subscribe Submission
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    setSubscribing(true);
    try {
      const tags = feedTagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const targetFeedUrl = discoveryResult?.feedUrl || inputUrl.trim();
      const res = await ApiService.subscribeRssFeed({
        url: targetFeedUrl,
        siteUrl: discoveryResult?.siteUrl || inputUrl.trim(),
        title: feedTitle.trim() || discoveryResult?.title || 'Dev Feed',
        description: discoveryResult?.description,
        category: feedCategory,
        defaultTags: tags.length > 0 ? tags : ['rss', 'engineering'],
        autoAiExtract,
        pollIntervalMinutes: pollInterval,
        initialSync: true,
      });

      onToast(
        'success',
        `Subscribed to "${res.feed.title}"! Ingested ${res.newItemsCount} new articles into your unread queue.`
      );

      // Reset form
      setInputUrl('');
      setFeedTitle('');
      setDiscoveryResult(null);
      setFeedTagsInput('rss, engineering');
      setActiveTab('subscriptions');

      loadData();
      onFeedsUpdated();
    } catch (err: any) {
      onToast('error', err.message || 'Subscription failed');
    } finally {
      setSubscribing(false);
    }
  };

  // 1-Click Subscribe from Catalog
  const handleCatalogSubscribe = async (
    item: Omit<RssFeed, 'id' | 'createdAt' | 'updatedAt' | 'totalFetchedCount'>
  ) => {
    try {
      const res = await ApiService.subscribeRssFeed({
        url: item.url,
        siteUrl: item.siteUrl,
        title: item.title,
        description: item.description,
        category: item.category,
        defaultTags: item.defaultTags,
        autoAiExtract: item.autoAiExtract,
        pollIntervalMinutes: item.pollIntervalMinutes,
        initialSync: true,
      });

      onToast(
        'success',
        `Subscribed to ${item.title}! Added ${res.newItemsCount} unread articles to repository.`
      );

      loadData();
      onFeedsUpdated();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to subscribe to curated feed');
    }
  };

  // Manual Sync Individual Feed
  const handleSyncFeed = async (feed: RssFeed) => {
    setSyncingFeedId(feed.id);
    try {
      const res = await ApiService.syncRssFeed(feed.id);
      if (res.newItemsCount > 0) {
        onToast('success', `Fetched ${res.newItemsCount} new articles from ${feed.title} into unread!`);
      } else {
        onToast('info', `${feed.title} is up to date (no new articles).`);
      }
      loadData();
      onFeedsUpdated();
    } catch (err: any) {
      onToast('error', err.message || `Failed to sync ${feed.title}`);
    } finally {
      setSyncingFeedId(null);
    }
  };

  // Sync All Feeds
  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await ApiService.syncAllRssFeeds();
      if (res.newItemsCount > 0) {
        onToast('success', `RSS Sync Complete: ${res.newItemsCount} new articles added to unread.`);
      } else {
        onToast('info', `All ${res.totalFeedsProcessed || feeds.length} feeds are currently up to date.`);
      }
      loadData();
      onFeedsUpdated();
    } catch (err: any) {
      onToast('error', err.message || 'Global feeds sync failed');
    } finally {
      setSyncingAll(false);
    }
  };

  // Toggle Feed Enabled/Paused with instant optimistic inline update
  const handleToggleFeed = async (feed: RssFeed) => {
    const feedId = feed.id;
    const nextState = !feed.enabled;

    // 1. Instant optimistic state update (zero flicker, switch moves instantly)
    setFeeds((prev) =>
      prev.map((f) => (f.id === feedId ? { ...f, enabled: nextState } : f))
    );

    try {
      await ApiService.updateRssFeed(feedId, { enabled: nextState });
      onFeedsUpdated();
    } catch (err: any) {
      // Revert on error
      setFeeds((prev) =>
        prev.map((f) => (f.id === feedId ? { ...f, enabled: !nextState } : f))
      );
      onToast('error', err.message || 'Failed to update feed state');
    }
  };

  // Bulk Pause All Feeds
  const handlePauseAllFeeds = async () => {
    const activeFeeds = feeds.filter((f) => f.enabled);
    if (activeFeeds.length === 0) return;

    // Optimistic UI update
    setFeeds((prev) => prev.map((f) => ({ ...f, enabled: false })));
    onToast('info', `Paused background polling for ${activeFeeds.length} feeds`);

    try {
      await Promise.all(activeFeeds.map((f) => ApiService.updateRssFeed(f.id, { enabled: false })));
      onFeedsUpdated();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to pause feeds');
      loadData(true);
    }
  };

  // Bulk Resume All Feeds
  const handleResumeAllFeeds = async () => {
    const pausedFeeds = feeds.filter((f) => !f.enabled);
    if (pausedFeeds.length === 0) return;

    // Optimistic UI update
    setFeeds((prev) => prev.map((f) => ({ ...f, enabled: true })));
    onToast('success', `Resumed background polling for ${pausedFeeds.length} feeds`);

    try {
      await Promise.all(pausedFeeds.map((f) => ApiService.updateRssFeed(f.id, { enabled: true })));
      onFeedsUpdated();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to resume feeds');
      loadData(true);
    }
  };

  // Open Unsubscribe Confirmation
  const handleRequestUnsubscribe = (feed: RssFeed) => {
    setFeedToUnsubscribe(feed);
    setDeleteAssociatedArticles(false);
  };

  // Perform Unsubscribe Execution
  const handleConfirmUnsubscribe = async () => {
    if (!feedToUnsubscribe) return;
    setIsUnsubscribing(true);
    try {
      await ApiService.deleteRssFeed(feedToUnsubscribe.id, deleteAssociatedArticles);
      onToast(
        'info',
        deleteAssociatedArticles
          ? `Unsubscribed from ${feedToUnsubscribe.title} and removed associated articles.`
          : `Unsubscribed from ${feedToUnsubscribe.title}`
      );
      setFeedToUnsubscribe(null);
      loadData();
      onFeedsUpdated();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to unsubscribe from feed');
    } finally {
      setIsUnsubscribing(false);
    }
  };

  // Close unsubscribe dialog on Escape or confirm on Enter
  useEffect(() => {
    if (!feedToUnsubscribe) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (!isUnsubscribing) {
          setFeedToUnsubscribe(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [feedToUnsubscribe, isUnsubscribing]);

  // Handle OPML File Upload
  const handleOpmlFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        setOpmlText(content);
      }
    };
    reader.readAsText(file);
  };

  // Submit OPML Import
  const handleImportOpml = async () => {
    if (!opmlText.trim()) {
      onToast('error', 'Please upload or paste OPML XML content');
      return;
    }

    setOpmlImporting(true);
    try {
      const res = await ApiService.importOpml(opmlText.trim(), true);
      onToast(
        'success',
        `Imported ${res.importedCount} feeds (${res.skippedCount} duplicates skipped). Ingestion running!`
      );
      setOpmlText('');
      setActiveTab('subscriptions');
      loadData();
      onFeedsUpdated();
    } catch (err: any) {
      onToast('error', err.message || 'OPML import failed');
    } finally {
      setOpmlImporting(false);
    }
  };

  // Filtered feeds list
  const filteredFeeds = feeds.filter((f) => {
    if (feedFilterStatus === 'active' && !f.enabled) return false;
    if (feedFilterStatus === 'paused' && f.enabled) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.title.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q) ||
      f.url.toLowerCase().includes(q) ||
      f.defaultTags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const totalUnreadFeedsCount = feeds.reduce((acc, f: any) => acc + (f.unreadCount || 0), 0);

  return (
    <div
      id="rss-feeds-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="rss-feeds-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rss-feeds-modal-title"
        className="relative w-full max-w-4xl border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5 text-[#d97757] dark:text-[#e08264] border border-black/5 dark:border-white/5">
              <Rss className="w-5 h-5" />
            </div>
            <div>
              <h2 id="rss-feeds-modal-title" className="font-newsreader text-xl font-medium text-slate-900 dark:text-[#f7f6f3]">
                RSS & Engineering Feeds
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically ingest and summarize new blog posts into your Unread reading queue
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="rss-sync-all-button"
              type="button"
              onClick={handleSyncAll}
              disabled={syncingAll || feeds.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 font-mono text-xs font-semibold rounded-lg bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] border border-[#d97757]/30 hover:bg-[#d97757]/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
              {syncingAll ? 'Syncing...' : 'Sync All Feeds'}
            </button>

            <button
              id="rss-modal-close-button"
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-6 border-b border-black/10 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.01] text-xs font-medium">
          <div className="flex gap-1">
            <button
              id="rss-tab-subscriptions"
              type="button"
              onClick={() => setActiveTab('subscriptions')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === 'subscriptions'
                  ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264] font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Subscribed Feeds ({feeds.length})</span>
              {totalUnreadFeedsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                  {totalUnreadFeedsCount} unread
                </span>
              )}
            </button>

            <button
              id="rss-tab-add"
              type="button"
              onClick={() => setActiveTab('add')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === 'add'
                  ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264] font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Add Feed URL</span>
            </button>

            <button
              id="rss-tab-catalog"
              type="button"
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === 'catalog'
                  ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264] font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Curated Dev Catalog</span>
            </button>

            <button
              id="rss-tab-opml"
              type="button"
              onClick={() => setActiveTab('opml')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === 'opml'
                  ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264] font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileCode className="w-4 h-4" />
              <span>OPML Import / Export</span>
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: Subscribed Feeds */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-4">
              {/* Informative Instructions Banner */}
              <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                <Sparkles className="w-4 h-4 text-[#d97757] dark:text-[#e08264] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Subscribed blogs are polled in the background. New articles automatically receive Gemini AI summaries and appear directly in your <strong>Unread Reading Queue</strong>.
                </p>
              </div>

              {/* Search, Status Sub-Filter & Bulk Controls */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      id="rss-feed-search-input"
                      type="text"
                      placeholder="Search subscribed feeds by name, category, or tags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-[#18181b] border border-black/10 dark:border-white/10 rounded-xl text-slate-900 dark:text-[#f7f6f3] placeholder-slate-400 focus:outline-none focus:border-[#d97757]"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('add')}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#d97757] hover:bg-[#c46243] dark:bg-[#e08264] dark:hover:bg-[#e9957a] rounded-xl transition-colors shrink-0 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add Feed URL
                  </button>
                </div>

                {/* Sub-Filter Tabs & Bulk Pause/Resume Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
                  <div className="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => setFeedFilterStatus('all')}
                      className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all cursor-pointer ${
                        feedFilterStatus === 'all'
                          ? 'bg-white dark:bg-[#1f1e1c] text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      All Feeds ({feeds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedFilterStatus('active')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all cursor-pointer ${
                        feedFilterStatus === 'active'
                          ? 'bg-white dark:bg-[#1f1e1c] text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Active ({feeds.filter((f) => f.enabled).length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedFilterStatus('paused')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all cursor-pointer ${
                        feedFilterStatus === 'paused'
                          ? 'bg-white dark:bg-[#1f1e1c] text-amber-600 dark:text-amber-400 shadow-xs font-semibold'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>Paused ({feeds.filter((f) => !f.enabled).length})</span>
                    </button>
                  </div>

                  {/* Bulk Pause / Resume Controls */}
                  <div className="flex items-center gap-2">
                    {feeds.some((f) => f.enabled) && (
                      <button
                        type="button"
                        onClick={handlePauseAllFeeds}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-mono transition-colors cursor-pointer"
                        title="Pause background polling for all feeds without deleting"
                      >
                        <Pause className="w-3 h-3 text-amber-500" />
                        <span>Pause All</span>
                      </button>
                    )}
                    {feeds.some((f) => !f.enabled) && (
                      <button
                        type="button"
                        onClick={handleResumeAllFeeds}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono transition-colors font-medium cursor-pointer"
                        title="Resume background polling for all paused feeds"
                      >
                        <Play className="w-3 h-3 text-emerald-500" />
                        <span>Resume All</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Feed List Cards */}
              {loading ? (
                <div className="py-16 text-center text-slate-400 text-sm">Loading subscriptions...</div>
              ) : filteredFeeds.length === 0 ? (
                <div className="py-12 px-6 text-center border border-dashed border-black/10 dark:border-white/10 rounded-xl bg-black/[0.01] dark:bg-white/[0.01] space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-slate-400">
                    <Rss className="w-6 h-6 text-[#d97757]/70" />
                  </div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-[#f7f6f3]">
                    {searchQuery
                      ? 'No feeds match your search'
                      : feedFilterStatus === 'paused'
                      ? 'No Paused Feeds'
                      : feedFilterStatus === 'active'
                      ? 'No Active Feeds'
                      : 'No RSS Feeds Subscribed Yet'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {feedFilterStatus === 'paused'
                      ? 'All your subscribed feeds are currently active and being polled on schedule.'
                      : 'Subscribe to developer blogs (Cloudflare, Netflix Tech, GitHub, Hacker News) to automatically deposit new engineering articles into your unread queue.'}
                  </p>
                  <div className="pt-2 flex justify-center gap-3">
                    {feedFilterStatus !== 'all' ? (
                      <button
                        type="button"
                        onClick={() => setFeedFilterStatus('all')}
                        className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        Show All Feeds
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveTab('catalog')}
                          className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          Browse Curated Catalog
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('add')}
                          className="px-4 py-2 text-xs font-medium text-[#d97757] dark:text-[#e08264] bg-[#d97757]/10 border border-[#d97757]/20 rounded-lg hover:bg-[#d97757]/20 transition-colors cursor-pointer"
                        >
                          Add Custom URL
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredFeeds.map((feed: any) => {
                    const isSyncing = syncingFeedId === feed.id;
                    return (
                      <div
                        key={feed.id}
                        id={`rss-card-${feed.id}`}
                        className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                          feed.enabled
                            ? 'bg-white dark:bg-[#18181b] border-black/10 dark:border-white/10 hover:border-[#d97757]/40 shadow-2xs'
                            : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/10 dark:border-white/5 opacity-80'
                        }`}
                      >
                        <div className="space-y-2.5">
                          {/* Top Row: Favicon, Title, Status Badge & Toggle Switch */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <img
                                src={feed.faviconUrl || `https://www.google.com/s2/favicons?domain=${feed.url}&sz=64`}
                                alt=""
                                className="w-5 h-5 rounded-sm mt-0.5 shrink-0 bg-slate-200 dark:bg-slate-800"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-slate-900 dark:text-[#f7f6f3] truncate font-newsreader">{feed.title}</h4>
                                  <a
                                    href={feed.siteUrl || feed.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    title="Open website"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                  {feed.description || feed.url}
                                </p>
                              </div>
                            </div>

                            {/* Status Indicator & Interactive Toggle Switch */}
                            <div className="flex items-center gap-2 shrink-0">
                              {feed.enabled ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>Active</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  <span>Paused</span>
                                </span>
                              )}

                              {/* Toggle Switch Component */}
                              <button
                                type="button"
                                role="switch"
                                aria-checked={feed.enabled}
                                onClick={() => handleToggleFeed(feed)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  feed.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-700'
                                }`}
                                title={
                                  feed.enabled
                                    ? 'Toggle OFF to pause background fetching without deleting feed'
                                    : 'Toggle ON to resume automatic fetching'
                                }
                              >
                                <span className="sr-only">{feed.enabled ? 'Pause feed' : 'Enable feed'}</span>
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                    feed.enabled ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Metadata row: Category, Tags, AI badge, and Unread Count */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] pt-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-black/5 dark:border-white/5 font-mono text-[10px] font-semibold">
                                {feed.category}
                              </span>
                              {feed.autoAiExtract && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5 text-[10px] font-medium">
                                  <Sparkles className="w-2.5 h-2.5 text-[#d97757] dark:text-[#e08264]" />
                                  AI TL;DR
                                </span>
                              )}
                              {feed.defaultTags.slice(0, 3).map((tag: string) => (
                                <span
                                  key={tag}
                                  className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-[10px] font-mono"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>

                            {feed.unreadCount !== undefined && feed.unreadCount > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (onFilterByFeed) {
                                    onFilterByFeed(feed.id, feed.title);
                                    onClose();
                                  }
                                }}
                                title="View unread articles from this feed in repository"
                                className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-black/10 dark:border-white/10 hover:bg-black/10 transition-colors font-mono cursor-pointer"
                              >
                                {feed.unreadCount} unread
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Bottom Actions Bar */}
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-black/5 dark:border-white/5 text-xs">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>
                              {feed.enabled
                                ? feed.lastFetchedAt
                                  ? `Synced ${new Date(feed.lastFetchedAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}`
                                  : `Every ${feed.pollIntervalMinutes || 30}m`
                                : 'Paused (Polling Off)'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Filter in repo button */}
                            {onFilterByFeed && (
                              <button
                                type="button"
                                onClick={() => {
                                  onFilterByFeed(feed.id, feed.title);
                                  onClose();
                                }}
                                className="px-2.5 py-1 text-[11px] text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors font-mono cursor-pointer"
                              >
                                View Articles
                              </button>
                            )}

                            {/* Sync button */}
                            <button
                              type="button"
                              onClick={() => handleSyncFeed(feed)}
                              disabled={isSyncing}
                              title="Fetch latest posts right now"
                              className="p-1.5 text-slate-400 hover:text-[#d97757] hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#d97757]' : ''}`} />
                            </button>

                            {/* Delete / Unsubscribe button */}
                            <button
                              type="button"
                              onClick={() => handleRequestUnsubscribe(feed)}
                              title="Unsubscribe and remove feed"
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Add / Discover Feed */}
          {activeTab === 'add' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="p-5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-[#f7f6f3] font-newsreader text-base">
                  <Globe className="w-4 h-4 text-[#d97757] dark:text-[#e08264]" />
                  <span>Subscribe to Any URL / RSS Feed</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter a direct RSS feed URL or simply paste a blog address (e.g. <code>https://blog.cloudflare.com</code> or <code>https://overreacted.io</code>). Our parser will automatically detect the RSS or Atom feed XML!
                </p>

                <form onSubmit={handleSubscribe} className="space-y-4">
                  {/* URL Input with Discover Action */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">
                      Blog / Website / RSS URL <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          id="rss-input-url"
                          type="url"
                          required
                          placeholder="https://blog.cloudflare.com or https://news.ycombinator.com/rss"
                          value={inputUrl}
                          onChange={(e) => {
                            setInputUrl(e.target.value);
                            setDiscoveryResult(null);
                          }}
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 rounded-lg text-slate-900 dark:text-[#f7f6f3] placeholder-slate-400 focus:outline-none focus:border-[#d97757] font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleDiscover}
                        disabled={discovering || !inputUrl.trim()}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#d97757] dark:text-[#e08264] bg-[#d97757]/10 border border-[#d97757]/30 hover:bg-[#d97757]/20 rounded-lg transition-colors disabled:opacity-50 shrink-0 font-mono"
                      >
                        <Search className={`w-3.5 h-3.5 ${discovering ? 'animate-spin' : ''}`} />
                        {discovering ? 'Inspecting...' : 'Auto-Discover'}
                      </button>
                    </div>
                  </div>

                  {/* Discovery Preview Card */}
                  {discoveryResult && (
                    <div className="p-3.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.03] border border-[#d97757]/30 space-y-2.5 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-semibold text-slate-900 dark:text-[#f7f6f3]">
                            {discoveryResult.discovered ? 'Feed Detected & Ready' : 'Direct URL Prepared'}
                          </span>
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-black/10 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-mono">
                            {discoveryResult.feedType.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {discoveryResult.sampleItems.length} recent articles found
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 dark:text-slate-300 font-medium line-clamp-1">
                        Endpoint: <code className="text-[#d97757] dark:text-[#e08264] font-mono">{discoveryResult.feedUrl}</code>
                      </div>

                      {discoveryResult.sampleItems.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-black/5 dark:border-white/5">
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Recent Post Preview:</span>
                          <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                            {discoveryResult.sampleItems.slice(0, 3).map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2 truncate">
                                <span className="text-slate-400">•</span>
                                <span className="truncate">{item.title}</span>
                                {item.pubDate && (
                                  <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                                    ({new Date(item.pubDate).toLocaleDateString()})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom Title & Category */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Feed Display Name</label>
                      <input
                        id="rss-input-title"
                        type="text"
                        placeholder="e.g., Cloudflare Engineering"
                        value={feedTitle}
                        onChange={(e) => setFeedTitle(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 rounded-lg text-slate-900 dark:text-[#f7f6f3] placeholder-slate-400 focus:outline-none focus:border-[#d97757]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Target Category</label>
                      <select
                        id="rss-select-category"
                        value={feedCategory}
                        onChange={(e) => setFeedCategory(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 rounded-lg text-slate-900 dark:text-[#f7f6f3] focus:outline-none focus:border-[#d97757]"
                      >
                        <option value="Dev & Tech">Dev & Tech</option>
                        <option value="AI & Machine Learning">AI & Machine Learning</option>
                        <option value="Design & UI">Design & UI</option>
                        <option value="Productivity">Productivity</option>
                        <option value="Research & Papers">Research & Papers</option>
                        <option value="Tutorials & Guides">Tutorials & Guides</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Default Tags & Polling Frequency */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">
                        Default Tags (comma-separated)
                      </label>
                      <input
                        id="rss-input-tags"
                        type="text"
                        placeholder="rss, engineering, blog, systems"
                        value={feedTagsInput}
                        onChange={(e) => setFeedTagsInput(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 rounded-lg text-slate-900 dark:text-[#f7f6f3] placeholder-slate-400 focus:outline-none focus:border-[#d97757] font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Check Frequency</label>
                      <select
                        id="rss-select-poll"
                        value={pollInterval}
                        onChange={(e) => setPollInterval(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 rounded-lg text-slate-900 dark:text-[#f7f6f3] focus:outline-none focus:border-[#d97757] font-mono"
                      >
                        <option value={15}>Every 15 minutes</option>
                        <option value={30}>Every 30 minutes (Recommended)</option>
                        <option value={60}>Every 1 hour</option>
                        <option value={360}>Every 6 hours</option>
                        <option value={1440}>Once daily</option>
                      </select>
                    </div>
                  </div>

                  {/* Auto-AI Extraction Checkbox */}
                  <div className="p-3.5 rounded-lg bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-[#f7f6f3]">
                        <Sparkles className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />
                        <span>AI Summaries & Bullet Takeaways (Gemini 3.7 Flash)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Automatically generates 1-sentence TL;DR and key takeaways for incoming articles
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoAiExtract}
                        onChange={(e) => setAutoAiExtract(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#d97757]"></div>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    id="rss-submit-subscribe-btn"
                    type="submit"
                    disabled={subscribing || !inputUrl.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-[#d97757] hover:bg-[#c46243] rounded-lg shadow-xs transition-all disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    {subscribing ? 'Subscribing & Ingesting Articles...' : 'Subscribe & Fetch into Unread'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: Curated Developer Catalog */}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-newsreader text-base font-semibold text-slate-900 dark:text-[#f7f6f3]">Popular Engineering & AI Feeds</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    One-click subscribe to top developer blogs. Incoming articles are saved straight to your unread queue.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {catalog.map((item, idx) => {
                  const isSubscribed = feeds.some((f) => f.url.toLowerCase() === item.url.toLowerCase());
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                        isSubscribed ? 'bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5' : 'bg-white dark:bg-[#1c1b18] border-black/10 dark:border-white/10 hover:border-[#d97757]/40'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <img
                              src={item.faviconUrl || `https://www.google.com/s2/favicons?domain=${item.url}&sz=64`}
                              alt=""
                              className="w-5 h-5 rounded-sm mt-0.5 shrink-0 bg-slate-200 dark:bg-slate-800"
                            />
                            <div className="min-w-0">
                              <h4 className="font-newsreader text-sm font-semibold text-slate-900 dark:text-[#f7f6f3] truncate">{item.title}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{item.description}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-1">
                          <span className="px-2 py-0.5 rounded bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] border border-[#d97757]/20 font-mono text-[10px] font-semibold">
                            {item.category}
                          </span>
                          {item.defaultTags.slice(0, 3).map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-[10px] font-mono">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                        <a
                          href={item.siteUrl || item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-mono"
                        >
                          <span>Visit Site</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        {isSubscribed ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                              <Check className="w-3.5 h-3.5" />
                              <span>Subscribed</span>
                            </div>
                            {(() => {
                              const matchingFeed = feeds.find(
                                (f) =>
                                  f.url.toLowerCase() === item.url.toLowerCase() ||
                                  (f.siteUrl && item.siteUrl && f.siteUrl.toLowerCase() === item.siteUrl.toLowerCase())
                              );
                              if (!matchingFeed) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleRequestUnsubscribe(matchingFeed)}
                                  title="Unsubscribe from feed"
                                  className="p-1 text-slate-400 hover:text-rose-500 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              );
                            })()}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleCatalogSubscribe(item)}
                            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-[#d97757] hover:bg-[#c46243] rounded-lg shadow-xs transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Subscribe</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: OPML Import / Export */}
          {activeTab === 'opml' && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Export Box */}
              <div className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-500" />
                    <h3 className="font-newsreader text-base font-semibold text-slate-900 dark:text-[#f7f6f3]">Export Subscriptions to OPML</h3>
                  </div>
                  <a
                    href={ApiService.getOpmlExportUrl()}
                    download="omnilink-feeds.opml"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors font-mono"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download .opml File
                  </a>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Export all your RSS feed subscriptions into standard OPML XML format to backup or import into Feedly, NetNewsWire, Readwise Reader, or Inoreader.
                </p>
              </div>

              {/* Import Box */}
              <div className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 space-y-4">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#d97757] dark:text-[#e08264]" />
                  <h3 className="font-newsreader text-base font-semibold text-slate-900 dark:text-[#f7f6f3]">Import Feeds from OPML</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Upload an <code>.opml</code> or <code>.xml</code> file from your favorite RSS reader or paste the raw OPML XML below.
                </p>

                {/* File picker */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 rounded-lg cursor-pointer transition-colors font-mono">
                    <FileCode className="w-4 h-4 text-[#d97757] dark:text-[#e08264]" />
                    <span>Choose OPML File...</span>
                    <input
                      type="file"
                      accept=".opml,.xml,text/xml,application/xml"
                      onChange={handleOpmlFileUpload}
                      className="hidden"
                    />
                  </label>
                  {opmlText && (
                    <span className="text-xs text-emerald-500 flex items-center gap-1 font-mono">
                      <Check className="w-3.5 h-3.5" /> Ready ({opmlText.length} bytes loaded)
                    </span>
                  )}
                </div>

                {/* Text Area */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">Or Paste OPML XML Content:</label>
                  <textarea
                    rows={6}
                    placeholder={`<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <body>\n    <outline type="rss" xmlUrl="https://blog.cloudflare.com/rss/" title="Cloudflare Blog"/>\n  </body>\n</opml>`}
                    value={opmlText}
                    onChange={(e) => setOpmlText(e.target.value)}
                    className="w-full p-3 text-xs bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 rounded-lg text-slate-900 dark:text-[#f7f6f3] font-mono focus:outline-none focus:border-[#d97757]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleImportOpml}
                  disabled={opmlImporting || !opmlText.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-[#d97757] hover:bg-[#c46243] rounded-lg shadow-xs transition-all disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {opmlImporting ? 'Importing Feeds & Ingesting...' : 'Import OPML & Ingest to Unread'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Articles auto-ingest into <strong>Unread</strong> queue with duplicates prevented</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-white/10 transition-colors font-mono text-xs"
          >
            Close
          </button>
        </div>
      </div>

      {/* Custom Unsubscribe Confirmation Modal */}
      {feedToUnsubscribe && (
        <div
          id="rss-unsubscribe-confirm-overlay"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            if (!isUnsubscribing) setFeedToUnsubscribe(null);
          }}
        >
          <div
            id="rss-unsubscribe-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="rss-unsubscribe-title"
            aria-describedby="rss-unsubscribe-desc"
            className="relative w-full max-w-md border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-150"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="rss-unsubscribe-title" className="font-newsreader text-lg font-semibold text-slate-900 dark:text-[#f7f6f3]">
                    Unsubscribe from Feed
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Confirm removing this RSS feed subscription
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFeedToUnsubscribe(null)}
                disabled={isUnsubscribing}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Feed Card Preview */}
            <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
              <div className="flex items-start gap-2.5 min-w-0">
                <img
                  src={feedToUnsubscribe.faviconUrl || `https://www.google.com/s2/favicons?domain=${feedToUnsubscribe.url}&sz=64`}
                  alt=""
                  className="w-5 h-5 rounded-sm mt-0.5 shrink-0 bg-slate-200 dark:bg-slate-800"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-newsreader text-sm font-semibold text-slate-900 dark:text-[#f7f6f3] truncate">
                    {feedToUnsubscribe.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono mt-0.5">
                    {feedToUnsubscribe.siteUrl || feedToUnsubscribe.url}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono pt-1 text-slate-500 dark:text-slate-400">
                <span className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 font-semibold text-slate-700 dark:text-slate-300">
                  {feedToUnsubscribe.category}
                </span>
                {feedToUnsubscribe.unreadCount !== undefined && feedToUnsubscribe.unreadCount > 0 ? (
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                    {feedToUnsubscribe.unreadCount} unread
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/5">
                    0 unread
                  </span>
                )}
                {feedToUnsubscribe.repoItemsCount !== undefined && feedToUnsubscribe.repoItemsCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/5">
                    {feedToUnsubscribe.repoItemsCount} in repo
                  </span>
                )}
              </div>
            </div>

            {/* Informative text */}
            <p id="rss-unsubscribe-desc" className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              OmniLink will stop automatic syncing and AI summaries for new articles from this feed.
            </p>

            {/* Delete associated articles option */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors select-none">
              <input
                type="checkbox"
                checked={deleteAssociatedArticles}
                onChange={(e) => setDeleteAssociatedArticles(e.target.checked)}
                disabled={isUnsubscribing}
                className="mt-0.5 h-4 w-4 rounded border-black/20 text-[#d97757] focus:ring-[#d97757] dark:border-white/20 dark:bg-[#18181b]"
              />
              <div className="space-y-0.5">
                <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Also delete existing articles imported from this feed
                </span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                  Removes previously fetched articles from your Unread queue and repository.
                </span>
              </div>
            </label>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => setFeedToUnsubscribe(null)}
                disabled={isUnsubscribing}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors font-mono disabled:opacity-50"
              >
                Keep Feed
              </button>
              <button
                type="button"
                onClick={handleConfirmUnsubscribe}
                disabled={isUnsubscribing}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 rounded-xl shadow-xs transition-colors disabled:opacity-50 font-mono"
              >
                {isUnsubscribing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Unsubscribing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deleteAssociatedArticles ? 'Unsubscribe & Purge' : 'Unsubscribe'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
