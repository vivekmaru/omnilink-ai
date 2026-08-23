import {
  AskRepoResponse,
  ClusterGroup,
  FilterState,
  LinkItem,
  SystemStats,
  RssFeed,
  RssDiscoveryResult,
  RssSyncResult,
  OpmlImportResult,
  DuplicateCheckResult,
  HybridSearchMatch,
  EmbeddingsStatusResponse,
  ReaderSnapshot,
} from '../types';
import { checkDuplicateInLinks, normalizeUrl } from '../utils/url';

const STORAGE_KEY = 'omnilink_local_cache_v1';
const ETAG_KEY = 'omnilink_etag_links_v1';
const STATS_STORAGE_KEY = 'omnilink_stats_cache_v1';
const STATS_ETAG_KEY = 'omnilink_etag_stats_v1';
const PENDING_SYNC_KEY = 'omnilink_pending_sync_v1';

export class ApiService {
  private static isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  // Load from local storage cache
  static getLocalCache(): LinkItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static setLocalCache(links: LinkItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  // Load from local stats cache
  static getLocalStats(): SystemStats | null {
    try {
      const raw = localStorage.getItem(STATS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static setLocalStats(stats: SystemStats): void {
    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
      console.warn('LocalStorage stats save failed:', e);
    }
  }

  // Fetch all links with filter queries & ETag / 304 Not Modified optimization
  static async fetchLinks(filters?: Partial<FilterState>): Promise<{ links: LinkItem[]; total: number; isOffline?: boolean; notModified?: boolean }> {
    const isDefaultFetch =
      !filters ||
      (!filters.searchQuery &&
        (!filters.platform || filters.platform === 'all') &&
        (!filters.category || filters.category === 'all') &&
        (!filters.tag || filters.tag === 'all') &&
        (!filters.readStatus || filters.readStatus === 'all') &&
        !filters.onlyFavorites &&
        !filters.includeArchived);

    const params = new URLSearchParams();
    if (filters?.searchQuery) params.append('q', filters.searchQuery);
    if (filters?.platform && filters.platform !== 'all') params.append('platform', filters.platform);
    if (filters?.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters?.tag && filters.tag !== 'all') params.append('tag', filters.tag);
    if (filters?.readStatus && filters.readStatus !== 'all') params.append('readStatus', filters.readStatus);
    if (filters?.onlyFavorites) params.append('isFavorite', 'true');
    if (filters?.includeArchived) params.append('isArchived', 'true');
    if (filters?.sortBy) params.append('sort', filters.sortBy);

    try {
      const headers: Record<string, string> = {};
      if (isDefaultFetch) {
        const lastEtag = localStorage.getItem(ETAG_KEY);
        if (lastEtag) {
          headers['If-None-Match'] = lastEtag;
        }
      }

      const res = await fetch(`/api/links?${params.toString()}`, { headers });
      
      // If 304 Not Modified, reuse existing local cache instantly with 0 payload transferred
      if (res.status === 304) {
        const cached = this.getLocalCache();
        return { links: cached, total: cached.length, notModified: true };
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      const newEtag = res.headers.get('etag');
      if (newEtag && isDefaultFetch) {
        try {
          localStorage.setItem(ETAG_KEY, newEtag);
        } catch {}
      }

      // Update local offline cache
      if (isDefaultFetch) {
        this.setLocalCache(data.links);
      }
      return { links: data.links, total: data.total };
    } catch (err) {
      console.warn('Server fetch failed, falling back to local cache:', err);
      let local = this.getLocalCache();
      
      // Apply basic local filtering if offline
      if (filters?.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        local = local.filter(l => l.title.toLowerCase().includes(q) || l.tags.some(t => t.toLowerCase().includes(q)));
      }
      if (filters?.platform && filters.platform !== 'all') {
        local = local.filter(l => l.platform === filters.platform);
      }
      if (filters?.onlyFavorites) {
        local = local.filter(l => l.isFavorite);
      }
      return { links: local, total: local.length, isOffline: true };
    }
  }

  // Fetch URL preview metadata (title, description, platform)
  static async previewMetadata(url: string): Promise<{
    url: string;
    title: string;
    description: string;
    platform: string;
  }> {
    try {
      const res = await fetch('/api/links/preview-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error('Preview failed');
      return await res.json();
    } catch {
      return {
        url,
        title: '',
        description: '',
        platform: 'other',
      };
    }
  }

  // Add new link
  static async createLink(payload: {
    url: string;
    title?: string;
    notes?: string;
    category?: string;
    tags?: string[];
    autoAiExtract?: boolean;
  }): Promise<LinkItem> {
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add link');
      }
      const data = await res.json();
      return data.link;
    } catch (err) {
      // Offline fallback: create item locally
      const localItem: LinkItem = {
        id: 'local-' + Date.now(),
        url: payload.url,
        title: payload.title || payload.url,
        platform: 'other',
        category: payload.category || 'Dev & Tech',
        tags: payload.tags || ['offline-queued'],
        summary: {
          tldr: 'Saved in offline mode. Will synchronize when connected.',
          keyTakeaways: ['Offline bookmark pending AI extraction'],
        },
        isFavorite: false,
        isArchived: false,
        readStatus: 'unread',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: payload.notes || '',
      };
      const cache = this.getLocalCache();
      this.setLocalCache([localItem, ...cache]);
      return localItem;
    }
  }

  // Update existing link
  static async updateLink(id: string, updates: Partial<LinkItem>): Promise<LinkItem> {
    try {
      const res = await fetch(`/api/links/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Update failed');
      const data = await res.json();
      return data.link;
    } catch (err) {
      const cache = this.getLocalCache();
      const idx = cache.findIndex(l => l.id === id);
      if (idx !== -1) {
        cache[idx] = { ...cache[idx], ...updates, updatedAt: new Date().toISOString() };
        this.setLocalCache(cache);
        return cache[idx];
      }
      throw err;
    }
  }

  // Check duplicate link in background (offline cache + server validation)
  static async checkDuplicate(url: string, localLinks?: LinkItem[]): Promise<DuplicateCheckResult> {
    const trimmed = url ? url.trim() : '';
    if (!trimmed) {
      return { isDuplicate: false, existingLink: null, normalizedUrl: '' };
    }

    // 1. Check in provided local links or cached items first (instant synchronous-speed check)
    const pool = localLinks && localLinks.length > 0 ? localLinks : this.getLocalCache();
    const localResult = checkDuplicateInLinks(trimmed, pool);
    if (localResult.isDuplicate && localResult.existingLink) {
      return localResult;
    }

    // 2. Query server check-duplicate endpoint
    try {
      const res = await fetch('/api/links/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      if (res.ok) {
        const serverResult: DuplicateCheckResult = await res.json();
        return serverResult;
      }
    } catch (err) {
      console.warn('Server duplicate check fallback to local:', err);
    }

    return localResult;
  }

  // Merge link with existing bookmark
  static async mergeLink(
    id: string,
    payload: {
      title?: string;
      category?: string;
      tags?: string[];
      notes?: string;
      mode?: 'smart_merge' | 'overwrite';
      autoAiExtract?: boolean;
    }
  ): Promise<LinkItem> {
    try {
      const res = await fetch(`/api/links/merge/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to merge link');
      }
      const data = await res.json();
      return data.link;
    } catch (err) {
      // Offline fallback: perform local merge
      const cache = this.getLocalCache();
      const idx = cache.findIndex((l) => l.id === id);
      if (idx !== -1) {
        const existing = cache[idx];
        let mergedTitle = payload.title || existing.title;
        let mergedCategory = payload.category || existing.category;
        let mergedTags = payload.tags
          ? Array.from(new Set([...existing.tags, ...payload.tags]))
          : existing.tags;
        let mergedNotes = existing.notes || '';

        if (payload.mode === 'overwrite') {
          if (payload.title) mergedTitle = payload.title;
          if (payload.category) mergedCategory = payload.category;
          if (payload.tags) mergedTags = payload.tags;
          if (payload.notes !== undefined) mergedNotes = payload.notes;
        } else if (payload.notes && payload.notes.trim()) {
          const dateStr = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          mergedNotes = mergedNotes
            ? `${mergedNotes}\n\n[Merged Update • ${dateStr}]:\n${payload.notes.trim()}`
            : payload.notes.trim();
        }

        const mergedItem: LinkItem = {
          ...existing,
          title: mergedTitle,
          category: mergedCategory,
          tags: mergedTags,
          notes: mergedNotes,
          updatedAt: new Date().toISOString(),
        };

        cache[idx] = mergedItem;
        this.setLocalCache(cache);
        return mergedItem;
      }
      throw err;
    }
  }

  // Delete link
  static async deleteLink(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/links/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      return true;
    } catch (err) {
      const cache = this.getLocalCache().filter(l => l.id !== id);
      this.setLocalCache(cache);
      return true;
    }
  }

  // Batch operations
  static async batchAction(ids: string[], action: string, value?: any): Promise<boolean> {
    try {
      const res = await fetch('/api/links/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, value }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // AI Extraction for a single link with Model Orchestrator
  static async extractAI(
    url: string,
    title?: string,
    notes?: string,
    linkId?: string,
    preferredModel?: string
  ): Promise<any> {
    try {
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title, notes, linkId, preferredModel }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'AI Extraction failed');
      }
      const data = await res.json();
      return data.result || data;
    } catch (err: any) {
      console.warn('extractAI network notice, generating local extraction:', err);
      // Return a safe minimal structure so the app never breaks
      return {
        title: title || url,
        category: 'Dev & Tech',
        tags: ['inbox'],
        summary: {
          tldr: 'Saved bookmark in OmniLink repository.',
          keyTakeaways: ['Reference link preserved in repository cache'],
        },
        readingTimeMinutes: 3,
        aiScore: 85,
      };
    }
  }

  // AI Semantic Clustering via Thinking Gemini 3.7
  static async fetchClusters(): Promise<ClusterGroup[]> {
    const res = await fetch('/api/ai/cluster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      throw new Error('Clustering failed');
    }
    const data = await res.json();
    return data.clusters || [];
  }

  // AI Ask Repo via Thinking Gemini 3.7
  static async askRepository(question: string, preferredModel?: string): Promise<AskRepoResponse> {
    const res = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, preferredModel }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Ask AI failed');
    }
    return res.json();
  }

  // Model Orchestrator Telemetry & Stats
  static async getOrchestratorStats(): Promise<any> {
    try {
      const res = await fetch('/api/ai/orchestrator-stats');
      if (!res.ok) throw new Error('Failed to fetch orchestrator stats');
      const data = await res.json();
      return data.stats;
    } catch (e) {
      console.warn('getOrchestratorStats fallback:', e);
      return null;
    }
  }

  // Model Route Preview
  static async previewRoute(payload: any): Promise<any> {
    try {
      const res = await fetch('/api/ai/route-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to preview route');
      const data = await res.json();
      return data.decision;
    } catch (e) {
      console.warn('previewRoute fallback:', e);
      return null;
    }
  }

  // Fetch Dashboard Stats with ETag caching
  static async fetchStats(): Promise<SystemStats> {
    try {
      const headers: Record<string, string> = {};
      const lastEtag = localStorage.getItem(STATS_ETAG_KEY);
      if (lastEtag) {
        headers['If-None-Match'] = lastEtag;
      }

      const res = await fetch('/api/stats', { headers });
      if (res.status === 304) {
        const cached = this.getLocalStats();
        if (cached) return cached;
      }

      if (!res.ok) throw new Error('Stats fetch failed');
      const data: SystemStats = await res.json();

      const newEtag = res.headers.get('etag');
      if (newEtag) {
        try {
          localStorage.setItem(STATS_ETAG_KEY, newEtag);
        } catch {}
      }
      this.setLocalStats(data);
      return data;
    } catch (e) {
      const cached = this.getLocalStats();
      if (cached) return cached;
      throw e;
    }
  }

  // Import links to repository
  static async importLinks(links: LinkItem[], mode: 'merge' | 'replace'): Promise<boolean> {
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ links, mode }),
    });
    return res.ok;
  }

  // =====================================
  // RSS Feed Subscriptions Client API
  // =====================================

  // List all subscribed feeds
  static async fetchRssFeeds(): Promise<RssFeed[]> {
    try {
      const res = await fetch('/api/rss/feeds');
      if (!res.ok) throw new Error('Failed to fetch feeds');
      const data = await res.json();
      return data.feeds || [];
    } catch (err) {
      console.warn('Feeds fetch error:', err);
      return [];
    }
  }

  // Subscribe to a new RSS feed
  static async subscribeRssFeed(feedInput: {
    url: string;
    siteUrl?: string;
    title?: string;
    description?: string;
    category?: string;
    defaultTags?: string[];
    autoAiExtract?: boolean;
    pollIntervalMinutes?: number;
    initialSync?: boolean;
  }): Promise<{ feed: RssFeed; newItemsCount: number }> {
    const res = await fetch('/api/rss/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedInput),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to subscribe to feed');
    }
    return res.json();
  }

  // Update feed settings
  static async updateRssFeed(id: string, updates: Partial<RssFeed>): Promise<RssFeed> {
    const res = await fetch(`/api/rss/feeds/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update feed');
    }
    const data = await res.json();
    return data.feed;
  }

  // Delete feed subscription
  static async deleteRssFeed(id: string, deleteAssociatedLinks = false): Promise<boolean> {
    const res = await fetch(`/api/rss/feeds/${id}?deleteAssociatedLinks=${deleteAssociatedLinks}`, {
      method: 'DELETE',
    });
    return res.ok;
  }

  // Auto-discover RSS feed from web URL
  static async discoverRssFeed(url: string): Promise<RssDiscoveryResult> {
    const res = await fetch('/api/rss/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Feed discovery failed');
    }
    return res.json();
  }

  // Sync single feed
  static async syncRssFeed(id: string): Promise<RssSyncResult> {
    const res = await fetch(`/api/rss/feeds/${id}/sync`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Sync failed');
    }
    return res.json();
  }

  // Sync all enabled feeds
  static async syncAllRssFeeds(): Promise<RssSyncResult> {
    const res = await fetch('/api/rss/sync', {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'All feeds sync failed');
    }
    return res.json();
  }

  // Fetch curated dev & engineering blogs catalog
  static async fetchRssCatalog(): Promise<Array<Omit<RssFeed, 'id' | 'createdAt' | 'updatedAt' | 'totalFetchedCount'> & { isSubscribed: boolean }>> {
    try {
      const res = await fetch('/api/rss/catalog');
      if (!res.ok) throw new Error('Failed to fetch catalog');
      const data = await res.json();
      return data.catalog || [];
    } catch {
      return [];
    }
  }

  // Import feeds from OPML
  static async importOpml(opmlContent: string, initialSync = true): Promise<OpmlImportResult> {
    const res = await fetch('/api/rss/opml/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opmlContent, initialSync }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'OPML import failed');
    }
    return res.json();
  }

  // Get OPML export download link
  static getOpmlExportUrl(): string {
    return '/api/rss/opml/export';
  }

  // --- Hybrid Search & Vector Embedding APIs ---

  // Perform Hybrid (FTS5 + Dense Vector + RRF) search
  static async searchHybrid(query: string, options: {
    category?: string;
    platform?: string;
    readStatus?: string;
    limit?: number;
    minScore?: number;
  } = {}): Promise<HybridSearchMatch[]> {
    try {
      const res = await fetch('/api/ai/search/hybrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, ...options }),
      });
      if (!res.ok) throw new Error('Hybrid search failed');
      const data = await res.json();
      return data.results || [];
    } catch (err) {
      console.warn('Hybrid search API error, falling back to local filter:', err);
      return [];
    }
  }

  // Trigger full vector embedding re-indexing
  static async reindexEmbeddings(): Promise<{ indexed: number; total: number }> {
    const res = await fetch('/api/ai/embeddings/reindex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to trigger reindexing');
    return res.json();
  }

  // Check vector embeddings index status
  static async getEmbeddingsStatus(): Promise<EmbeddingsStatusResponse> {
    const res = await fetch('/api/ai/embeddings/status');
    if (!res.ok) throw new Error('Failed to get embeddings status');
    return res.json();
  }

  // --- Offline Reader Mode APIs ---

  // Get or extract offline reader mode article snapshot
  static async getReaderSnapshot(linkId: string): Promise<ReaderSnapshot> {
    const res = await fetch(`/api/links/${linkId}/reader`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch article content');
    }
    const data = await res.json();
    return data.snapshot;
  }

  // Force capture fresh offline reader snapshot
  static async captureReaderSnapshot(linkId: string): Promise<ReaderSnapshot> {
    const res = await fetch(`/api/links/${linkId}/reader/snapshot`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to capture snapshot');
    }
    const data = await res.json();
    return data.snapshot;
  }
}
