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

  // Edit modal state
  const [editingFeed, setEditingFeed] = useState<RssFeed | null>(null);

  // Load feeds and catalog
  const loadData = async () => {
    setLoading(true);
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

  // Toggle Feed Enabled/Paused
  const handleToggleFeed = async (feed: RssFeed) => {
    try {
      const nextState = !feed.enabled;
      await ApiService.updateRssFeed(feed.id, { enabled: nextState });
      onToast('info', `${feed.title} ${nextState ? 'resumed' : 'paused'}`);
      loadData();
      onFeedsUpdated();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to update feed');
    }
  };

  // Delete Feed Subscription
  const handleDeleteFeed = async (feed: RssFeed) => {
    if (!window.confirm(`Unsubscribe from "${feed.title}"?`)) return;
    try {
      await ApiService.deleteRssFeed(feed.id, false);
      onToast('info', `Unsubscribed from ${feed.title}`);
      loadData();
      onFeedsUpdated();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to delete feed');
    }
  };

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
            <div className="p-2 rounded-lg bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] border border-[#d97757]/20">
              <Rss className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="rss-feeds-modal-title" className="font-newsreader text-xl font-medium text-slate-900 dark:text-[#f7f6f3]">
                  RSS & Developer Blog Subscriptions
                </h2>
                <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-bold rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20">
                  Auto-Ingestion to Unread
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automatically fetch, summarize, and categorize articles from engineering blogs and tech news
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
              {syncingAll ? 'Syncing Feeds...' : 'Sync All Now'}
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
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-500 dark:text-amber-400 text-[10px] font-bold">
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
              <span>Add / Discover Feed</span>
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
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                1-Click
              </span>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: Subscribed Feeds */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-4">
              {/* Search and Filters */}
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    id="rss-feed-search-input"
                    type="text"
                    placeholder="Search subscribed feeds by name, category, or tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 rounded-lg text-slate-900 dark:text-[#f7f6f3] placeholder-slate-400 focus:outline-none focus:border-[#d97757]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('add')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#d97757] hover:bg-[#c46243] rounded-lg transition-colors shrink-0 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Add Feed URL
                </button>
              </div>

              {/* Feed List Cards */}
              {loading ? (
                <div className="py-16 text-center text-slate-400 text-sm">Loading subscriptions...</div>
              ) : filteredFeeds.length === 0 ? (
                <div className="py-12 px-6 text-center border border-dashed border-black/10 dark:border-white/10 rounded-xl bg-black/[0.01] dark:bg-white/[0.01] space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-slate-400">
                    <Rss className="w-6 h-6 text-amber-500/70" />
                  </div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-[#f7f6f3]">
                    {searchQuery ? 'No feeds match your search' : 'No RSS Feeds Subscribed Yet'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Subscribe to developer blogs (Cloudflare, Netflix Tech, GitHub, Hacker News) to automatically deposit new engineering articles into your unread queue.
                  </p>
                  <div className="pt-2 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('catalog')}
                      className="px-4 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors"
                    >
                      Browse Curated Catalog
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('add')}
                      className="px-4 py-2 text-xs font-medium text-[#d97757] dark:text-[#e08264] bg-[#d97757]/10 border border-[#d97757]/20 rounded-lg hover:bg-[#d97757]/20 transition-colors"
                    >
                      Add Custom URL
                    </button>
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
                            ? 'bg-white dark:bg-[#1c1b18] border-black/10 dark:border-white/10 hover:border-[#d97757]/40'
                            : 'bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5 opacity-70'
                        }`}
                      >
                        <div className="space-y-2.5">
                          {/* Top Row: Favicon, Title, Status */}
                          <div className="flex items-start justify-between gap-2">
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

                            {/* Unread badge */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {feed.unreadCount !== undefined && feed.unreadCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onFilterByFeed) {
                                      onFilterByFeed(feed.id, feed.title);
                                      onClose();
                                    }
                                  }}
                                  title="View unread articles from this feed"
                                  className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors font-mono"
                                >
                                  {feed.unreadCount} unread
                                </button>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-black/5 dark:bg-white/5 text-slate-400 font-mono">
                                  0 unread
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Metadata row: Category, Tags, AI badge */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] border border-[#d97757]/20 font-mono text-[10px] font-semibold">
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
                        </div>

                        {/* Bottom Actions Bar */}
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-black/5 dark:border-white/5 text-xs">
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>
                              {feed.lastFetchedAt
                                ? `Synced ${new Date(feed.lastFetchedAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}`
                                : 'Pending initial sync'}
                            </span>
                            {feed.lastError && (
                              <span className="text-red-500 ml-1 truncate max-w-[120px]" title={feed.lastError}>
                                (Error)
                              </span>
                            )}
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
                                className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors font-mono"
                              >
                                Filter Repo
                              </button>
                            )}

                            {/* Sync button */}
                            <button
                              type="button"
                              onClick={() => handleSyncFeed(feed)}
                              disabled={isSyncing}
                              title="Fetch latest posts right now"
                              className="p-1.5 text-slate-400 hover:text-[#d97757] hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#d97757]' : ''}`} />
                            </button>

                            {/* Pause / Resume toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleFeed(feed)}
                              title={feed.enabled ? 'Pause automatic fetching' : 'Resume automatic fetching'}
                              className={`p-1.5 rounded transition-colors ${
                                feed.enabled
                                  ? 'text-slate-400 hover:text-amber-500 hover:bg-black/5 dark:hover:bg-white/5'
                                  : 'text-amber-500 hover:text-emerald-500 hover:bg-black/5 dark:hover:bg-white/5'
                              }`}
                            >
                              {feed.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            </button>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteFeed(feed)}
                              title="Unsubscribe from feed"
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
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
                          <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                            <Check className="w-3.5 h-3.5" />
                            <span>Subscribed</span>
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
    </div>
  );
};
