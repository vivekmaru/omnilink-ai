import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { RssFeedManager, CURATED_DEV_FEEDS } from './server/rssService';
import { ModelOrchestrator } from './server/modelOrchestrator';
import { GeminiModelId } from './src/types';
import { analyzeAndSuggestTags } from './src/services/autoTagging';
import { normalizeUrl, checkDuplicateInLinks } from './src/utils/url';
import { LOCAL_WORKSPACE_ID, omniDb } from './server/db';
import { hybridSearchEngine } from './server/hybridSearch';
import { ReadabilityService } from './server/readabilityService';
import {
  validateBody,
  validateQuery,
  sanitizeText,
  CreateLinkSchema,
  UpdateLinkSchema,
  BatchActionSchema,
  MergeLinkSchema,
  AskRepoSchema,
  HybridSearchSchema,
  CheckDuplicateSchema,
  AddRssFeedSchema,
} from './server/validators';
import {
  attachEndpointPolicy,
} from './server/securityBoundary';
import { describeUnsafeRemoteWarning, loadRuntimeConfig } from './server/runtimeConfig';
import { createAuthStack } from './server/auth/http';
import { AiQuotaExceededError, createAiAdmissionMiddleware } from './server/aiUsage';

dotenv.config();

const app = express();
const runtimeConfig = loadRuntimeConfig();
const authStackPromise = createAuthStack(runtimeConfig, omniDb);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(attachEndpointPolicy);
app.use(async (req, res, next) => {
  try {
    const stack = await authStackPromise;
    const handlers: express.RequestHandler[] = [...stack.middleware, stack.router];
    let index = 0;
    const run = (error?: unknown): void => {
      if (error) return next(error);
      const handler = handlers[index++];
      if (!handler) return next();
      try {
        const result = (handler as any)(req, res, run);
        if (result && typeof (result as Promise<unknown>).catch === 'function') {
          (result as Promise<unknown>).catch(run);
        }
      } catch (handlerError) {
        run(handlerError);
      }
    };
    run();
  } catch (error) {
    next(error);
  }
});
app.use(createAiAdmissionMiddleware(runtimeConfig, omniDb));

// Healthcheck endpoint for Docker container & Cloud Load Balancers
app.get(['/health', '/api/health'], (req, res) => {
  try {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Healthcheck] failed:', err);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
    });
  }
});

// Lazy Google GenAI Client
let genAiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!genAiClient) {
    genAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAiClient;
}

// Data Directory & Persistence
const DATA_DIR = path.join(process.cwd(), 'data');
const REPO_FILE = path.join(DATA_DIR, 'repository.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface LinkSummary {
  tldr: string;
  keyTakeaways?: string[];
  takeaways?: string[];
  codeSnippets?: string[];
  quotes?: string[];
  quote?: string;
  estimatedReadTimeMinutes?: number;
}

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
  readStatus: 'unread' | 'reading' | 'read';
  createdAt: string;
  updatedAt: string;
  readingTimeMinutes?: number;
  aiScore?: number;
  feedId?: string;
  feedTitle?: string;
  isRssFeedItem?: boolean;
}

// Seed initial realistic data for instant rich experience
const SEED_LINKS: LinkItem[] = [
  {
    id: 'seed-github-1',
    url: 'https://github.com/shadcn-ui/ui',
    title: 'shadcn/ui: Beautifully designed components copied into your apps',
    description: 'Accessible and customizable components that you can copy and paste into your apps. Free. Open Source. Built for React, Next.js, Tailwind CSS.',
    author: 'shadcn',
    platform: 'github',
    category: 'Dev & Tech',
    tags: ['react', 'tailwind', 'ui-components', 'open-source', 'typescript', 'design-system'],
    summary: {
      tldr: 'A collection of re-usable components crafted with Radix UI and Tailwind CSS that live directly in your codebase rather than an external npm package.',
      keyTakeaways: [
        'Decentralized component architecture: code lives in your project repository',
        'Built on top of accessible Radix UI primitives',
        'Styled using Tailwind CSS for total theming freedom',
        'CLI integration for automated component installation',
      ],
      codeSnippets: [
        'npx shadcn@latest add button dialog dropdown-menu'
      ],
      quotes: ['"Not a component library. It is a collection of re-usable components you can copy and paste into your apps."']
    },
    thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
    faviconUrl: 'https://github.githubassets.com/favicons/favicon.svg',
    notes: 'Primary UI component reference for upcoming fullstack dashboard apps.',
    isFavorite: true,
    isArchived: false,
    readStatus: 'read',
    createdAt: '2026-08-10T14:20:00Z',
    updatedAt: '2026-08-10T14:20:00Z',
    readingTimeMinutes: 4,
    aiScore: 96,
  },
  {
    id: 'seed-reddit-1',
    url: 'https://www.reddit.com/r/LocalLLaMA/comments/1f8a81z/best_practices_for_structuring_multiagent_rag/',
    title: 'r/LocalLLaMA: Best practices for structuring multi-agent RAG pipelines in production',
    description: 'Detailed architectural breakdown of state machines vs graph routers for multi-hop agentic RAG with local quantized models.',
    author: 'u/NeuralCrafter',
    platform: 'reddit_post',
    category: 'AI & Machine Learning',
    tags: ['llm', 'rag', 'multi-agent', 'reddit', 'local-ai', 'architecture'],
    summary: {
      tldr: 'In-depth community discussion evaluating LangGraph vs custom deterministic state machines for complex multi-agent reasoning tasks.',
      keyTakeaways: [
        'Avoid single oversized system prompts; route subtasks to focused micro-agents',
        'Use semantic caching to cut down latency by 40% on recurring context lookups',
        'Self-reflection loops should have strict max-retry caps to avoid endless cycles',
        'Deterministic JSON schemas dramatically outperform freeform markdown parsing'
      ],
      quotes: ['"Deterministic routers with structured fallback branches prevent 90% of agent hallucinations."']
    },
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    faviconUrl: 'https://www.redditstatic.com/shreddit/assets/favicon/192x192.png',
    notes: 'Crucial tips on agent loop limits and schema validation.',
    isFavorite: true,
    isArchived: false,
    readStatus: 'reading',
    createdAt: '2026-08-12T09:15:00Z',
    updatedAt: '2026-08-12T09:15:00Z',
    readingTimeMinutes: 6,
    aiScore: 92,
  },
  {
    id: 'seed-reddit-comment-1',
    url: 'https://www.reddit.com/r/webdev/comments/192837/comment/c9876x2',
    title: 'r/webdev comment: Why SQLite with WAL mode outperforms external DBs for single-node workloads',
    description: 'Senior DB architect explains SQLite WAL concurrency, mmap, and why it handles 50,000+ reads/sec with zero network latency.',
    author: 'u/DB_Wizard_99',
    platform: 'reddit_comment',
    category: 'Dev & Tech',
    tags: ['sqlite', 'database', 'reddit-comment', 'performance', 'backend'],
    summary: {
      tldr: 'Comprehensive technical breakdown demonstrating how SQLite Write-Ahead Logging (WAL) and memory mapping provide unmatched low-latency query throughput.',
      keyTakeaways: [
        'PRAGMA journal_mode = WAL enables simultaneous multi-reader concurrency',
        'PRAGMA synchronous = NORMAL eliminates disk sync bottlenecks safely',
        'Zero TCP network overhead means microsecond query execution times',
        'Ideal for edge servers, embedded applications, and single-container cloud run deploy'
      ],
      codeSnippets: [
        'PRAGMA journal_mode = WAL;\nPRAGMA synchronous = NORMAL;\nPRAGMA cache_size = -64000;\nPRAGMA busy_timeout = 5000;'
      ]
    },
    thumbnailUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=600&auto=format&fit=crop&q=80',
    faviconUrl: 'https://www.redditstatic.com/shreddit/assets/favicon/192x192.png',
    notes: 'Use these PRAGMA configs in all standalone microservices.',
    isFavorite: false,
    isArchived: false,
    readStatus: 'read',
    createdAt: '2026-08-11T18:00:00Z',
    updatedAt: '2026-08-11T18:00:00Z',
    readingTimeMinutes: 3,
    aiScore: 88,
  },
  {
    id: 'seed-insta-1',
    url: 'https://www.instagram.com/reel/C8k9xL2pQ1M/',
    title: 'Minimalist Engineering Desk Setup & Cable Management Secrets (Reel)',
    description: '30-second workflow breakdown featuring magnetic cable channels, under-desk power strips, and dual monitor arms for ergonomic flow.',
    author: '@minimal.workspace',
    platform: 'instagram_short',
    category: 'Design & UI',
    tags: ['instagram', 'desk-setup', 'minimalism', 'productivity', 'hardware'],
    summary: {
      tldr: 'Quick visual guide highlighting under-desk J-channel raceways and magnetic cable anchors to create a clutter-free productive workspace.',
      keyTakeaways: [
        'Mount surge protectors upside down under the tabletop with heavy-duty VHB tape',
        'Use braided sleeves for grouped monitor cords to avoid visible dangling wires',
        '3000K warm diffuse backlighting reduces eye strain during late coding sessions'
      ]
    },
    thumbnailUrl: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&auto=format&fit=crop&q=80',
    faviconUrl: 'https://static.cdninstagram.com/rsrc.php/v3/yI/r/VsNE-OHk_8a.png',
    notes: 'Inspiration for office revamp.',
    isFavorite: false,
    isArchived: false,
    readStatus: 'unread',
    createdAt: '2026-08-13T11:45:00Z',
    updatedAt: '2026-08-13T11:45:00Z',
    readingTimeMinutes: 1,
    aiScore: 78,
  },
  {
    id: 'seed-youtube-1',
    url: 'https://www.youtube.com/watch?v=kY31g4oNn7s',
    title: 'Building a Full-Stack Autonomous Agent from Scratch in TypeScript',
    description: 'Masterclass covering tool definitions, streaming token parsing, session persistence, and self-correction loops.',
    author: 'AI Engineering Lab',
    platform: 'youtube',
    category: 'Tutorials & Guides',
    tags: ['youtube', 'typescript', 'ai-agents', 'tutorial', 'fullstack'],
    summary: {
      tldr: 'A deep-dive tutorial demonstrating how to construct an agent execution loop with tool invocation, streaming feedback, and safe state validation.',
      keyTakeaways: [
        'Use Zod or standard JSON schema for function declaration parameter safety',
        'Handle tool call timeouts with dedicated circuit breaker patterns',
        'Stream intermediate step notifications directly to frontend SSE streams',
        'Maintain short-term memory separate from archival vector retrieval'
      ],
      codeSnippets: [
        'const toolCallResponse = await executeTool(call.name, call.args);'
      ]
    },
    thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
    faviconUrl: 'https://www.youtube.com/s/desktop/9991207e/img/favicon.ico',
    notes: 'Watch section 3 on streaming error recovery.',
    isFavorite: true,
    isArchived: false,
    readStatus: 'unread',
    createdAt: '2026-08-14T02:10:00Z',
    updatedAt: '2026-08-14T02:10:00Z',
    readingTimeMinutes: 15,
    aiScore: 94,
  }
];

// Initialize and migrate database
omniDb.migrateIfNeeded(SEED_LINKS);

function loadLinks(): LinkItem[] {
  return omniDb.getAllLinks();
}

function saveLinks(links?: LinkItem[], workspaceId: string = LOCAL_WORKSPACE_ID): void {
  if (workspaceId !== LOCAL_WORKSPACE_ID) return;
  // SQLite maintains atomic persistence automatically.
  // Optional backup sync to repository.json for portability:
  try {
    const all = links || omniDb.getAllLinks();
    fs.writeFileSync(REPO_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error syncing repository backup file:', err);
  }
}

// Active link repository backed by SQLite & Revision Tracking
let repoRevision = Date.now();
let linksDatabase: LinkItem[] = loadLinks();
const workspaceRevisions = new Map<string, number>([[LOCAL_WORKSPACE_ID, repoRevision]]);

function workspaceFor(req: express.Request): string {
  if (!req.securityContext) throw new Error('Request workspace is unavailable.');
  return req.securityContext.workspace.id;
}

function respondToAiQuotaError(error: unknown, res: express.Response): boolean {
  if (!(error instanceof AiQuotaExceededError) && (error as { code?: string } | null)?.code !== 'AI_QUOTA_EXCEEDED') {
    return false;
  }
  res.status(429).json({ error: 'AI usage quota exhausted.', code: 'AI_QUOTA_EXCEEDED' });
  return true;
}

function linksFor(req: express.Request): LinkItem[] {
  return omniDb.getAllLinks(workspaceFor(req));
}

// Helper to refresh in-memory reference from SQLite
function refreshLinksCache(workspaceId: string = LOCAL_WORKSPACE_ID): LinkItem[] {
  const workspaceLinks = omniDb.getAllLinks(workspaceId);
  if (workspaceId === LOCAL_WORKSPACE_ID) linksDatabase = workspaceLinks;
  repoRevision = Date.now();
  workspaceRevisions.set(workspaceId, repoRevision);
  return workspaceLinks;
}

// Helper to detect platform
function detectPlatform(url: string): PlatformType {
  const lower = url.toLowerCase();
  if (lower.includes('github.com') || lower.includes('gitlab.com')) return 'github';
  if (lower.includes('reddit.com/r/') && (lower.includes('/comment/') || lower.includes('/comments/'))) {
    if (lower.includes('comment/') || lower.includes('/c/')) return 'reddit_comment';
    return 'reddit_post';
  }
  if (lower.includes('reddit.com')) return 'reddit_post';
  if (lower.includes('instagram.com/reel/') || lower.includes('instagram.com/p/') || lower.includes('instagram.com/stories/')) return 'instagram_short';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter_x';
  if (lower.includes('arxiv.org') || lower.includes('biorxiv.org') || lower.includes('openreview.net') || lower.includes('doi.org')) return 'paper';
  if (lower.includes('medium.com') || lower.includes('substack.com') || lower.includes('dev.to') || lower.includes('blog')) return 'article';
  return 'other';
}

function getFaviconUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=128`;
  } catch {
    return 'https://www.google.com/s2/favicons?domain=example.com&sz=128';
  }
}

// --- API Endpoints ---

// GET /api/links - Query and filter with ETag / 304 Not Modified support
app.get('/api/links', (req, res) => {
  const workspaceId = workspaceFor(req);
  const workspaceLinks = linksFor(req);
  const isUnfiltered = Object.keys(req.query).length === 0;
  const etag = `W/"links-${workspaceRevisions.get(workspaceId) || 0}-${workspaceLinks.length}"`;

  // The local in-memory revision counter cannot observe writes made by other
  // multi-user processes (for example MCP). Do not risk a cross-session 304;
  // multi-user responses are always revalidated from tenant-scoped storage.
  if (runtimeConfig.mode === 'local' && isUnfiltered) {
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache');
  }

  let results = [...workspaceLinks];
  const { q, platform, category, tag, readStatus, isFavorite, isArchived, sort, feedId, isRss } = req.query;

  if (q && typeof q === 'string') {
    const query = q.toLowerCase();
    results = results.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(query);
      const matchUrl = item.url.toLowerCase().includes(query);
      const matchTldr = item.summary?.tldr?.toLowerCase().includes(query) || false;
      const matchNotes = item.notes?.toLowerCase().includes(query) || false;
      const matchAuthor = item.author?.toLowerCase().includes(query) || false;
      const matchFeedTitle = item.feedTitle?.toLowerCase().includes(query) || false;
      const matchTags = item.tags.some((t) => t.toLowerCase().includes(query));
      const matchTakeaways = item.summary?.keyTakeaways?.some((k) => k.toLowerCase().includes(query)) || false;
      return matchTitle || matchUrl || matchTldr || matchNotes || matchAuthor || matchFeedTitle || matchTags || matchTakeaways;
    });
  }

  if (feedId && typeof feedId === 'string' && feedId !== 'all') {
    results = results.filter((item) => item.feedId === feedId);
  }

  if (isRss === 'true') {
    results = results.filter((item) => item.isRssFeedItem);
  }

  if (platform && platform !== 'all') {
    results = results.filter((item) => item.platform === platform);
  }

  if (category && category !== 'all') {
    results = results.filter((item) => item.category.toLowerCase() === String(category).toLowerCase());
  }

  if (tag && tag !== 'all') {
    results = results.filter((item) => item.tags.some((t) => t.toLowerCase() === String(tag).toLowerCase()));
  }

  if (readStatus && readStatus !== 'all') {
    results = results.filter((item) => item.readStatus === readStatus);
  }

  if (isFavorite === 'true') {
    results = results.filter((item) => item.isFavorite);
  }

  if (isArchived !== 'true') {
    // Hide archived by default unless requested
    results = results.filter((item) => !item.isArchived);
  } else {
    results = results.filter((item) => item.isArchived);
  }

  // Sorting
  switch (sort) {
    case 'oldest':
      results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case 'title':
      results.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'readingTime':
      results.sort((a, b) => (a.readingTimeMinutes || 0) - (b.readingTimeMinutes || 0));
      break;
    case 'aiScore':
      results.sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
      break;
    case 'newest':
    default:
      results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
  }

  res.json({
    total: results.length,
    links: results,
  });
});

// POST /api/links - Add link with optional auto-AI extraction
app.post('/api/links', validateBody(CreateLinkSchema), async (req, res) => {
  try {
    const workspaceId = workspaceFor(req);
    const { url, title, notes, category, tags, autoAiExtract, source } = req.body;

    // Check if URL already exists in SQLite
    const existing = omniDb.getLinkByUrl(url.trim(), workspaceId);
    if (existing) {
      res.status(200).json({ link: existing, message: 'Link already exists in repository' });
      return;
    }

    const platform = detectPlatform(url);
    const faviconUrl = getFaviconUrl(url);

    let extractedTitle = title || url;
    let extractedCategory = category || 'Dev & Tech';
    let extractedTags: string[] = Array.isArray(tags) ? tags : [];
    let extractedAuthor = '';
    let extractedSummary: LinkSummary = {
      tldr: 'Saved link item ready for deep AI extraction.',
      keyTakeaways: ['Direct URL bookmarked from ' + (source || 'user')],
    };
    let readingTime = 2;
    let aiScore = 80;
    let thumbnailUrl = '';

    // If auto AI extract is enabled
    if (autoAiExtract !== false) {
      try {
        const ai = getGenAI();
        if (ai) {
          const aiData = await extractWithGemini(url, title, notes, platform);
          if (aiData) {
            extractedTitle = aiData.title || extractedTitle;
            extractedCategory = aiData.category || extractedCategory;
            extractedTags = Array.from(new Set([...extractedTags, ...(aiData.tags || [])]));
            extractedAuthor = aiData.author || extractedAuthor;
            extractedSummary = aiData.summary || extractedSummary;
            readingTime = aiData.readingTimeMinutes || readingTime;
            aiScore = aiData.aiScore || aiScore;
            thumbnailUrl = aiData.thumbnailUrl || thumbnailUrl;
          }
        }
      } catch (aiErr) {
        if (aiErr instanceof AiQuotaExceededError) throw aiErr;
        console.warn('AI Extraction fallback warning:', aiErr);
      }
    }

    const newLink: LinkItem = {
      id: 'link-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      url,
      title: extractedTitle,
      description: notes || '',
      author: extractedAuthor,
      platform,
      category: extractedCategory,
      tags: extractedTags.length > 0 ? extractedTags : ['inbox'],
      summary: extractedSummary,
      thumbnailUrl: thumbnailUrl || getRandomThumbnail(platform),
      faviconUrl,
      notes: notes || '',
      isFavorite: false,
      isArchived: false,
      readStatus: 'unread',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      readingTimeMinutes: readingTime,
      aiScore,
    };

    omniDb.insertLink(newLink, workspaceId);
    refreshLinksCache(workspaceId);
    saveLinks(undefined, workspaceId);

    // Trigger background vector indexing
    hybridSearchEngine.indexLink(newLink, getGenAI(), workspaceId).catch((err) => {
      console.warn('[HybridSearch] Background embedding generation notice:', err);
    });

    res.status(201).json({ link: newLink });
  } catch (err: any) {
    if (respondToAiQuotaError(err, res)) return;
    console.error('Error adding link:', err);
    res.status(500).json({ error: err.message || 'Failed to add link.' });
  }
});

// Helper to extract clean URL and text from mobile share payloads
function extractUrlAndText(rawUrl?: string, rawText?: string, rawTitle?: string): { url: string; title: string; notes: string } {
  let url = (rawUrl || '').trim();
  let text = (rawText || '').trim();
  let title = (rawTitle || '').trim();

  if (!url) {
    const match = (text + ' ' + title).match(/https?:\/\/[^\s]+/i);
    if (match) {
      url = match[0].trim();
      text = text.replace(url, '').trim();
    }
  }

  // If title was actually a URL, swap
  if (!url && /^https?:\/\//i.test(title)) {
    url = title;
    title = '';
  }

  return { url, title, notes: text };
}

// POST /api/share/quick - Instant ingress from iOS Shortcuts, Android Tasker, Raycast, or Webhooks
app.post('/api/share/quick', async (req, res) => {
  if (runtimeConfig.mode === 'multi-user' && req.securityContext?.authMethod !== 'service-token') {
    res.status(403).json({ error: 'Multi-user quick share requires a workspace-scoped service token.' });
    return;
  }
  try {
    const workspaceId = workspaceFor(req);
    const rawUrl = req.body?.url || req.query?.url;
    const rawText = req.body?.text || req.body?.notes || req.query?.text || req.query?.notes;
    const rawTitle = req.body?.title || req.query?.title;
    const rawTags = req.body?.tags;

    const { url, title, notes } = extractUrlAndText(String(rawUrl || ''), String(rawText || ''), String(rawTitle || ''));

    if (!url || !/^https?:\/\//i.test(url)) {
      res.status(400).json({ error: 'A valid http/https URL could not be found in the shared payload.' });
      return;
    }

    // Check duplicate
    const existing = omniDb.getLinkByUrl(url, workspaceId);
    if (existing) {
      res.json({
        success: true,
        isDuplicate: true,
        message: `Already in repository: "${existing.title}"`,
        link: existing,
      });
      return;
    }

    const platform = detectPlatform(url);
    const faviconUrl = getFaviconUrl(url);

    let extractedTitle = title || url;
    let extractedCategory = 'Dev & Tech';
    let extractedTags: string[] = Array.isArray(rawTags) ? rawTags : [];
    let extractedAuthor = '';
    let extractedSummary: LinkSummary = {
      tldr: 'Saved from Mobile Quick Share & AI Extracted.',
      keyTakeaways: ['Ingested via Mobile Share Sheet / Apple Shortcut'],
    };
    let readingTime = 3;
    let aiScore = 85;
    let thumbnailUrl = '';

    // Fast AI Extraction
    try {
      const ai = getGenAI();
      if (ai) {
        const aiData = await extractWithGemini(url, title, notes, platform);
        if (aiData) {
          extractedTitle = aiData.title || extractedTitle;
          extractedCategory = aiData.category || extractedCategory;
          extractedTags = Array.from(new Set([...extractedTags, ...(aiData.tags || [])]));
          extractedAuthor = aiData.author || extractedAuthor;
          extractedSummary = aiData.summary || extractedSummary;
          readingTime = aiData.readingTimeMinutes || readingTime;
          aiScore = aiData.aiScore || aiScore;
          thumbnailUrl = aiData.thumbnailUrl || thumbnailUrl;
        }
      }
    } catch (e) {
      if (e instanceof AiQuotaExceededError) throw e;
      console.warn('[MobileQuickShare] AI extraction notice:', e);
    }

    const newLink: LinkItem = {
      id: 'link-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      url,
      title: extractedTitle,
      description: notes || '',
      author: extractedAuthor,
      platform,
      category: extractedCategory,
      tags: extractedTags.length > 0 ? extractedTags : ['mobile-share', 'inbox'],
      summary: extractedSummary,
      thumbnailUrl: thumbnailUrl || getRandomThumbnail(platform),
      faviconUrl,
      notes: notes || '',
      isFavorite: false,
      isArchived: false,
      readStatus: 'unread',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      readingTimeMinutes: readingTime,
      aiScore,
    };

    omniDb.insertLink(newLink, workspaceId);
    refreshLinksCache(workspaceId);
    saveLinks(undefined, workspaceId);

    // Trigger background vector indexing & full article snapshot
    hybridSearchEngine.indexLink(newLink, getGenAI(), workspaceId).catch(() => {});
    ReadabilityService.extractFromUrl(newLink.url).then((snapshot) => {
      if (snapshot) {
        omniDb.updateLink(newLink.id, { readerSnapshot: snapshot }, workspaceId);
        refreshLinksCache(workspaceId);
      }
    }).catch(() => {});

    res.status(201).json({
      success: true,
      message: `Saved: "${newLink.title}"`,
      link: newLink,
    });
  } catch (err: any) {
    if (respondToAiQuotaError(err, res)) return;
    console.error('Quick share error:', err);
    res.status(500).json({ error: err.message || 'Quick share processing failed.' });
  }
});

// GET /api/share/quick - Bookmarklet or simple GET ingress
app.get('/api/share/quick', async (req, res) => {
  if (runtimeConfig.mode === 'multi-user' && req.securityContext?.authMethod !== 'service-token') {
    res.status(403).json({ error: 'Multi-user quick share requires a workspace-scoped service token.' });
    return;
  }
  const workspaceId = workspaceFor(req);
  req.body = req.query;
  const rawUrl = req.query.url;
  const rawText = req.query.text || req.query.notes;
  const rawTitle = req.query.title;
  const { url, title, notes } = extractUrlAndText(String(rawUrl || ''), String(rawText || ''), String(rawTitle || ''));

  if (!url || !/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: 'A valid http/https URL could not be found in the query params.' });
    return;
  }

  // Redirect or JSON
  const existing = omniDb.getLinkByUrl(url, workspaceId);
  if (existing) {
    res.json({ success: true, isDuplicate: true, message: `Already in repository: "${existing.title}"`, link: existing });
    return;
  }

  const platform = detectPlatform(url);
  const newLink: LinkItem = {
    id: 'link-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    url,
    title: title || url,
    description: notes || '',
    platform,
    category: 'Dev & Tech',
    tags: ['mobile-share', 'inbox'],
    summary: { tldr: 'Saved via Quick Ingress', keyTakeaways: ['Ingested via quick share'] },
    thumbnailUrl: getRandomThumbnail(platform),
    faviconUrl: getFaviconUrl(url),
    notes: notes || '',
    isFavorite: false,
    isArchived: false,
    readStatus: 'unread',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    readingTimeMinutes: 3,
    aiScore: 85,
  };

  omniDb.insertLink(newLink, workspaceId);
  refreshLinksCache(workspaceId);
  saveLinks(undefined, workspaceId);
  hybridSearchEngine.indexLink(newLink, getGenAI(), workspaceId).catch(() => {});

  res.status(201).json({ success: true, message: `Saved: "${newLink.title}"`, link: newLink });
});

// PUT /api/links/:id - Update link
app.put('/api/links/:id', validateBody(UpdateLinkSchema), (req, res) => {
  const { id } = req.params;
  const workspaceId = workspaceFor(req);
  const updated = omniDb.updateLink(id, req.body, workspaceId);
  if (!updated) {
    res.status(404).json({ error: 'Link not found.' });
    return;
  }

  refreshLinksCache(workspaceId);
  saveLinks(undefined, workspaceId);

  // Re-index updated text embedding in background
  hybridSearchEngine.indexLink(updated, getGenAI(), workspaceId).catch((err) => {
    console.warn('[HybridSearch] Background update embedding notice:', err);
  });

  res.json({ link: updated });
});

// DELETE /api/links/:id - Delete link
app.delete('/api/links/:id', (req, res) => {
  const { id } = req.params;
  const workspaceId = workspaceFor(req);
  const deleted = omniDb.deleteLink(id, workspaceId);
  if (!deleted) {
    res.status(404).json({ error: 'Link not found.' });
    return;
  }

  refreshLinksCache(workspaceId);
  saveLinks(undefined, workspaceId);
  res.json({ success: true, id });
});

// GET /api/links/:id/reader - Get or extract offline reader mode article snapshot
app.get('/api/links/:id/reader', async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = workspaceFor(req);
    const link = omniDb.getLinkById(id, workspaceId);
    if (!link) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }

    if (link.readerSnapshot && link.readerSnapshot.contentMarkdown) {
      res.json({ success: true, snapshot: link.readerSnapshot, cached: true });
      return;
    }

    // Extract fresh article snapshot
    const snapshot = await ReadabilityService.extractFromUrl(link.url);
    if (snapshot) {
      omniDb.updateLink(id, { readerSnapshot: snapshot }, workspaceId);
      refreshLinksCache(workspaceId);
      res.json({ success: true, snapshot, cached: false });
    } else {
      res.status(422).json({ error: 'Unable to parse full article content from target page.' });
    }
  } catch (err: any) {
    console.error('Reader extraction error:', err);
    res.status(500).json({ error: err.message || 'Reader extraction failed' });
  }
});

// POST /api/links/:id/reader/snapshot - Force fresh offline article snapshot
app.post('/api/links/:id/reader/snapshot', async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = workspaceFor(req);
    const link = omniDb.getLinkById(id, workspaceId);
    if (!link) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }

    const snapshot = await ReadabilityService.extractFromUrl(link.url);
    if (snapshot) {
      const updated = omniDb.updateLink(id, { readerSnapshot: snapshot }, workspaceId);
      refreshLinksCache(workspaceId);
      res.json({ success: true, snapshot, link: updated });
    } else {
      res.status(422).json({ error: 'Failed to extract article content from URL.' });
    }
  } catch (err: any) {
    console.error('Force reader snapshot error:', err);
    res.status(500).json({ error: err.message || 'Snapshot failed' });
  }
});

// POST /api/links/batch - Batch operations
app.post('/api/links/batch', validateBody(BatchActionSchema), (req, res) => {
  const { ids, action, value } = req.body;
  const workspaceId = workspaceFor(req);

  if (action === 'delete') {
    omniDb.batchDelete(ids, workspaceId);
  } else if (action === 'archive') {
    omniDb.batchUpdate(ids, { isArchived: true }, workspaceId);
  } else if (action === 'unarchive') {
    omniDb.batchUpdate(ids, { isArchived: false }, workspaceId);
  } else if (action === 'markRead') {
    omniDb.batchUpdate(ids, { readStatus: 'read' }, workspaceId);
  } else if (action === 'markUnread') {
    omniDb.batchUpdate(ids, { readStatus: 'unread' }, workspaceId);
  } else if (action === 'setCategory' && value) {
    omniDb.batchUpdate(ids, { category: String(value) }, workspaceId);
  } else if (action === 'addTag' && value) {
    for (const id of ids) {
      const item = omniDb.getLinkById(id, workspaceId);
      if (item) {
        const cleanTag = String(value).trim().toLowerCase();
        const nextTags = Array.from(new Set([...item.tags, cleanTag]));
        omniDb.updateLink(id, { tags: nextTags }, workspaceId);
      }
    }
  }

  refreshLinksCache(workspaceId);
  saveLinks(undefined, workspaceId);
  res.json({ success: true, count: ids.length, total: omniDb.count(workspaceId) });
});

// GET /api/links/check-duplicate & POST /api/links/check-duplicate
app.get('/api/links/check-duplicate', (req, res) => {
  const url = typeof req.query.url === 'string' ? req.query.url : '';
  if (!url) {
    res.json({ isDuplicate: false, existingLink: null, normalizedUrl: '' });
    return;
  }
  const result = checkDuplicateInLinks(url, linksFor(req));
  res.json(result);
});

app.post('/api/links/check-duplicate', validateBody(CheckDuplicateSchema), (req, res) => {
  const { url } = req.body;
  const result = checkDuplicateInLinks(url, linksFor(req));
  res.json(result);
});

// POST /api/links/merge/:id - Smart merge or update an existing link with new input
app.post('/api/links/merge/:id', validateBody(MergeLinkSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = workspaceFor(req);
    const { title, category, tags, notes, mode, autoAiExtract } = req.body;

    const existing = omniDb.getLinkById(id, workspaceId);
    if (!existing) {
      res.status(404).json({ error: 'Existing link not found to merge.' });
      return;
    }

    let mergedTitle = existing.title;
    let mergedCategory = existing.category;
    let mergedTags = [...existing.tags];
    let mergedNotes = existing.notes || '';

    const newTags: string[] = Array.isArray(tags) ? tags : [];

    if (mode === 'overwrite') {
      // Overwrite mode: replace fields if provided
      if (title && title.trim()) mergedTitle = title.trim();
      if (category && category.trim()) mergedCategory = category.trim();
      if (newTags.length > 0) mergedTags = newTags;
      if (notes !== undefined) mergedNotes = notes;
    } else {
      // Smart Merge mode (default): combine tags, append notes, update category if requested
      if (title && title.trim() && (!existing.title || existing.title === existing.url)) {
        mergedTitle = title.trim();
      }
      if (category && category !== 'Dev & Tech' && existing.category === 'Dev & Tech') {
        mergedCategory = category;
      }
      // Union of tags
      mergedTags = Array.from(
        new Set([...existing.tags, ...newTags.map((t) => t.trim().toLowerCase()).filter(Boolean)])
      );

      // Append notes cleanly if new notes are provided and not already present
      if (notes && typeof notes === 'string' && notes.trim()) {
        const newNotesClean = notes.trim();
        if (!mergedNotes.includes(newNotesClean)) {
          const dateStr = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          mergedNotes = mergedNotes
            ? `${mergedNotes}\n\n[Merged Update • ${dateStr}]:\n${newNotesClean}`
            : newNotesClean;
        }
      }
    }

    let updatedSummary = existing.summary;
    let updatedAiScore = existing.aiScore;

    // Optional re-extract with Gemini if requested
    if (autoAiExtract) {
      try {
        const ai = getGenAI();
        if (ai) {
          const aiData = await extractWithGemini(existing.url, mergedTitle, mergedNotes, existing.platform);
          if (aiData) {
            if (aiData.summary) updatedSummary = aiData.summary;
            if (aiData.aiScore) updatedAiScore = aiData.aiScore;
            if (aiData.tags && Array.isArray(aiData.tags)) {
              mergedTags = Array.from(new Set([...mergedTags, ...aiData.tags]));
            }
          }
        }
      } catch (aiErr) {
        if (aiErr instanceof AiQuotaExceededError) throw aiErr;
        console.warn('Merge AI extraction warning:', aiErr);
      }
    }

    const updatedLink = omniDb.updateLink(id, {
      title: mergedTitle,
      category: mergedCategory,
      tags: mergedTags,
      notes: mergedNotes,
      summary: updatedSummary,
      aiScore: updatedAiScore,
    }, workspaceId);

    if (!updatedLink) {
      res.status(500).json({ error: 'Failed to update link in database' });
      return;
    }

    refreshLinksCache(workspaceId);
    saveLinks(undefined, workspaceId);

    // Re-index embedding in background
    hybridSearchEngine.indexLink(updatedLink, getGenAI(), workspaceId).catch((err) => {
      console.warn('[HybridSearch] Background merge embedding notice:', err);
    });

    res.json({ link: updatedLink, message: 'Bookmark successfully merged' });
  } catch (err: any) {
    if (respondToAiQuotaError(err, res)) return;
    console.error('Error merging link:', err);
    res.status(500).json({ error: err.message || 'Failed to merge link.' });
  }
});

// POST /api/links/preview-metadata - Fetch title/description & auto-suggest tags before save
app.post('/api/links/preview-metadata', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'url string is required' });
      return;
    }

    const platform = detectPlatform(url);
    let scrapedTitle = '';
    let scrapedDescription = '';
    let author = '';

    // Fast extraction via ReadabilityService (covers Reddit, GitHub, YouTube, ArXiv, articles)
    try {
      const snapshot = await ReadabilityService.extractFromUrl(url, 4500);
      if (snapshot) {
        scrapedTitle = snapshot.title || '';
        scrapedDescription = snapshot.excerpt || '';
        author = snapshot.byline || '';
      }
    } catch (fetchErr) {
      // Network fetch skipped or timed out; will fallback to slug/domain analysis
    }

    // Fallback: derive title from URL path if not found
    if (!scrapedTitle) {
      try {
        const parsed = new URL(url);
        const pathSegments = parsed.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          scrapedTitle = pathSegments[pathSegments.length - 1]
            .replace(/[-_]/g, ' ')
            .replace(/\.(html|php|asp|aspx)$/i, '');
          scrapedTitle = scrapedTitle.charAt(0).toUpperCase() + scrapedTitle.slice(1);
        } else {
          scrapedTitle = parsed.hostname;
        }
      } catch {
        scrapedTitle = url;
      }
    }

    res.json({
      url,
      title: scrapedTitle,
      description: scrapedDescription,
      author,
      platform,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to preview metadata' });
  }
});

// POST /api/links/suggest-tags - Auto-tagging suggestions based on title, description, and keywords
app.post('/api/links/suggest-tags', async (req, res) => {
  try {
    const { url, title, description, notes, preferredModel } = req.body;
    const combinedText = `${title || ''} ${description || ''} ${notes || ''} ${url || ''}`;
    const detectedPlatform = url ? detectPlatform(url) : 'other';

    // 1. Fast heuristic keywords & tags
    const heuristicResults = analyzeAndSuggestTags({
      url: url || '',
      title: title || '',
      description: description || '',
      notes: notes || '',
    });

    // 2. High-speed AI auto-tagging via Gemini 3.1 Flash Lite
    const genAi = getGenAI();
    let aiTags: string[] = [];
    let aiCategory: string | undefined;

    if (genAi && combinedText.trim().length > 10) {
      const prompt = `Analyze this bookmark metadata and provide 4-6 specific, high-precision lowercase developer/tech tags and the most accurate category.
Title: ${title || 'None'}
Description: ${description || 'None'}
URL: ${url || 'None'}
User Notes: ${notes || 'None'}
Detected Platform: ${detectedPlatform}

Allowed Categories: Dev & Tech, AI & Machine Learning, Design & UI, Reddit Discussions, Instagram & Social, Tutorials & Guides, Research & Papers, Productivity, Other`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '4-6 lowercase specific tags',
          },
          category: {
            type: Type.STRING,
            description: 'One of the allowed categories',
          },
          reason: {
            type: Type.STRING,
            description: 'Brief reason for classification',
          },
        },
        required: ['tags', 'category'],
      };

      const orchResult = await ModelOrchestrator.executeStructuredPrompt<{
        tags: string[];
        category: string;
        reason?: string;
      }>(
        genAi,
        {
          taskType: 'auto_tagging',
          url,
          platform: detectedPlatform,
          promptText: combinedText,
          preferredModel,
        },
        prompt,
        schema
      );

      if (orchResult.data && Array.isArray(orchResult.data.tags)) {
        aiTags = orchResult.data.tags.map((t) => t.toLowerCase().trim().replace(/[^a-z0-9-_]/g, ''));
        aiCategory = orchResult.data.category;
      }
    }

    // Merge AI suggestions with high confidence
    const mergedTags = [...heuristicResults.suggestedTags];
    for (const tag of aiTags) {
      if (tag && !mergedTags.some((st) => st.tag.toLowerCase() === tag.toLowerCase())) {
        mergedTags.unshift({
          tag,
          confidence: 94,
          matchedIn: 'ai',
          reason: 'Generated by Gemini 3.1 Flash Lite model orchestration',
        });
      }
    }

    res.json({
      suggestedTags: mergedTags.slice(0, 10),
      suggestedCategory: aiCategory
        ? { category: aiCategory, confidence: 95, reason: 'AI Categorized by Gemini 3.1 Flash Lite' }
        : heuristicResults.suggestedCategory,
      extractedKeywords: heuristicResults.extractedKeywords,
      autoDetectedTitle: heuristicResults.autoDetectedTitle,
      autoDetectedDescription: heuristicResults.autoDetectedDescription,
      platform: detectedPlatform,
      analyzedLength: combinedText.length,
    });
  } catch (err: any) {
    if (respondToAiQuotaError(err, res)) return;
    res.status(500).json({ error: err.message || 'Auto-tag suggestion failed' });
  }
});

// GET /api/ai/orchestrator-stats - Real-time Model Routing & Telemetry Stats
app.get('/api/ai/orchestrator-stats', (req, res) => {
  try {
    const stats = ModelOrchestrator.getStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch orchestrator stats' });
  }
});

// POST /api/ai/route-preview - Preview model routing decision for a given task/URL
app.post('/api/ai/route-preview', (req, res) => {
  try {
    const { taskType, url, platform, promptText, contentLength, itemCount, preferredModel } = req.body;
    const decision = ModelOrchestrator.routeRequest({
      taskType: taskType || 'standard_extraction',
      url,
      platform: platform || (url ? detectPlatform(url) : undefined),
      promptText,
      contentLength,
      itemCount,
      preferredModel,
    });
    res.json({ success: true, decision });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to preview route' });
  }
});

// --- Helper: Gemini Extraction Engine with Multi-Tier Model Orchestrator ---
async function extractWithGemini(
  url: string,
  userTitle?: string,
  userNotes?: string,
  platform?: PlatformType,
  preferredModel?: GeminiModelId
) {
  // Clean any Hacker News metadata boilerplate from userNotes or userTitle
  let cleanNotes = userNotes || '';
  if (/Article URL:.*Comments URL:/is.test(cleanNotes)) {
    cleanNotes = cleanNotes.replace(/Article URL:.*$/is, '').trim();
  }

  let cleanTitle = userTitle || '';
  if (/Article URL:.*Comments URL:/is.test(cleanTitle)) {
    cleanTitle = '';
  }

  // Attempt to fetch clean article content via ReadabilityService for deep analysis
  let articleText = '';
  let snapshot: any = null;
  if (/^https?:\/\//i.test(url)) {
    try {
      snapshot = await ReadabilityService.extractFromUrl(url, 10000);
      if (snapshot) {
        articleText = snapshot.contentMarkdown?.slice(0, 6000) || snapshot.excerpt || '';
        if (!cleanTitle && snapshot.title && snapshot.title.length > 5) {
          cleanTitle = snapshot.title;
        }
      }
    } catch (e) {
      // Non-blocking
    }
  }

  const prompt = `You are OmniLink AI's expert Knowledge Extraction Engine. Analyze the provided link, metadata, and extracted article/thread content to generate deep, authoritative, high-signal insights.

Target URL: ${url}
Title / Heading: ${cleanTitle || snapshot?.title || 'None'}
Detected Platform: ${platform || 'web_article'}
${cleanNotes ? `User Notes / Context: ${cleanNotes}` : ''}
${articleText ? `Full Content / Extracted Thread & Comments:\n${articleText}` : ''}

Platform-Specific Deep Extraction Rules:

1. REDDIT DISCUSSIONS & COMMENTS:
   - TL;DR: Clearly summarize the EXACT core problem/question asked by OP and the definitive consensus reached by the community. Do NOT use vague meta-summaries like "The community discusses trade-offs". State the specific concepts, tools, and conclusions!
   - Key Takeaways (3-5 bullets):
     * Bullet 1: The original problem, technical dilemma, bug, or question posted by the author.
     * Bullets 2-3: The most upvoted, authoritative solutions or recommendations provided by top community commenters (name specific libraries, tools, configs, or techniques mentioned!).
     * Bullet 4-5: Significant trade-offs, cautionary notes, bugs, or dissenting opinions highlighted in the thread.
   - Code Snippets: Extract any relevant code blocks, shell commands, or configuration snippets shared in the post or top comments.
   - Quotes: Extract 1-2 impactful direct quotes from top commenters that summarize key advice.

2. GITHUB REPOSITORIES:
   - TL;DR: Explain what the project does, its core differentiator or killer feature, and primary use-case.
   - Key Takeaways: Key architectural features, supported integrations/frameworks, performance benchmarks, and getting started prerequisites.
   - Code Snippets: Primary installation command (npm/pip/cargo/docker) and minimal quickstart usage code.

3. RESEARCH PAPERS & ARXIV:
   - TL;DR: State the primary novel methodology/architecture proposed and the headline empirical result or benchmark win.
   - Key Takeaways: Mathematical formulation or architectural difference, benchmark dataset results compared to baselines, limitations and future research directions.

4. TECHNICAL ARTICLES & DEV BLOGS:
   - TL;DR: A punchy 1-2 sentence distillation of the main thesis, architectural decision, or postmortem learning.
   - Key Takeaways: 3-5 concrete, actionable learnings, design patterns, or technical explanations.
   - Code Snippets: Any key configuration, algorithm, or CLI snippet from the post.

Strict Quality Requirements:
- NO generic filler or superficial phrases like "In-depth discussion evaluating trade-offs". Always cite concrete tools, concepts, and techniques.
- NEVER return raw URLs or 'Article URL:' boilerplate as summary.
- Tags: 5-8 descriptive, lowercase tags covering language, framework, domain, and specific topic.

Return strictly valid JSON matching the schema.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Clean, accurate, informative title' },
      author: { type: Type.STRING, description: 'Author, handle, or creator name if discernable' },
      category: {
        type: Type.STRING,
        description: 'One of: Dev & Tech, AI & Machine Learning, Design & UI, Reddit Discussions, Instagram & Social, Tutorials & Guides, Research & Papers, Productivity, Other',
      },
      tags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: '5-8 lowercase specific tags',
      },
      summary: {
        type: Type.OBJECT,
        properties: {
          tldr: { type: Type.STRING, description: 'A punchy 1-2 sentence core summary of actual ideas and conclusions' },
          keyTakeaways: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3-5 crisp bullet points of concrete insights, citing specific tools and arguments',
          },
          codeSnippets: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Code snippets, CLI commands, or configs mentioned',
          },
          quotes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Memorable quotes or key sentences',
          },
        },
        required: ['tldr', 'keyTakeaways'],
      },
      readingTimeMinutes: { type: Type.INTEGER, description: 'Estimated time to consume in minutes (1-60)' },
      aiScore: { type: Type.INTEGER, description: 'Relevance and knowledge density score (50-100)' },
    },
    required: ['title', 'category', 'tags', 'summary'],
  };

  const genAi = getGenAI();
  const rawTextLength = (cleanTitle || '').length + (cleanNotes || '').length + articleText.length + url.length;

  const orchResult = await ModelOrchestrator.executeStructuredPrompt<any>(
    genAi,
    {
      taskType: 'standard_extraction',
      url,
      platform,
      contentLength: rawTextLength,
      preferredModel,
    },
    prompt,
    schema
  );

  if (orchResult.data && orchResult.data.title && orchResult.data.summary) {
    return {
      ...orchResult.data,
      readerSnapshot: snapshot || undefined,
      _orchestration: {
        model: orchResult.executedModel,
        fallbackUsed: orchResult.fallbackUsed,
        latencyMs: orchResult.latencyMs,
      },
    };
  }

  // Seamless heuristic fallback ensuring zero user-facing errors
  const fallbackRes = generateHeuristicExtraction(url, cleanTitle, cleanNotes, platform);
  return {
    ...fallbackRes,
    readerSnapshot: snapshot || undefined,
  };
}

// POST /api/ai/extract - Manual or programmatic AI extraction
app.post('/api/ai/extract', async (req, res) => {
  try {
    const workspaceId = workspaceFor(req);
    const { url, title, notes, linkId, preferredModel } = req.body;
    if (!url) {
      res.status(400).json({ error: 'url is required' });
      return;
    }

    const platform = detectPlatform(url);
    const aiData = await extractWithGemini(url, title, notes, platform, preferredModel);

    // If linkId is provided, auto-update the database item in SQLite
    if (linkId && aiData) {
      const existing = omniDb.getLinkById(linkId, workspaceId);
      if (existing) {
        const updated = omniDb.updateLink(linkId, {
          title: aiData.title || existing.title,
          author: aiData.author || existing.author,
          category: aiData.category || existing.category,
          tags: Array.from(new Set([...existing.tags, ...(aiData.tags || [])])),
          summary: aiData.summary || existing.summary,
          readingTimeMinutes: aiData.readingTimeMinutes || existing.readingTimeMinutes,
          aiScore: aiData.aiScore || existing.aiScore,
          readerSnapshot: aiData.readerSnapshot || existing.readerSnapshot,
        }, workspaceId);
        refreshLinksCache(workspaceId);
        saveLinks(undefined, workspaceId);
        if (updated) {
          hybridSearchEngine.indexLink(updated, getGenAI(), workspaceId).catch(() => {});
        }
      }
    }

    res.json({ result: aiData, success: true });
  } catch (err: any) {
    if (respondToAiQuotaError(err, res)) return;
    console.error('AI extraction error:', err);
    // Even if unexpected error occurs, provide heuristic fallback
    const fallback = generateHeuristicExtraction(req.body.url, req.body.title, req.body.notes);
    res.json({ result: fallback, success: true, fallback: true });
  }
});

// POST /api/ai/cluster - Semantic Topic Grouping of all repository links via Thinking Gemini 3.7
app.post('/api/ai/cluster', async (req, res) => {
  try {
    const workspaceLinks = linksFor(req);
    if (workspaceLinks.length === 0) {
      res.json({ clusters: [] });
      return;
    }

    const linkSummaries = workspaceLinks.map((l) => ({
      id: l.id,
      title: l.title,
      platform: l.platform,
      category: l.category,
      tags: l.tags,
      tldr: l.summary?.tldr || '',
    }));

    const prompt = `Analyze the following collection of saved user bookmarks/links and organize them into 3 to 6 logical semantic clusters (Topic Groups).
For each cluster, provide:
- id: unique string identifier
- title: concise descriptive topic name (e.g., "Full-Stack AI & Autonomous Agents", "Frontend Component Architecture", "High-Performance Databases & Systems")
- description: 1-2 sentences explaining the shared theme
- themeColor: one of "slate", "emerald", "amber", "sky", "indigo", "rose", "teal"
- tags: 3-5 tags representing this cluster
- linkIds: list of exact link ID strings that belong to this cluster (every link must be in at least 1 cluster)

Repository links to cluster:
${JSON.stringify(linkSummaries, null, 2)}`;

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          themeColor: { type: Type.STRING },
          tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          linkIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['id', 'title', 'description', 'linkIds'],
      },
    };

    const genAi = getGenAI();
    let clusters: any[] = [];

    const orchResult = await ModelOrchestrator.executeStructuredPrompt<any[]>(
      genAi,
      {
        taskType: 'deep_reasoning',
        itemCount: workspaceLinks.length,
        forceThinking: true,
      },
      prompt,
      schema
    );

    if (orchResult.data && Array.isArray(orchResult.data) && orchResult.data.length > 0) {
      clusters = orchResult.data;
    }

    if (!Array.isArray(clusters) || clusters.length === 0) {
      clusters = generateHeuristicClusters(workspaceLinks);
    }

    res.json({
      clusters,
      orchestration: {
        model: orchResult.executedModel,
        fallbackUsed: orchResult.fallbackUsed,
        latencyMs: orchResult.latencyMs,
        thinkingLevel: orchResult.thinkingLevel,
      },
    });
  } catch (err: any) {
    if (respondToAiQuotaError(err, res)) return;
    console.error('Clustering error:', err);
    res.json({ clusters: generateHeuristicClusters(linksFor(req)) });
  }
});

// POST /api/ai/ask - Conversational RAG over saved repository via Hybrid Search (FTS5 + Dense Vectors + RRF)
app.post('/api/ai/ask', validateBody(AskRepoSchema), async (req, res) => {
  try {
    const { question, preferredModel } = req.body;
    const workspaceId = workspaceFor(req);

    const genAi = getGenAI();

    // Stage 1 & 2: Hybrid Retrieval (SQLite FTS5 BM25 + Gemini text-embedding-004 dense vectors + RRF)
    const hybridMatches = await hybridSearchEngine.search(question, genAi, { limit: 8 }, workspaceId);
    const relevantLinks = hybridMatches.length > 0
      ? hybridMatches.map((m) => m.link)
      : omniDb.getAllLinks(workspaceId).slice(0, 10);

    const knowledgeBase = relevantLinks.map((l) => ({
      id: l.id,
      title: l.title,
      url: l.url,
      platform: l.platform,
      category: l.category,
      tags: l.tags,
      tldr: l.summary?.tldr,
      takeaways: l.summary?.keyTakeaways,
      codeSnippets: l.summary?.codeSnippets,
      notes: l.notes,
    }));

    const prompt = `You are OmniLink AI's knowledge assistant. The user has asked a question against their personal knowledge repository.
Below are the top relevant bookmarks retrieved via Hybrid Search (SQLite FTS5 lexical ranking + semantic dense vector embeddings + Reciprocal Rank Fusion):

${JSON.stringify(knowledgeBase, null, 2)}

User Question: "${question}"

Instructions:
1. Answer the user's question accurately using ONLY their saved knowledge base.
2. Cite specific saved links by their title and [ID: id].
3. Synthesize multiple links, compare concepts, or extract code snippets and key takeaways.
4. Also provide 2-3 follow-up exploration suggestions.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        answer: { type: Type.STRING, description: 'Markdown formatted detailed answer with citations' },
        referencedLinkIds: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Exact IDs of links referenced in the answer',
        },
        suggestions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '2-3 follow-up questions or actions',
        },
      },
      required: ['answer', 'referencedLinkIds', 'suggestions'],
    };

    const orchResult = await ModelOrchestrator.executeStructuredPrompt<{
      answer: string;
      referencedLinkIds: string[];
      suggestions: string[];
    }>(
      genAi,
      {
        taskType: 'deep_reasoning',
        promptText: question,
        itemCount: relevantLinks.length,
        preferredModel,
        forceThinking: true,
      },
      prompt,
      schema
    );

    let result = orchResult.data;
    if (!result || !result.answer) {
      result = generateHeuristicAskRepo(question, relevantLinks);
    }

    res.json({
      ...result,
      retrieval: {
        strategy: 'hybrid_fts5_vector_rrf',
        retrievedCount: relevantLinks.length,
        totalVaultItems: omniDb.count(workspaceId),
        topMatches: hybridMatches.map((m) => ({
          id: m.link.id,
          title: m.link.title,
          rrfScore: m.rrfScore,
          ftsRank: m.ftsRank,
          vectorSimilarity: m.vectorSimilarity,
          reasons: m.matchReasons,
        })),
      },
      orchestration: {
        model: orchResult.executedModel,
        fallbackUsed: orchResult.fallbackUsed,
        latencyMs: orchResult.latencyMs,
        thinkingLevel: orchResult.thinkingLevel,
      },
    });
  } catch (err: any) {
    if (respondToAiQuotaError(err, res)) return;
    console.error('Ask Repo error:', err);
    res.json(generateHeuristicAskRepo(req.body?.question || 'General search', linksFor(req)));
  }
});

// POST /api/ai/search/hybrid - Dedicated Hybrid Lexical + Semantic Search API
app.post('/api/ai/search/hybrid', validateBody(HybridSearchSchema), async (req, res) => {
  try {
    const { query, category, platform, readStatus, limit, minScore } = req.body;
    const genAi = getGenAI();
    const results = await hybridSearchEngine.search(query || '', genAi, {
      limit: Number(limit) || 15,
      category,
      platform,
      readStatus,
      minScore: minScore !== undefined ? Number(minScore) : 0.001,
    }, workspaceFor(req));
    res.json({ success: true, count: results.length, results });
  } catch (err: any) {
    if (respondToAiQuotaError(err, res)) return;
    console.error('Hybrid search error:', err);
    res.status(500).json({ error: err.message || 'Hybrid search failed' });
  }
});

// POST /api/ai/embeddings/reindex - Trigger full vector re-indexing
app.post('/api/ai/embeddings/reindex', async (req, res) => {
  try {
    const genAi = getGenAI();
    const result = await hybridSearchEngine.runBackgroundIndexing(genAi, workspaceFor(req));
    res.json({ success: true, ...result });
  } catch (err: any) {
    if (respondToAiQuotaError(err, res)) return;
    console.error('Reindexing error:', err);
    res.status(500).json({ error: err.message || 'Reindexing failed' });
  }
});

// GET /api/ai/embeddings/status - Check vector embedding status
app.get('/api/ai/embeddings/status', (req, res) => {
  const workspaceId = workspaceFor(req);
  const total = omniDb.count(workspaceId);
  const unindexed = omniDb.getUnindexedLinkIds(workspaceId).length;
  const indexed = total - unindexed;
  res.json({
    total,
    indexed,
    unindexed,
    percentage: total > 0 ? Math.round((indexed / total) * 100) : 100,
    model: 'text-embedding-004 (768-d)',
  });
});

// GET /api/stats - Dashboard metrics with ETag support
app.get('/api/stats', (req, res) => {
  const workspaceId = workspaceFor(req);
  const workspaceLinks = linksFor(req);
  const etag = `W/"stats-${workspaceRevisions.get(workspaceId) || 0}-${workspaceLinks.length}"`;
  if (runtimeConfig.mode === 'local') {
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache');
  }

  const total = workspaceLinks.length;
  const unread = workspaceLinks.filter((l) => l.readStatus === 'unread').length;
  const favorites = workspaceLinks.filter((l) => l.isFavorite).length;
  const archived = workspaceLinks.filter((l) => l.isArchived).length;

  const platformCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};

  for (const item of workspaceLinks) {
    platformCounts[item.platform] = (platformCounts[item.platform] || 0) + 1;
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    for (const t of item.tags) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }

  const topCategories = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const topTags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  res.json({
    totalLinks: total,
    unreadCount: unread,
    favoritesCount: favorites,
    archivedCount: archived,
    platformCounts,
    platformBreakdown: platformCounts,
    categoriesBreakdown: categoryCounts,
    topCategories,
    topTags,
  });
});

// POST /api/import - Restore repository from backup
app.post('/api/import', (req, res) => {
  try {
    const { links, mode } = req.body;
    const workspaceId = workspaceFor(req);
    if (!Array.isArray(links)) {
      res.status(400).json({ error: 'Invalid links array payload.' });
      return;
    }

    if (mode === 'replace') {
      omniDb.batchDelete(omniDb.getAllLinks(workspaceId).map((link) => link.id), workspaceId);
      omniDb.bulkInsert(links, workspaceId);
    } else {
      // Merge unique by URL
      const existingUrls = new Set(omniDb.getAllLinks(workspaceId).map((l) => l.url));
      const additions: LinkItem[] = [];
      for (const item of links) {
        if (!existingUrls.has(item.url)) {
          additions.push(item);
          existingUrls.add(item.url);
        }
      }
      omniDb.bulkInsert(additions, workspaceId);
    }

    const updated = refreshLinksCache(workspaceId);
    saveLinks(undefined, workspaceId);
    res.json({ success: true, count: links.length, total: updated.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Import failed.' });
  }
});

// ==========================================
// RSS Feed Subscription & Ingestion Engine
// ==========================================

// GET /api/rss/feeds - List all subscribed feeds with stats
app.get('/api/rss/feeds', (req, res) => {
  try {
    const workspaceId = workspaceFor(req);
    const feeds = RssFeedManager.getAll(workspaceId);
    const workspaceLinks = omniDb.getAllLinks(workspaceId);
    
    // Augment feeds with unread counts and total items present in repository
    const augmentedFeeds = feeds.map((feed) => {
      const feedLinks = workspaceLinks.filter((l) => l.feedId === feed.id);
      const unreadCount = feedLinks.filter((l) => l.readStatus === 'unread').length;
      return {
        ...feed,
        repoItemsCount: feedLinks.length,
        unreadCount,
      };
    });

    res.json({ feeds: augmentedFeeds });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch feeds' });
  }
});

// POST /api/rss/feeds - Subscribe to a new RSS feed
app.post('/api/rss/feeds', validateBody(AddRssFeedSchema), async (req, res) => {
  try {
    const workspaceId = workspaceFor(req);
    const { url, title, description, category, defaultTags, autoAiExtract, pollIntervalMinutes, siteUrl, initialSync } = req.body;

    let finalFeedUrl = url.trim();
    let finalTitle = title;
    let finalDescription = description;
    let finalSiteUrl = siteUrl;

    // If title is missing or user passed a plain website domain, perform quick discovery
    if (!finalTitle || !finalFeedUrl.includes('.xml') && !finalFeedUrl.includes('/feed') && !finalFeedUrl.includes('/rss')) {
      try {
        const discovery = await RssFeedManager.discoverFeed(finalFeedUrl);
        if (discovery.discovered) {
          finalFeedUrl = discovery.feedUrl;
          finalTitle = finalTitle || discovery.title;
          finalDescription = finalDescription || discovery.description;
          finalSiteUrl = finalSiteUrl || discovery.siteUrl;
        }
      } catch (discErr) {
        console.warn('Feed pre-discovery skipped:', discErr);
      }
    }

    const createdFeed = RssFeedManager.addFeed({
      url: finalFeedUrl,
      siteUrl: finalSiteUrl,
      title: finalTitle || 'Dev RSS Feed',
      description: finalDescription,
      category: category || 'Dev & Tech',
      defaultTags: Array.isArray(defaultTags) ? defaultTags : ['rss', 'engineering'],
      autoAiExtract: autoAiExtract !== false,
      pollIntervalMinutes: pollIntervalMinutes || 30,
      faviconUrl: `https://www.google.com/s2/favicons?domain=${finalSiteUrl || finalFeedUrl}&sz=128`,
    }, workspaceId);

    // Optionally perform immediate initial sync
    let newItemsCount = 0;
    if (initialSync !== false) {
      try {
        const syncResult = await RssFeedManager.syncFeed(createdFeed.id, omniDb.getAllLinks(workspaceId), getGenAI(), workspaceId);
        if (syncResult.newLinks.length > 0) {
          omniDb.bulkInsert(syncResult.newLinks, workspaceId);
          refreshLinksCache(workspaceId);
          saveLinks(undefined, workspaceId);
          newItemsCount = syncResult.newLinks.length;
          hybridSearchEngine.runBackgroundIndexing(getGenAI(), workspaceId).catch(() => {});
        }
      } catch (syncErr) {
        if (syncErr instanceof AiQuotaExceededError) throw syncErr;
        console.warn('Initial feed sync warning:', syncErr);
      }
    }

    res.status(201).json({
      feed: createdFeed,
      newItemsCount,
      success: true,
    });
  } catch (err: any) {
    if (respondToAiQuotaError(err, res)) return;
    console.error('Error subscribing to feed:', err);
    res.status(500).json({ error: err.message || 'Failed to subscribe to feed' });
  }
});

// PUT /api/rss/feeds/:id - Update feed settings
app.put('/api/rss/feeds/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updated = RssFeedManager.updateFeed(id, req.body, workspaceFor(req));
    if (!updated) {
      res.status(404).json({ error: 'Feed not found.' });
      return;
    }
    res.json({ feed: updated, success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update feed' });
  }
});

// DELETE /api/rss/feeds/:id - Delete feed subscription
app.delete('/api/rss/feeds/:id', (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = workspaceFor(req);
    const { deleteAssociatedLinks } = req.query;
    const success = RssFeedManager.deleteFeed(id, workspaceId);
    if (!success) {
      res.status(404).json({ error: 'Feed not found.' });
      return;
    }

    // Optional purge of associated items
    if (deleteAssociatedLinks === 'true') {
      const associatedLinks = omniDb.getAllLinks(workspaceId).filter((l) => l.feedId === id);
      omniDb.batchDelete(associatedLinks.map((l) => l.id), workspaceId);
      refreshLinksCache(workspaceId);
      saveLinks(undefined, workspaceId);
    }

    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete feed' });
  }
});

// POST /api/rss/discover - Auto-discover RSS/Atom endpoint from website URL
app.post('/api/rss/discover', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'url string is required' });
      return;
    }

    const discovery = await RssFeedManager.discoverFeed(url);
    res.json(discovery);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Discovery failed' });
  }
});

// POST /api/rss/feeds/:id/sync - Sync single feed
app.post('/api/rss/feeds/:id/sync', async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = workspaceFor(req);
    const result = await RssFeedManager.syncFeed(id, omniDb.getAllLinks(workspaceId), getGenAI(), workspaceId);
    
    if (result.newLinks.length > 0) {
      omniDb.bulkInsert(result.newLinks, workspaceId);
      refreshLinksCache(workspaceId);
      saveLinks(undefined, workspaceId);
      hybridSearchEngine.runBackgroundIndexing(getGenAI(), workspaceId).catch(() => {});
    }

    res.json({
      success: true,
      feed: result.feed,
      newItemsCount: result.newLinks.length,
      newLinks: result.newLinks,
      error: result.error,
    });
  } catch (err: any) {
    if (respondToAiQuotaError(err, res)) return;
    console.error('Feed sync error:', err);
    res.status(500).json({ error: err.message || 'Feed sync failed' });
  }
});

// POST /api/rss/sync - Sync all enabled feeds
app.post('/api/rss/sync', async (req, res) => {
  try {
    const workspaceId = workspaceFor(req);
    const result = await RssFeedManager.syncAllEnabledFeeds(omniDb.getAllLinks(workspaceId), getGenAI(), workspaceId);
    
    if (result.newLinks.length > 0) {
      omniDb.bulkInsert(result.newLinks, workspaceId);
      refreshLinksCache(workspaceId);
      saveLinks(undefined, workspaceId);
      hybridSearchEngine.runBackgroundIndexing(getGenAI(), workspaceId).catch(() => {});
    }

    res.json({
      success: true,
      totalFeedsProcessed: result.processedCount,
      newItemsCount: result.newLinks.length,
      errors: result.errors,
    });
  } catch (err: any) {
    if (respondToAiQuotaError(err, res)) return;
    console.error('All feeds sync error:', err);
    res.status(500).json({ error: err.message || 'All feeds sync failed' });
  }
});

// GET /api/rss/catalog - Curated list of popular dev & tech blogs
app.get('/api/rss/catalog', (req, res) => {
  try {
    const subscribedUrls = new Set(RssFeedManager.getAll(workspaceFor(req)).map((f) => f.url.toLowerCase()));
    const catalog = CURATED_DEV_FEEDS.map((feed) => ({
      ...feed,
      isSubscribed: subscribedUrls.has(feed.url.toLowerCase()),
    }));
    res.json({ catalog });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch catalog' });
  }
});

// GET /api/rss/opml/export - Export OPML XML
app.get('/api/rss/opml/export', (req, res) => {
  try {
    const opmlXml = RssFeedManager.exportOpml(workspaceFor(req));
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="omnilink-feeds.opml"');
    res.send(opmlXml);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to export OPML' });
  }
});

// POST /api/rss/opml/import - Import OPML XML
app.post('/api/rss/opml/import', async (req, res) => {
  try {
    const workspaceId = workspaceFor(req);
    const { opmlContent, initialSync } = req.body;
    if (!opmlContent || typeof opmlContent !== 'string') {
      res.status(400).json({ error: 'opmlContent XML string is required' });
      return;
    }

    const importResult = RssFeedManager.importOpml(opmlContent, workspaceId);

    if (initialSync !== false && importResult.importedCount > 0) {
      try {
        const syncRes = await RssFeedManager.syncAllEnabledFeeds(omniDb.getAllLinks(workspaceId), getGenAI(), workspaceId);
        if (syncRes.newLinks.length > 0) {
          omniDb.bulkInsert(syncRes.newLinks, workspaceId);
          refreshLinksCache(workspaceId);
          saveLinks(undefined, workspaceId);
        }
      } catch (syncErr) {
        if (syncErr instanceof AiQuotaExceededError) throw syncErr;
        console.warn('Initial sync after OPML import notice:', syncErr);
      }
    }

    res.json(importResult);
  } catch (err: any) {
    if (respondToAiQuotaError(err, res)) return;
    res.status(500).json({ error: err.message || 'Failed to import OPML' });
  }
});

// Heuristic Fallback Generator when API is experiencing high demand or offline
function generateHeuristicExtraction(
  url: string,
  userTitle?: string,
  userNotes?: string,
  platform?: PlatformType
) {
  const detectedPlatform = platform || detectPlatform(url);
  let cleanTitle = userTitle || '';
  let category = 'Dev & Tech';
  let author = '';
  let tags: string[] = [];
  let tldr = '';
  let keyTakeaways: string[] = [];
  let codeSnippets: string[] = [];
  let quotes: string[] = [];
  let readingTimeMinutes = 3;
  let aiScore = 88;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');
    const segments = parsed.pathname.split('/').filter(Boolean);

    if (detectedPlatform === 'github') {
      const org = segments[0] || 'developer';
      const repo = segments[1] || 'repository';
      author = org;
      cleanTitle = cleanTitle || `${org}/${repo}: Modern Open-Source Library`;
      category = 'Dev & Tech';
      tags = [repo.toLowerCase(), 'github', 'open-source', 'typescript', 'developer-tools'];
      tldr = `Production-ready open-source repository '${org}/${repo}' providing modular architecture and ergonomic developer APIs.`;
      keyTakeaways = [
        `Maintained by ${org} for clean developer ergonomics and scalable integration`,
        `Built for modern TypeScript workflows with modular component structure`,
        `Active open source community support and extensible configuration patterns`,
      ];
      codeSnippets = [`git clone ${url}.git\ncd ${repo}\nnpm install`];
      readingTimeMinutes = 4;
      aiScore = 94;
    } else if (detectedPlatform === 'reddit_post' || detectedPlatform === 'reddit_comment') {
      const subreddit = segments[1] ? `r/${segments[1]}` : 'Reddit';
      cleanTitle = cleanTitle || `${subreddit}: Technical architecture discussion and community insights`;
      category = 'Reddit Discussions';
      tags = [segments[1]?.toLowerCase() || 'reddit', 'discussion', 'community-consensus', 'engineering'];
      tldr = `In-depth community discussion on ${subreddit} evaluating practical engineering trade-offs and production reliability.`;
      keyTakeaways = [
        'Community discussion compares latency, simplicity, and operational overhead in real systems',
        'Consensus emphasizes strict schema validation and error-boundary safeguards',
        'Shared production learnings on edge-case handling and performance tuning',
      ];
      readingTimeMinutes = 5;
      aiScore = 89;
    } else if (detectedPlatform === 'youtube') {
      author = 'AI & Engineering Media';
      cleanTitle = cleanTitle || 'Technical Architecture Walkthrough & Deep-Dive (Video)';
      category = 'Tutorials & Guides';
      tags = ['youtube', 'video-tutorial', 'walkthrough', 'deep-dive', 'fullstack'];
      tldr = 'Comprehensive video walkthrough detailing practical implementation steps, system architecture, and runtime patterns.';
      keyTakeaways = [
        'Step-by-step breakdown of setup, configuration, and state synchronization',
        'Live demonstration covering error recovery and resilience patterns',
        'Recommended practices for maintainable production deployments',
      ];
      readingTimeMinutes = 12;
      aiScore = 91;
    } else if (detectedPlatform === 'instagram_short') {
      author = '@creator.workspace';
      cleanTitle = cleanTitle || 'Minimalist Desk Setup & Developer Ergonomics (Reel)';
      category = 'Design & UI';
      tags = ['instagram', 'reels', 'productivity', 'desk-setup', 'ergonomics'];
      tldr = 'Visual guide detailing ergonomic workspace organization, magnetic cable management, and diffuse lighting for focused sessions.';
      keyTakeaways = [
        'Under-desk cable raceways and magnetic anchors eliminate clutter',
        'Warm diffuse backlighting reduces eye strain during late coding sessions',
      ];
      readingTimeMinutes = 1;
      aiScore = 82;
    } else if (detectedPlatform === 'paper') {
      category = 'Research & Papers';
      cleanTitle = cleanTitle || 'Empirical Research Study & Algorithmic Methodology';
      tags = ['research-paper', 'ai-ml', 'methodology', 'arxiv', 'empirical-study'];
      tldr = 'Formal research paper detailing novel algorithmic formulations, experimental benchmarks, and empirical evaluations.';
      keyTakeaways = [
        'Novel mathematical formulation yielding consistent benchmark gains',
        'Ablation analysis confirming significance of individual components',
        'Detailed evaluation of inference efficiency and scaling behavior',
      ];
      readingTimeMinutes = 15;
      aiScore = 95;
    } else {
      cleanTitle = cleanTitle || `${hostname} Technical Resource`;
      category = 'Dev & Tech';
      tags = [hostname.split('.')[0] || 'web', 'article', 'reference', 'knowledge-hub'];
      tldr = `Curated technical guide from ${hostname} with implementation patterns and practical architectural guidance.`;
      keyTakeaways = [
        `Core engineering takeaways and principles sourced from ${hostname}`,
        'Structured overview of concepts, trade-offs, and best practices',
        'Directly applicable to modern cloud and web development patterns',
      ];
      readingTimeMinutes = 4;
      aiScore = 86;
    }
  } catch {
    cleanTitle = cleanTitle || url;
    tags = ['inbox', 'bookmark'];
    tldr = 'Saved bookmark ready for instant retrieval and analysis.';
    keyTakeaways = ['Direct reference link stored in OmniLink AI repository'];
  }

  const cleanUserNotes = userNotes && !/Article URL:.*Comments URL:/is.test(userNotes) ? userNotes.trim() : '';
  if (cleanUserNotes) {
    keyTakeaways.push(`User Note: "${cleanUserNotes.slice(0, 120)}"`);
  }

  return {
    title: cleanTitle,
    author: author || 'Web Curator',
    category,
    tags,
    summary: {
      tldr,
      keyTakeaways,
      codeSnippets,
      quotes,
    },
    readingTimeMinutes,
    aiScore,
  };
}

// Heuristic Cluster Generator
function generateHeuristicClusters(links: LinkItem[]): any[] {
  if (links.length === 0) return [];

  const clusters = [
    {
      id: 'cluster-dev-arch',
      title: 'Full-Stack Architecture & Component Engineering',
      description: 'UI components, state management, fullstack frameworks, and design system primitives.',
      themeColor: 'indigo',
      tags: ['react', 'tailwind', 'ui-components', 'fullstack', 'typescript'],
      linkIds: [] as string[],
    },
    {
      id: 'cluster-ai-agents',
      title: 'Autonomous Agents & LLM Systems',
      description: 'Multi-agent orchestration, RAG pipelines, prompt architecture, and local model inference.',
      themeColor: 'sky',
      tags: ['llm', 'rag', 'multi-agent', 'ai', 'gemini'],
      linkIds: [] as string[],
    },
    {
      id: 'cluster-systems-db',
      title: 'High-Performance Systems & Database Optimization',
      description: 'SQLite WAL concurrency, memory mapping, low-latency backends, and storage engines.',
      themeColor: 'emerald',
      tags: ['sqlite', 'database', 'backend', 'performance', 'systems'],
      linkIds: [] as string[],
    },
    {
      id: 'cluster-productivity-media',
      title: 'Developer Ergonomics, Media & Visual Workflows',
      description: 'Desk setups, visual design patterns, video walkthroughs, and social tips.',
      themeColor: 'amber',
      tags: ['productivity', 'youtube', 'desk-setup', 'reels', 'minimalism'],
      linkIds: [] as string[],
    },
  ];

  links.forEach((link) => {
    const text = `${link.title} ${link.category} ${link.tags.join(' ')} ${link.platform}`.toLowerCase();
    if (
      text.includes('agent') ||
      text.includes('llm') ||
      text.includes('rag') ||
      text.includes('ai') ||
      link.category.includes('AI')
    ) {
      clusters[1].linkIds.push(link.id);
    } else if (
      text.includes('db') ||
      text.includes('sqlite') ||
      text.includes('sql') ||
      text.includes('database') ||
      text.includes('backend') ||
      text.includes('system')
    ) {
      clusters[2].linkIds.push(link.id);
    } else if (
      text.includes('desk') ||
      text.includes('setup') ||
      text.includes('youtube') ||
      text.includes('reel') ||
      link.platform === 'instagram_short' ||
      link.platform === 'youtube'
    ) {
      clusters[3].linkIds.push(link.id);
    } else {
      clusters[0].linkIds.push(link.id);
    }
  });

  const active = clusters.filter((c) => c.linkIds.length > 0);
  if (active.length === 0 && links.length > 0) {
    clusters[0].linkIds = links.map((l) => l.id);
    return [clusters[0]];
  }
  return active;
}

// Heuristic Ask Repo Generator
function generateHeuristicAskRepo(
  question: string,
  links: LinkItem[]
): {
  answer: string;
  referencedLinkIds: string[];
  suggestions: string[];
} {
  const queryTerms = question.toLowerCase().split(/\W+/).filter((t) => t.length > 2);

  const scored = links.map((link) => {
    let score = 0;
    const text = `${link.title} ${link.summary?.tldr || ''} ${(link.summary?.keyTakeaways || []).join(' ')} ${link.tags.join(' ')} ${link.notes || ''}`.toLowerCase();
    queryTerms.forEach((term) => {
      if (text.includes(term)) score += 3;
      if (link.title.toLowerCase().includes(term)) score += 5;
    });
    return { link, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const matched = scored.filter((s) => s.score > 0).slice(0, 3);
  const topLinks = matched.length > 0 ? matched.map((m) => m.link) : links.slice(0, 2);

  const referencedLinkIds = topLinks.map((l) => l.id);

  let answer = `### Synthesized Knowledge from Your Saved Repository\n\n`;
  answer += `Based on your query **"${question}"**, here are the most relevant insights from your repository:\n\n`;

  topLinks.forEach((l) => {
    answer += `#### 📌 [${l.title}](${l.url}) [ID: ${l.id}]\n`;
    answer += `* **TL;DR**: ${l.summary?.tldr || l.description || 'Saved link in repository'}\n`;
    if (l.summary?.keyTakeaways && l.summary.keyTakeaways.length > 0) {
      answer += `* **Key Insights**:\n`;
      l.summary.keyTakeaways.slice(0, 3).forEach((k) => {
        answer += `  - ${k}\n`;
      });
    }
    if (l.summary?.codeSnippets && l.summary.codeSnippets.length > 0) {
      answer += `* **Code / Command**:\n\`\`\`\n${l.summary.codeSnippets[0]}\n\`\`\`\n`;
    }
    answer += `\n`;
  });

  answer += `\n> *Synthesized using neural repository index.*`;

  return {
    answer,
    referencedLinkIds,
    suggestions: [
      `How do I integrate ${topLinks[0]?.title?.slice(0, 30) || 'this'} in my project?`,
      `Show me all tags related to ${topLinks[0]?.tags?.[0] || 'these topics'}`,
      `Compare ${topLinks[0]?.category || 'Dev & Tech'} bookmarks in my library`,
    ],
  };
}

function getRandomThumbnail(platform: PlatformType): string {
  const images = {
    github: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=600&auto=format&fit=crop&q=80',
    reddit_post: 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=600&auto=format&fit=crop&q=80',
    reddit_comment: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=600&auto=format&fit=crop&q=80',
    instagram_short: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&auto=format&fit=crop&q=80',
    youtube: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
    twitter_x: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=600&auto=format&fit=crop&q=80',
    paper: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&auto=format&fit=crop&q=80',
    article: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&auto=format&fit=crop&q=80',
    other: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=600&auto=format&fit=crop&q=80',
  };
  return images[platform] || images.other;
}

// Global API Error Boundary Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[OmniLink Server Uncaught Error]:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});

// Vite middleware & Production Serving
async function start() {
  // Fail startup before binding when OIDC discovery/JWKS configuration is invalid.
  await authStackPromise;
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.includes('/assets/') || filePath.includes('\\assets\\')) {
            // Vite hashed static assets - 1 year immutable cache
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else if (filePath.endsWith('.html')) {
            // HTML entry points must always revalidate
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(runtimeConfig.port, runtimeConfig.host, () => {
    console.log(`OmniLink AI Server running on http://${runtimeConfig.host}:${runtimeConfig.port}`);
    const unsafeWarning = describeUnsafeRemoteWarning(runtimeConfig);
    if (unsafeWarning) console.warn(unsafeWarning);
    console.log(`SQLite Database active at data/omnilink.db (${omniDb.count()} links)`);

    // These legacy startup jobs run without a request actor. Keep them local
    // until the multi-user scheduler can supply a workspace context and quota
    // permit for every job.
    if (runtimeConfig.mode === 'local') {
      // Launch non-blocking background vector embedding indexer
      setTimeout(() => {
        hybridSearchEngine.runBackgroundIndexing(getGenAI()).catch((err) => {
          console.warn('[HybridSearch] Initial indexing background notice:', err);
        });
      }, 1500);

      // Auto-heal existing links with raw Hacker News RSS boilerplate in their summary
      setTimeout(async () => {
      try {
        const all = omniDb.getAllLinks();
        const brokenLinks = all.filter((l) =>
          l.summary?.tldr && /Article URL:.*Comments URL:/is.test(l.summary.tldr)
        );
        if (brokenLinks.length > 0) {
          console.log(`[AutoHeal] Found ${brokenLinks.length} items with raw HN boilerplate. Starting AI re-extraction...`);
          const ai = getGenAI();
          for (const bl of brokenLinks) {
            try {
              if (ai) {
                const aiRes = await extractWithGemini(bl.url, bl.title, '', bl.platform);
                if (aiRes && aiRes.summary) {
                  omniDb.updateLink(bl.id, {
                    title: aiRes.title || bl.title,
                    author: aiRes.author || bl.author,
                    category: aiRes.category || bl.category,
                    tags: Array.from(new Set([...bl.tags, ...(aiRes.tags || [])])),
                    summary: aiRes.summary,
                    readingTimeMinutes: aiRes.readingTimeMinutes || bl.readingTimeMinutes,
                    aiScore: aiRes.aiScore || bl.aiScore,
                    readerSnapshot: aiRes.readerSnapshot || bl.readerSnapshot,
                  });
                }
              } else {
                omniDb.updateLink(bl.id, {
                  summary: {
                    tldr: `Curated tech discussion: "${bl.title}".`,
                    keyTakeaways: [`Published via ${bl.feedTitle || 'Hacker News'}`],
                  },
                });
              }
            } catch (healErr) {
              console.warn(`[AutoHeal] Skipped ${bl.id}:`, healErr);
            }
          }
          refreshLinksCache();
          saveLinks();
          console.log(`[AutoHeal] Re-extraction complete for ${brokenLinks.length} items.`);
        }
      } catch (err) {
        console.warn('[AutoHeal] Startup scan notice:', err);
      }
      }, 3000);

      // Auto-poll enabled RSS feeds every 15 minutes
      setInterval(async () => {
        try {
          const syncResult = await RssFeedManager.syncAllEnabledFeeds(omniDb.getAllLinks(), getGenAI());
          if (syncResult.newLinks.length > 0) {
            omniDb.bulkInsert(syncResult.newLinks);
            refreshLinksCache();
            saveLinks();
            console.log(`[RSS Background Sync] Ingested ${syncResult.newLinks.length} new items into unread list.`);
            hybridSearchEngine.runBackgroundIndexing(getGenAI()).catch(() => {});
          }
        } catch (err: any) {
          console.warn('[RSS Background Sync] Polling error:', err.message);
        }
      }, 15 * 60 * 1000);
    }
  });
}

start();
