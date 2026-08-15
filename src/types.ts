export type PlatformType =
  | 'github'
  | 'reddit_post'
  | 'reddit_comment'
  | 'instagram_short'
  | 'youtube'
  | 'twitter_x'
  | 'article'
  | 'paper'
  | 'other';

export type ReadStatus = 'unread' | 'reading' | 'read';

export interface LinkSummary {
  tldr: string;
  keyTakeaways?: string[];
  takeaways?: string[];
  codeSnippets?: string[];
  quotes?: string[];
  quote?: string;
  estimatedReadTimeMinutes?: number;
}

export interface LinkItem {
  id: string;
  url: string;
  title: string;
  description?: string;
  author?: string;
  platform: PlatformType;
  category: string;
  tags: string[];
  summary: LinkSummary;
  aiSummary?: LinkSummary;
  thumbnailUrl?: string;
  faviconUrl?: string;
  notes?: string;
  isFavorite: boolean;
  isArchived: boolean;
  readStatus: ReadStatus;
  createdAt: string;
  updatedAt: string;
  readingTimeMinutes?: number;
  aiScore?: number;
  feedId?: string;
  feedTitle?: string;
  isRssFeedItem?: boolean;
}

export interface ClusterGroup {
  id: string;
  title: string;
  description: string;
  linkIds: string[];
  themeColor?: string;
  tags?: string[];
  keywords?: string[];
}

export interface FilterState {
  searchQuery: string;
  platform: PlatformType | 'all';
  category: string | 'all';
  tag: string | 'all';
  readStatus: ReadStatus | 'all';
  onlyFavorites: boolean;
  includeArchived: boolean;
  sortBy: 'newest' | 'oldest' | 'title' | 'readingTime' | 'aiScore';
}

export type ViewMode = 'grid' | 'list' | 'kanban' | 'cluster';

export interface ExtractionResult {
  url: string;
  title: string;
  description?: string;
  author?: string;
  platform: PlatformType;
  category: string;
  tags: string[];
  summary?: LinkSummary;
  tldr?: string;
  keyTakeaways?: string[];
  codeSnippets?: string[];
  quotes?: string[];
  thumbnailUrl?: string;
  faviconUrl?: string;
  readingTimeMinutes?: number;
  aiScore?: number;
}

export interface EncryptedBackupData {
  version: number;
  iv: string; // Base64
  salt: string; // Base64
  ciphertext: string; // Base64
  timestamp: string;
  totalCount: number;
}

export interface AskRepoResponse {
  answer: string;
  referencedLinkIds: string[];
  suggestions: string[];
}

export interface SystemStats {
  totalLinks: number;
  unreadCount: number;
  favoritesCount: number;
  archivedCount: number;
  platformCounts?: Record<string, number>;
  platformBreakdown?: Record<string, number>;
  categoriesBreakdown?: Record<string, number>;
  topCategories?: { category: string; count: number }[];
  topTags?: { tag: string; count: number }[];
}

export interface TagSuggestion {
  tag: string;
  confidence: number; // 0-100
  matchedIn: 'title' | 'description' | 'url' | 'domain' | 'ai';
  reason: string;
}

export interface CategorySuggestion {
  category: string;
  confidence: number; // 0-100
  reason: string;
}

export interface AutoTaggingResult {
  suggestedTags: TagSuggestion[];
  suggestedCategory: CategorySuggestion;
  extractedKeywords: string[];
  autoDetectedTitle?: string;
  autoDetectedDescription?: string;
  platform?: PlatformType;
}

export interface RssFeed {
  id: string;
  url: string;             // RSS/Atom endpoint URL
  siteUrl?: string;        // Web Homepage URL
  title: string;
  description?: string;
  category: string;
  defaultTags: string[];
  autoAiExtract: boolean;  // Automatically trigger Gemini TL;DR on incoming items
  pollIntervalMinutes: number;
  enabled: boolean;
  faviconUrl?: string;
  lastFetchedAt?: string;
  lastError?: string;
  totalFetchedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RssFeedItem {
  guid: string;
  title: string;
  link: string;
  pubDate?: string;
  author?: string;
  contentSnippet?: string;
  categories?: string[];
  thumbnailUrl?: string;
}

export interface RssDiscoveryResult {
  discovered: boolean;
  feedUrl: string;
  siteUrl?: string;
  title: string;
  description?: string;
  sampleItems: RssFeedItem[];
  feedType: 'rss2' | 'atom' | 'rdf' | 'json' | 'unknown';
}

export interface RssSyncResult {
  success: boolean;
  feedId?: string;
  feedTitle?: string;
  newItemsCount: number;
  totalFeedsProcessed?: number;
  errors?: string[];
  newLinks?: LinkItem[];
}

export interface OpmlFeedEntry {
  title: string;
  xmlUrl: string;
  htmlUrl?: string;
  category?: string;
}

export interface OpmlImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  feeds: RssFeed[];
}

// ==========================================
// Model Orchestration Layer Types
// ==========================================

export type ModelTaskType =
  | 'quick_metadata'
  | 'auto_tagging'
  | 'standard_extraction'
  | 'deep_reasoning'
  | 'rss_ingestion';

export type GeminiModelId =
  | 'gemini-3.1-flash-lite'
  | 'gemini-3.7-flash'
  | 'gemini-flash-latest'
  | 'gemini-3.1-pro-preview';

export type ModelThinkingLevel = 'HIGH' | 'LOW' | 'MINIMAL' | 'NONE';

export interface ModelRouteDecision {
  taskType: ModelTaskType;
  selectedModel: GeminiModelId;
  reason: string;
  thinkingLevel?: ModelThinkingLevel;
  complexityScore: number; // 0-100
  complexityTier: 'Low (Lite)' | 'Medium (Standard)' | 'High (Deep Reasoning)' | 'Ultra (Pro Synthesis)';
  fallbackChain: GeminiModelId[];
  isCustomOverride?: boolean;
}

export interface OrchestrationExecutionTelemetry {
  id: string;
  timestamp: string;
  taskType: ModelTaskType;
  requestedModel: GeminiModelId;
  executedModel: GeminiModelId;
  latencyMs: number;
  fallbackUsed: boolean;
  fallbackHops: number;
  thinkingLevel?: string;
  success: boolean;
  tokenEstimate?: number;
  error?: string;
  targetUrlOrPrompt?: string;
}

export interface ModelOrchestratorStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  fallbackCount: number;
  avgLatencyMs: number;
  modelBreakdown: Record<string, number>;
  taskBreakdown: Record<string, number>;
  activeModels: {
    id: GeminiModelId;
    name: string;
    role: string;
    tier: 'Fast Lite' | 'Balanced Flash' | 'Deep Reasoning Pro';
    status: 'healthy' | 'degraded' | 'standby';
    usageCount: number;
    avgLatencyMs: number;
  }[];
  recentLogs: OrchestrationExecutionTelemetry[];
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchType?: 'exact' | 'normalized' | 'domain_path';
  existingLink: LinkItem | null;
  normalizedUrl: string;
}

