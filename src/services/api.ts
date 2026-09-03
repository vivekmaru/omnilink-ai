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
const CACHE_NAMESPACE_KEY = 'omnilink_cache_workspace_v1';
const CACHE_KEYS = [STORAGE_KEY, ETAG_KEY, STATS_STORAGE_KEY, STATS_ETAG_KEY, PENDING_SYNC_KEY] as const;

export const AUTHENTICATION_REQUIRED_EVENT = 'omnilink:authentication-required';

interface WorkspaceCacheKeys {
  links: string | null;
  linksEtag: string | null;
  stats: string | null;
  statsEtag: string | null;
  pendingSync: string | null;
}

/**
 * Raised when the API rejects the current browser session or service token.
 *
 * Authentication failures must not fall through to the offline cache: doing so
 * would make a multi-user client appear to work while showing another local
 * user's stale data.  The error intentionally contains only the HTTP status,
 * never a token or response body.
 */
export class ApiAuthenticationError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403) {
    super(status === 401 ? 'Authentication required (HTTP 401)' : 'Not authorized (HTTP 403)');
    this.name = 'ApiAuthenticationError';
    this.status = status;
  }
}

export class ApiService {
  /**
   * Optional in-memory bearer token for non-browser callers embedding the API
   * service.  Browser sessions remain cookie-based by default; callers should
   * inject a short-lived token explicitly instead of persisting it in
   * localStorage or putting it in a URL.
   */
  private static serviceToken: string | null = null;
  private static workspaceNamespace: string | null = null;
  private static workspaceGeneration = 0;

  /**
   * Select the authenticated workspace before rendering repository UI. All
   * repository data, ETags, and pending-sync state are isolated under this
   * namespace. Switching identities clears the previously active namespace so
   * a shared browser profile cannot expose the prior workspace offline.
   */
  static setWorkspaceNamespace(workspaceId: string): void {
    const normalized = typeof workspaceId === 'string' ? workspaceId.trim() : '';
    if (!normalized || normalized.length > 255) {
      throw new TypeError('workspaceId must be a non-empty string of at most 255 characters.');
    }

    if (this.workspaceNamespace !== normalized) this.workspaceGeneration += 1;

    try {
      const previous = localStorage.getItem(CACHE_NAMESPACE_KEY);
      if (previous && previous !== normalized) {
        this.removeWorkspaceCache(previous);
      }

      this.workspaceNamespace = normalized;
      if (normalized === 'local-default') {
        this.migrateLegacyLocalCache(normalized);
      } else {
        // Unscoped caches pre-date tenant isolation and must never be assigned
        // to the first multi-user workspace that happens to sign in.
        for (const key of CACHE_KEYS) localStorage.removeItem(key);
      }
      localStorage.setItem(CACHE_NAMESPACE_KEY, normalized);
    } catch {
      // Storage can be disabled or quota-restricted. The in-memory namespace
      // still prevents this tab from reading an unscoped cache.
      this.workspaceNamespace = normalized;
    }
  }

  static getWorkspaceNamespace(): string | null {
    return this.workspaceNamespace;
  }

  /**
   * Remove the active workspace's browser cache and disable cache access. This
   * is used for logout, expired sessions, and unauthenticated/error states.
   */
  static clearWorkspaceNamespace(): void {
    try {
      const active = this.workspaceNamespace || localStorage.getItem(CACHE_NAMESPACE_KEY);
      if (active) this.removeWorkspaceCache(active);
      for (const key of CACHE_KEYS) localStorage.removeItem(key);
      localStorage.removeItem(CACHE_NAMESPACE_KEY);
    } catch {
      // Best effort only; setting the in-memory namespace to null below is the
      // critical boundary for the active application instance.
    }
    this.workspaceNamespace = null;
    this.workspaceGeneration += 1;
    this.clearServiceToken();
  }

  static async logout(): Promise<void> {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
    } finally {
      this.clearWorkspaceNamespace();
      this.notifyAuthenticationRequired();
    }
  }

  private static namespacedKey(base: string, workspaceId: string | null = this.workspaceNamespace): string | null {
    return workspaceId ? `${base}:${encodeURIComponent(workspaceId)}` : null;
  }

  private static currentCacheKeys(): WorkspaceCacheKeys {
    return {
      links: this.namespacedKey(STORAGE_KEY),
      linksEtag: this.namespacedKey(ETAG_KEY),
      stats: this.namespacedKey(STATS_STORAGE_KEY),
      statsEtag: this.namespacedKey(STATS_ETAG_KEY),
      pendingSync: this.namespacedKey(PENDING_SYNC_KEY),
    };
  }

  private static readLinksFromKey(key: string | null): LinkItem[] {
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private static writeLinksToKey(key: string | null, links: LinkItem[]): void {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(links));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  private static readStatsFromKey(key: string | null): SystemStats | null {
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private static writeStatsToKey(key: string | null, stats: SystemStats): void {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(stats));
    } catch (e) {
      console.warn('LocalStorage stats save failed:', e);
    }
  }

  private static removeWorkspaceCache(workspaceId: string): void {
    for (const base of CACHE_KEYS) {
      const key = this.namespacedKey(base, workspaceId);
      if (key) localStorage.removeItem(key);
    }
  }

  private static migrateLegacyLocalCache(workspaceId: string): void {
    for (const base of CACHE_KEYS) {
      const legacyValue = localStorage.getItem(base);
      const target = this.namespacedKey(base, workspaceId);
      if (legacyValue !== null && target && localStorage.getItem(target) === null) {
        localStorage.setItem(target, legacyValue);
      }
      localStorage.removeItem(base);
    }
  }

  private static notifyAuthenticationRequired(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTHENTICATION_REQUIRED_EVENT));
    }
  }

  static setServiceToken(token: string | null | undefined): void {
    const normalized = typeof token === 'string' ? token.trim() : '';
    this.serviceToken = normalized || null;
  }

  static clearServiceToken(): void {
    this.serviceToken = null;
  }

  static hasServiceToken(): boolean {
    return this.serviceToken !== null;
  }

  private static isAuthenticationError(err: unknown): err is ApiAuthenticationError {
    return err instanceof ApiAuthenticationError;
  }

  /**
   * Centralize credentials and bearer handling for every API request.  The
   * default same-origin credentials mode sends an HttpOnly browser session
   * cookie, while an explicitly injected service token is sent as an
   * Authorization header only.
   */
  private static async request(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.serviceToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.serviceToken}`);
    }

    const res = await fetch(input, {
      ...init,
      headers,
      credentials: init.credentials ?? 'same-origin',
    });

    if (res.status === 401) {
      this.clearWorkspaceNamespace();
      this.notifyAuthenticationRequired();
      throw new ApiAuthenticationError(res.status);
    }
    if (res.status === 403) {
      throw new ApiAuthenticationError(res.status);
    }
    return res;
  }

  private static isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  // Load from local storage cache
  static getLocalCache(): LinkItem[] {
    return this.readLinksFromKey(this.currentCacheKeys().links);
  }

  static setLocalCache(links: LinkItem[]): void {
    this.writeLinksToKey(this.currentCacheKeys().links, links);
  }

  // Load from local stats cache
  static getLocalStats(): SystemStats | null {
    return this.readStatsFromKey(this.currentCacheKeys().stats);
  }

  static setLocalStats(stats: SystemStats): void {
    this.writeStatsToKey(this.currentCacheKeys().stats, stats);
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

    const cacheKeys = this.currentCacheKeys();
    const cacheGeneration = this.workspaceGeneration;
    try {
      const headers: Record<string, string> = {};
      if (isDefaultFetch) {
        const lastEtag = cacheKeys.linksEtag ? localStorage.getItem(cacheKeys.linksEtag) : null;
        if (lastEtag) {
          headers['If-None-Match'] = lastEtag;
        }
      }

      const res = await this.request(`/api/links?${params.toString()}`, { headers });
      
      // If 304 Not Modified, reuse existing local cache instantly with 0 payload transferred
      if (res.status === 304) {
        if (cacheGeneration !== this.workspaceGeneration) return { links: [], total: 0 };
        const cached = this.readLinksFromKey(cacheKeys.links);
        return { links: cached, total: cached.length, notModified: true };
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (cacheGeneration !== this.workspaceGeneration) return { links: data.links, total: data.total };
      
      const newEtag = res.headers.get('etag');
      if (newEtag && isDefaultFetch) {
        try {
          if (cacheKeys.linksEtag) localStorage.setItem(cacheKeys.linksEtag, newEtag);
        } catch {}
      }

      // Update local offline cache
      if (isDefaultFetch) {
        this.writeLinksToKey(cacheKeys.links, data.links);
      }
      return { links: data.links, total: data.total };
    } catch (err) {
      if (cacheGeneration !== this.workspaceGeneration) return { links: [], total: 0 };
      if (this.isAuthenticationError(err)) throw err;
      console.warn('Server fetch failed, falling back to local cache:', err);
      let local = this.readLinksFromKey(cacheKeys.links);
      
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
      const res = await this.request('/api/links/preview-metadata', {
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
    const cacheKeys = this.currentCacheKeys();
    const cacheGeneration = this.workspaceGeneration;
    try {
      const res = await this.request('/api/links', {
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
      if (cacheGeneration !== this.workspaceGeneration) throw err;
      if (this.isAuthenticationError(err)) throw err;
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
      const cache = this.readLinksFromKey(cacheKeys.links);
      this.writeLinksToKey(cacheKeys.links, [localItem, ...cache]);
      return localItem;
    }
  }

  // Update existing link
  static async updateLink(id: string, updates: Partial<LinkItem>): Promise<LinkItem> {
    const cacheKeys = this.currentCacheKeys();
    const cacheGeneration = this.workspaceGeneration;
    try {
      const res = await this.request(`/api/links/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Update failed');
      const data = await res.json();
      return data.link;
    } catch (err) {
      if (cacheGeneration !== this.workspaceGeneration) throw err;
      if (this.isAuthenticationError(err)) throw err;
      const cache = this.readLinksFromKey(cacheKeys.links);
      const idx = cache.findIndex(l => l.id === id);
      if (idx !== -1) {
        cache[idx] = { ...cache[idx], ...updates, updatedAt: new Date().toISOString() };
        this.writeLinksToKey(cacheKeys.links, cache);
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
      const res = await this.request('/api/links/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      if (res.ok) {
        const serverResult: DuplicateCheckResult = await res.json();
        return serverResult;
      }
    } catch (err) {
      if (this.isAuthenticationError(err)) throw err;
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
    const cacheKeys = this.currentCacheKeys();
    const cacheGeneration = this.workspaceGeneration;
    try {
      const res = await this.request(`/api/links/merge/${id}`, {
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
      if (cacheGeneration !== this.workspaceGeneration) throw err;
      if (this.isAuthenticationError(err)) throw err;
      // Offline fallback: perform local merge
      const cache = this.readLinksFromKey(cacheKeys.links);
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
        this.writeLinksToKey(cacheKeys.links, cache);
        return mergedItem;
      }
      throw err;
    }
  }

  // Delete link
  static async deleteLink(id: string): Promise<boolean> {
    const cacheKeys = this.currentCacheKeys();
    const cacheGeneration = this.workspaceGeneration;
    try {
      const res = await this.request(`/api/links/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      return true;
    } catch (err) {
      if (cacheGeneration !== this.workspaceGeneration) throw err;
      if (this.isAuthenticationError(err)) throw err;
      const cache = this.readLinksFromKey(cacheKeys.links).filter(l => l.id !== id);
      this.writeLinksToKey(cacheKeys.links, cache);
      return true;
    }
  }

  // Batch operations
  static async batchAction(ids: string[], action: string, value?: any): Promise<boolean> {
    try {
      const res = await this.request('/api/links/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, value }),
      });
      return res.ok;
    } catch (err) {
      if (this.isAuthenticationError(err)) throw err;
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
      const res = await this.request('/api/ai/extract', {
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
      if (this.isAuthenticationError(err)) throw err;
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
    const res = await this.request('/api/ai/cluster', {
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
    const res = await this.request('/api/ai/ask', {
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
      const res = await this.request('/api/ai/orchestrator-stats');
      if (!res.ok) throw new Error('Failed to fetch orchestrator stats');
      const data = await res.json();
      return data.stats;
    } catch (e) {
      if (this.isAuthenticationError(e)) throw e;
      console.warn('getOrchestratorStats fallback:', e);
      return null;
    }
  }

  // Model Route Preview
  static async previewRoute(payload: any): Promise<any> {
    try {
      const res = await this.request('/api/ai/route-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to preview route');
      const data = await res.json();
      return data.decision;
    } catch (e) {
      if (this.isAuthenticationError(e)) throw e;
      console.warn('previewRoute fallback:', e);
      return null;
    }
  }

  // Fetch Dashboard Stats with ETag caching
  static async fetchStats(): Promise<SystemStats> {
    const cacheKeys = this.currentCacheKeys();
    const cacheGeneration = this.workspaceGeneration;
    try {
      const headers: Record<string, string> = {};
      const lastEtag = cacheKeys.statsEtag ? localStorage.getItem(cacheKeys.statsEtag) : null;
      if (lastEtag) {
        headers['If-None-Match'] = lastEtag;
      }

      const res = await this.request('/api/stats', { headers });
      if (res.status === 304) {
        if (cacheGeneration !== this.workspaceGeneration) throw new Error('Workspace changed while fetching stats.');
        const cached = this.readStatsFromKey(cacheKeys.stats);
        if (cached) return cached;
      }

      if (!res.ok) throw new Error('Stats fetch failed');
      const data: SystemStats = await res.json();
      if (cacheGeneration !== this.workspaceGeneration) throw new Error('Workspace changed while fetching stats.');

      const newEtag = res.headers.get('etag');
      if (newEtag) {
        try {
          if (cacheKeys.statsEtag) localStorage.setItem(cacheKeys.statsEtag, newEtag);
        } catch {}
      }
      this.writeStatsToKey(cacheKeys.stats, data);
      return data;
    } catch (e) {
      if (cacheGeneration !== this.workspaceGeneration) throw e;
      if (this.isAuthenticationError(e)) throw e;
      const cached = this.readStatsFromKey(cacheKeys.stats);
      if (cached) return cached;
      throw e;
    }
  }

  // Import links to repository
  static async importLinks(links: LinkItem[], mode: 'merge' | 'replace'): Promise<boolean> {
    const res = await this.request('/api/import', {
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
      const res = await this.request('/api/rss/feeds');
      if (!res.ok) throw new Error('Failed to fetch feeds');
      const data = await res.json();
      return data.feeds || [];
    } catch (err) {
      if (this.isAuthenticationError(err)) throw err;
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
    const res = await this.request('/api/rss/feeds', {
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
    const res = await this.request(`/api/rss/feeds/${id}`, {
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
    const res = await this.request(`/api/rss/feeds/${id}?deleteAssociatedLinks=${deleteAssociatedLinks}`, {
      method: 'DELETE',
    });
    return res.ok;
  }

  // Auto-discover RSS feed from web URL
  static async discoverRssFeed(url: string): Promise<RssDiscoveryResult> {
    const res = await this.request('/api/rss/discover', {
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
    const res = await this.request(`/api/rss/feeds/${id}/sync`, {
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
    const res = await this.request('/api/rss/sync', {
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
      const res = await this.request('/api/rss/catalog');
      if (!res.ok) throw new Error('Failed to fetch catalog');
      const data = await res.json();
      return data.catalog || [];
    } catch (err) {
      if (this.isAuthenticationError(err)) throw err;
      return [];
    }
  }

  // Import feeds from OPML
  static async importOpml(opmlContent: string, initialSync = true): Promise<OpmlImportResult> {
    const res = await this.request('/api/rss/opml/import', {
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
      const res = await this.request('/api/ai/search/hybrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, ...options }),
      });
      if (!res.ok) throw new Error('Hybrid search failed');
      const data = await res.json();
      return data.results || [];
    } catch (err) {
      if (this.isAuthenticationError(err)) throw err;
      console.warn('Hybrid search API error, falling back to local filter:', err);
      return [];
    }
  }

  // Trigger full vector embedding re-indexing
  static async reindexEmbeddings(): Promise<{ indexed: number; total: number }> {
    const res = await this.request('/api/ai/embeddings/reindex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to trigger reindexing');
    return res.json();
  }

  // Check vector embeddings index status
  static async getEmbeddingsStatus(): Promise<EmbeddingsStatusResponse> {
    const res = await this.request('/api/ai/embeddings/status');
    if (!res.ok) throw new Error('Failed to get embeddings status');
    return res.json();
  }

  // --- Offline Reader Mode APIs ---

  // Get or extract offline reader mode article snapshot
  static async getReaderSnapshot(linkId: string): Promise<ReaderSnapshot> {
    const res = await this.request(`/api/links/${linkId}/reader`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch article content');
    }
    const data = await res.json();
    return data.snapshot;
  }

  // Force capture fresh offline reader snapshot
  static async captureReaderSnapshot(linkId: string): Promise<ReaderSnapshot> {
    const res = await this.request(`/api/links/${linkId}/reader/snapshot`, {
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
