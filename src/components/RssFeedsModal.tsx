import React, { useState, useEffect } from 'react';
import { Rss, Plus, RefreshCw, Trash2, ExternalLink, Search, Download, Upload, X, Pause, Play, Check } from 'lucide-react';
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
        onToast('success', `Found feed: ${result.title}`);
      } else {
        onToast('info', 'No feed found on that page; the URL will be used directly.');
      }
    } catch (err: any) {
      onToast('error', err.message || 'Could not check this URL');
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
        `Added "${res.feed.title}" with ${res.newItemsCount} new unread links.`
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
      onToast('error', err.message || 'Could not add feed');
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
        `Added ${item.title} with ${res.newItemsCount} new unread links.`
      );

      loadData();
      onFeedsUpdated();
    } catch (err: any) {
      onToast('error', err.message || 'Could not add feed');
    }
  };

  // Manual Sync Individual Feed
  const handleSyncFeed = async (feed: RssFeed) => {
    setSyncingFeedId(feed.id);
    try {
      const res = await ApiService.syncRssFeed(feed.id);
      if (res.newItemsCount > 0) {
        onToast('success', `${res.newItemsCount} new links from ${feed.title}.`);
      } else {
        onToast('info', `${feed.title} is up to date.`);
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
        onToast('success', `Synced: ${res.newItemsCount} new unread links.`);
      } else {
        onToast('info', `All ${res.totalFeedsProcessed || feeds.length} feeds are up to date.`);
      }
      loadData();
      onFeedsUpdated();
    } catch (err: any) {
      onToast('error', err.message || 'Sync failed');
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
    onToast('info', `Paused ${activeFeeds.length} feeds`);

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
    onToast('success', `Resumed ${pausedFeeds.length} feeds`);

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
          ? `Unsubscribed from ${feedToUnsubscribe.title} and deleted its links.`
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
      onToast('error', 'Choose a file or paste OPML first');
      return;
    }

    setOpmlImporting(true);
    try {
      const res = await ApiService.importOpml(opmlText.trim(), true);
      onToast(
        'success',
        `Imported ${res.importedCount} feeds (${res.skippedCount} duplicates skipped).`
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


  const tabClass = (tab: TabType) =>
    `px-3 py-3 -mb-px border-b-2 text-sm transition-colors ${
      activeTab === tab
        ? 'border-accent text-slate-900 dark:text-ink font-medium'
        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
    }`;

  const segmentClass = (status: 'all' | 'active' | 'paused') =>
    `px-3 py-1.5 text-xs transition-colors cursor-pointer ${
      feedFilterStatus === status
        ? 'bg-black/5 dark:bg-white/10 text-slate-900 dark:text-ink font-medium'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
    }`;

  const inputClass =
    'w-full rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-surface px-3 py-2 text-sm text-slate-900 dark:text-ink placeholder-slate-400 focus:outline-none focus:border-accent';

  const primaryButtonClass =
    'flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-on-accent rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50';

  const secondaryButtonClass =
    'flex items-center justify-center gap-1.5 border border-black/10 dark:border-white/10 rounded-md text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer';

  const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400';

  return (
    <div
      id="rss-feeds-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="rss-feeds-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rss-feeds-modal-title"
        className="relative w-full max-w-4xl rounded-xl border shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-black/[0.08] dark:border-white/[0.08]">
          <div>
            <h2 id="rss-feeds-modal-title" className="text-base font-semibold text-slate-900 dark:text-ink">
              RSS feeds
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              New posts are summarized and added to your unread links.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="rss-sync-all-button"
              type="button"
              onClick={handleSyncAll}
              disabled={syncingAll || feeds.length === 0}
              className={`${secondaryButtonClass} px-3 py-1.5 text-xs font-medium`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
              {syncingAll ? 'Syncing...' : 'Sync all'}
            </button>

            <button
              id="rss-modal-close-button"
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 border-b border-black/[0.08] dark:border-white/[0.08]">
          <button
            id="rss-tab-subscriptions"
            type="button"
            onClick={() => setActiveTab('subscriptions')}
            className={tabClass('subscriptions')}
          >
            Your feeds ({feeds.length})
          </button>
          <button id="rss-tab-add" type="button" onClick={() => setActiveTab('add')} className={tabClass('add')}>
            Add feed
          </button>
          <button
            id="rss-tab-catalog"
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={tabClass('catalog')}
          >
            Discover
          </button>
          <button id="rss-tab-opml" type="button" onClick={() => setActiveTab('opml')} className={tabClass('opml')}>
            Import / export
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: Subscribed Feeds */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-4">
              {/* Search, Status Sub-Filter & Bulk Controls */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    id="rss-feed-search-input"
                    type="text"
                    placeholder="Search feeds"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`${inputClass} pl-9 pr-9`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Sub-Filter Segments & Bulk Pause/Resume Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center rounded-md border border-black/10 dark:border-white/10 overflow-hidden divide-x divide-black/10 dark:divide-white/10">
                    <button type="button" onClick={() => setFeedFilterStatus('all')} className={segmentClass('all')}>
                      All ({feeds.length})
                    </button>
                    <button type="button" onClick={() => setFeedFilterStatus('active')} className={segmentClass('active')}>
                      Active ({feeds.filter((f) => f.enabled).length})
                    </button>
                    <button type="button" onClick={() => setFeedFilterStatus('paused')} className={segmentClass('paused')}>
                      Paused ({feeds.filter((f) => !f.enabled).length})
                    </button>
                  </div>

                  {/* Bulk Pause / Resume Controls */}
                  <div className="flex items-center gap-2">
                    {feeds.some((f) => f.enabled) && (
                      <button
                        type="button"
                        onClick={handlePauseAllFeeds}
                        className={`${secondaryButtonClass} px-2.5 py-1.5 text-xs`}
                        title="Pause checking for all feeds without deleting them"
                      >
                        <Pause className="w-3 h-3 text-slate-400" />
                        <span>Pause all</span>
                      </button>
                    )}
                    {feeds.some((f) => !f.enabled) && (
                      <button
                        type="button"
                        onClick={handleResumeAllFeeds}
                        className={`${secondaryButtonClass} px-2.5 py-1.5 text-xs`}
                        title="Resume checking for all paused feeds"
                      >
                        <Play className="w-3 h-3 text-slate-400" />
                        <span>Resume all</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Feed List */}
              {loading ? (
                <div className="py-16 text-center text-slate-400 text-sm">Loading feeds...</div>
              ) : filteredFeeds.length === 0 ? (
                <div className="py-12 px-6 text-center border border-dashed border-black/[0.08] dark:border-white/[0.08] rounded-lg space-y-3">
                  <Rss className="w-6 h-6 mx-auto text-slate-400" />
                  <h3 className="text-sm font-medium text-slate-900 dark:text-ink">
                    {searchQuery
                      ? 'No feeds match your search'
                      : feedFilterStatus === 'paused'
                      ? 'No paused feeds'
                      : feedFilterStatus === 'active'
                      ? 'No active feeds'
                      : 'No feeds yet'}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {feedFilterStatus === 'paused'
                      ? 'All your feeds are active and checked on schedule.'
                      : 'Follow a blog to have its new posts added to your unread links.'}
                  </p>
                  <div className="pt-2 flex justify-center gap-2">
                    {feedFilterStatus !== 'all' ? (
                      <button
                        type="button"
                        onClick={() => setFeedFilterStatus('all')}
                        className={`${secondaryButtonClass} px-4 py-2 text-sm`}
                      >
                        Show all feeds
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveTab('catalog')}
                          className={`${secondaryButtonClass} px-4 py-2 text-sm`}
                        >
                          Browse popular feeds
                        </button>
                        <button type="button" onClick={() => setActiveTab('add')} className={primaryButtonClass}>
                          Add feed
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-black/[0.08] dark:divide-white/[0.08] rounded-lg border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
                  {filteredFeeds.map((feed: any) => {
                    const isSyncing = syncingFeedId === feed.id;
                    const statusText = feed.enabled
                      ? feed.lastFetchedAt
                        ? `Synced ${new Date(feed.lastFetchedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : `Every ${feed.pollIntervalMinutes || 30} min`
                      : 'Paused';
                    return (
                      <li key={feed.id} id={`rss-card-${feed.id}`} className="flex items-center gap-3 px-4 py-3">
                        <img
                          src={feed.faviconUrl || `https://www.google.com/s2/favicons?domain=${feed.url}&sz=64`}
                          alt=""
                          className={`w-5 h-5 rounded-sm shrink-0 bg-slate-200 dark:bg-slate-800 ${feed.enabled ? '' : 'opacity-50'}`}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h4
                              className={`text-sm font-medium truncate ${
                                feed.enabled ? 'text-slate-900 dark:text-ink' : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {feed.title}
                            </h4>
                            <a
                              href={feed.siteUrl || feed.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                              title="Open website"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {statusText}
                            {feed.unreadCount !== undefined && feed.unreadCount > 0 && (
                              <>
                                {' · '}
                                {onFilterByFeed ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onFilterByFeed(feed.id, feed.title);
                                      onClose();
                                    }}
                                    title="Show this feed's links"
                                    className="underline-offset-2 hover:underline hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                                  >
                                    {feed.unreadCount} unread
                                  </button>
                                ) : (
                                  <span>{feed.unreadCount} unread</span>
                                )}
                              </>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSyncFeed(feed)}
                            disabled={isSyncing}
                            title="Check for new posts now"
                            aria-label={`Sync ${feed.title}`}
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRequestUnsubscribe(feed)}
                            title="Unsubscribe"
                            aria-label={`Unsubscribe from ${feed.title}`}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={feed.enabled}
                            onClick={() => handleToggleFeed(feed)}
                            className={`ml-1 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              feed.enabled ? 'bg-accent' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                            title={feed.enabled ? 'Pause this feed' : 'Resume this feed'}
                          >
                            <span className="sr-only">{feed.enabled ? 'Pause feed' : 'Enable feed'}</span>
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white ring-0 transition duration-200 ease-in-out ${
                                feed.enabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* TAB 2: Add Feed */}
          {activeTab === 'add' && (
            <div className="max-w-2xl mx-auto">
              <form onSubmit={handleSubscribe} className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Paste a feed URL or a blog address, like <span className="text-slate-700 dark:text-slate-300">https://blog.cloudflare.com</span>. The feed is found automatically.
                </p>

                {/* URL Input with Discover Action */}
                <div className="space-y-1.5">
                  <label htmlFor="rss-input-url" className={labelClass}>
                    Feed or website URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="rss-input-url"
                      type="url"
                      required
                      placeholder="https://blog.example.com"
                      value={inputUrl}
                      onChange={(e) => {
                        setInputUrl(e.target.value);
                        setDiscoveryResult(null);
                      }}
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={handleDiscover}
                      disabled={discovering || !inputUrl.trim()}
                      className={`${secondaryButtonClass} px-3.5 py-2 text-sm shrink-0`}
                    >
                      <Search className={`w-3.5 h-3.5 ${discovering ? 'animate-spin' : ''}`} />
                      {discovering ? 'Checking...' : 'Find feed'}
                    </button>
                  </div>
                </div>

                {/* Discovery Preview */}
                {discoveryResult && (
                  <div className="p-4 rounded-lg border border-black/[0.08] dark:border-white/[0.08] space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-accent" />
                        <span className="text-sm font-medium text-slate-900 dark:text-ink">
                          {discoveryResult.discovered ? 'Feed found' : 'Using URL as is'}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {discoveryResult.feedType.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {discoveryResult.sampleItems.length} recent posts
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      Feed URL: <span className="text-slate-700 dark:text-slate-300">{discoveryResult.feedUrl}</span>
                    </div>

                    {discoveryResult.sampleItems.length > 0 && (
                      <div className="space-y-1 pt-2 border-t border-black/[0.08] dark:border-white/[0.08]">
                        <span className={labelClass}>Recent posts</span>
                        <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                          {discoveryResult.sampleItems.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 truncate">
                              <span className="truncate">{item.title}</span>
                              {item.pubDate && (
                                <span className="text-xs text-slate-400 shrink-0">
                                  {new Date(item.pubDate).toLocaleDateString()}
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
                    <label htmlFor="rss-input-title" className={labelClass}>
                      Name
                    </label>
                    <input
                      id="rss-input-title"
                      type="text"
                      placeholder="e.g. Cloudflare blog"
                      value={feedTitle}
                      onChange={(e) => setFeedTitle(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="rss-select-category" className={labelClass}>
                      Category
                    </label>
                    <select
                      id="rss-select-category"
                      value={feedCategory}
                      onChange={(e) => setFeedCategory(e.target.value)}
                      className={inputClass}
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
                    <label htmlFor="rss-input-tags" className={labelClass}>
                      Tags (comma-separated)
                    </label>
                    <input
                      id="rss-input-tags"
                      type="text"
                      placeholder="rss, engineering"
                      value={feedTagsInput}
                      onChange={(e) => setFeedTagsInput(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="rss-select-poll" className={labelClass}>
                      Check for new posts
                    </label>
                    <select
                      id="rss-select-poll"
                      value={pollInterval}
                      onChange={(e) => setPollInterval(Number(e.target.value))}
                      className={inputClass}
                    >
                      <option value={15}>Every 15 minutes</option>
                      <option value={30}>Every 30 minutes</option>
                      <option value={60}>Every hour</option>
                      <option value={360}>Every 6 hours</option>
                      <option value={1440}>Once a day</option>
                    </select>
                  </div>
                </div>

                {/* AI Summaries Toggle */}
                <div className="p-4 rounded-lg border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-slate-900 dark:text-ink">AI summaries</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Add a short summary and key points to each new post.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={autoAiExtract}
                      onChange={(e) => setAutoAiExtract(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                  </label>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                  <button
                    id="rss-submit-subscribe-btn"
                    type="submit"
                    disabled={subscribing || !inputUrl.trim()}
                    className={primaryButtonClass}
                  >
                    {subscribing && (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    )}
                    {subscribing ? 'Adding feed...' : 'Add feed'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: Discover */}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Popular engineering and AI blogs. New posts go to your unread links.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {catalog.map((item, idx) => {
                  const isSubscribed = feeds.some((f) => f.url.toLowerCase() === item.url.toLowerCase());
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-lg border border-black/[0.08] dark:border-white/[0.08] flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <img
                            src={item.faviconUrl || `https://www.google.com/s2/favicons?domain=${item.url}&sz=64`}
                            alt=""
                            className="w-5 h-5 rounded-sm mt-0.5 shrink-0 bg-slate-200 dark:bg-slate-800"
                          />
                          <div className="min-w-0">
                            <h4 className="text-sm font-medium text-slate-900 dark:text-ink truncate">{item.title}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{item.description}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="text-slate-700 dark:text-slate-300">{item.category}</span>
                          {item.defaultTags.slice(0, 3).map((tag) => (
                            <span key={tag}>#{tag}</span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between">
                        <a
                          href={item.siteUrl || item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        >
                          <span>Visit site</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        {isSubscribed ? (
                          <div className="flex items-center gap-1.5">
                            <span className="flex items-center gap-1 text-xs font-medium text-accent">
                              <Check className="w-3.5 h-3.5" />
                              Following
                            </span>
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
                                  title="Unsubscribe"
                                  aria-label={`Unsubscribe from ${matchingFeed.title}`}
                                  className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
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
                            className={`${secondaryButtonClass} px-3 py-1 text-xs font-medium`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Follow</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: Import / Export */}
          {activeTab === 'opml' && (
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Export */}
              <div className="p-4 rounded-lg border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-medium text-slate-900 dark:text-ink">Export feeds</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Download your feeds as an OPML file to back them up or use them in another reader.
                  </p>
                </div>
                <a
                  href={ApiService.getOpmlExportUrl()}
                  download="omnilink-feeds.opml"
                  className={`${secondaryButtonClass} px-3 py-1.5 text-sm shrink-0`}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
              </div>

              {/* Import */}
              <div className="p-4 rounded-lg border border-black/[0.08] dark:border-white/[0.08] space-y-4">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-medium text-slate-900 dark:text-ink">Import feeds</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Choose an .opml or .xml file from another reader, or paste its contents below.
                  </p>
                </div>

                {/* File picker */}
                <div className="flex items-center gap-3">
                  <label className={`${secondaryButtonClass} px-3 py-1.5 text-sm`}>
                    <Upload className="w-3.5 h-3.5 text-slate-400" />
                    <span>Choose file</span>
                    <input
                      type="file"
                      accept=".opml,.xml,text/xml,application/xml"
                      onChange={handleOpmlFileUpload}
                      className="hidden"
                    />
                  </label>
                  {opmlText && (
                    <span className="text-xs text-accent flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> File loaded
                    </span>
                  )}
                </div>

                {/* Text Area */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    Or paste OPML
                  </label>
                  <textarea
                    rows={6}
                    placeholder={`<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <body>\n    <outline type="rss" xmlUrl="https://blog.cloudflare.com/rss/" title="Cloudflare Blog"/>\n  </body>\n</opml>`}
                    value={opmlText}
                    onChange={(e) => setOpmlText(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleImportOpml}
                    disabled={opmlImporting || !opmlText.trim()}
                    className={primaryButtonClass}
                  >
                    {opmlImporting && (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    )}
                    {opmlImporting ? 'Importing...' : 'Import feeds'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Unsubscribe Confirmation Dialog */}
      {feedToUnsubscribe && (
        <div
          id="rss-unsubscribe-confirm-overlay"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
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
            className="relative w-full max-w-md rounded-xl border shadow-xl overflow-hidden"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.08] dark:border-white/[0.08]">
              <h3 id="rss-unsubscribe-title" className="text-base font-semibold text-slate-900 dark:text-ink">
                Unsubscribe from feed
              </h3>
              <button
                type="button"
                onClick={() => setFeedToUnsubscribe(null)}
                disabled={isUnsubscribing}
                aria-label="Close"
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Feed Preview */}
              <div className="p-3.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] space-y-2">
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
                    <h4 className="text-sm font-medium text-slate-900 dark:text-ink truncate">
                      {feedToUnsubscribe.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {feedToUnsubscribe.siteUrl || feedToUnsubscribe.url}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{feedToUnsubscribe.category}</span>
                  <span>·</span>
                  <span>
                    {feedToUnsubscribe.unreadCount !== undefined && feedToUnsubscribe.unreadCount > 0
                      ? feedToUnsubscribe.unreadCount
                      : 0}{' '}
                    unread
                  </span>
                  {feedToUnsubscribe.repoItemsCount !== undefined && feedToUnsubscribe.repoItemsCount > 0 && (
                    <>
                      <span>·</span>
                      <span>{feedToUnsubscribe.repoItemsCount} saved links</span>
                    </>
                  )}
                </div>
              </div>

              <p id="rss-unsubscribe-desc" className="text-sm text-slate-600 dark:text-slate-300">
                New posts from this feed will no longer be added.
              </p>

              {/* Delete associated articles option */}
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={deleteAssociatedArticles}
                  onChange={(e) => setDeleteAssociatedArticles(e.target.checked)}
                  disabled={isUnsubscribing}
                  className="mt-0.5 h-4 w-4 rounded border-black/20 accent-accent dark:border-white/20"
                />
                <div className="space-y-0.5">
                  <span className="block text-sm text-slate-800 dark:text-slate-200">
                    Also delete links from this feed
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Removes posts already added from this feed.
                  </span>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-black/[0.08] dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setFeedToUnsubscribe(null)}
                disabled={isUnsubscribing}
                className={`${secondaryButtonClass} px-4 py-2 text-sm`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUnsubscribe}
                disabled={isUnsubscribing}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
              >
                {isUnsubscribing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {isUnsubscribing
                  ? 'Unsubscribing...'
                  : deleteAssociatedArticles
                  ? 'Unsubscribe and delete'
                  : 'Unsubscribe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
