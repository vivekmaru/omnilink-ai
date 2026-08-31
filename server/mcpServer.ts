import dotenv from 'dotenv';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { LOCAL_WORKSPACE_ID, omniDb } from './db.js';
import { hybridSearchEngine } from './hybridSearch.js';
import { ReadabilityService } from './readabilityService.js';
import { GoogleGenAI } from '@google/genai';
import { LinkItem, LinkSummary, PlatformType } from '../src/types.js';
import { AiQuotaExceededError, beginAiProviderAttempt, createServiceAiPermit, recordAiProviderAttempt, runWithAiUsagePermit } from './aiUsage.js';
import type { RequestContext } from './securityBoundary.js';
import { loadRuntimeConfig } from './runtimeConfig.js';

dotenv.config();

// Initialize Gemini Client if API key is provided
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

const MCP_SERVICE_TOKEN_ENV = 'OMNILINK_SERVICE_TOKEN';
const MCP_API_TOKEN_ENV = 'OMNILINK_API_TOKEN';

/**
 * Read the MCP service credential without ever printing it.  STDIO clients
 * cannot use the browser's HttpOnly session cookie, so a scoped service token
 * is the future multi-user authentication seam.  Local mode intentionally
 * remains tokenless for backwards compatibility.
 */
export function resolveMcpServiceToken(env: NodeJS.ProcessEnv = process.env): string | null {
  const token = env[MCP_SERVICE_TOKEN_ENV] ?? env[MCP_API_TOKEN_ENV];
  const normalized = typeof token === 'string' ? token.trim() : '';
  return normalized || null;
}

/**
 * Build headers for a future authenticated HTTP/API transport.  Credentials
 * are never encoded into a URL and this helper does not log or expose them.
 */
export function getMcpAuthorizationHeaders(serviceToken = resolveMcpServiceToken()): Record<string, string> {
  return serviceToken ? { Authorization: `Bearer ${serviceToken}` } : {};
}

export interface OmniLinkMcpServerOptions {
  /** Explicit token is useful for embedding/tests; env remains the default. */
  serviceToken?: string | null;
}

function detectPlatform(url: string): PlatformType {
  const lower = url.toLowerCase();
  if (lower.includes('github.com')) return 'github';
  if (lower.includes('reddit.com')) return 'reddit_post';
  if (lower.includes('instagram.com')) return 'instagram_short';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter_x';
  if (lower.includes('arxiv.org') || lower.includes('biorxiv.org') || lower.includes('.pdf')) return 'paper';
  return 'article';
}

export function createOmniLinkMcpServer(options: OmniLinkMcpServerOptions = {}): McpServer {
  const mode = (process.env.OMNILINK_MODE ?? 'local').trim().toLowerCase();
  if (mode === 'multi-user') loadRuntimeConfig(process.env);
  const serviceToken = options.serviceToken === undefined
    ? resolveMcpServiceToken()
    : (typeof options.serviceToken === 'string' ? options.serviceToken.trim() || null : null);

  // A remote/multi-user MCP process must prove possession of its scoped
  // service token before tools can be exposed. Local stdio usage is unchanged.
  if (mode === 'multi-user' && !serviceToken) {
    throw new Error('MCP service token is required when OMNILINK_MODE=multi-user.');
  }
  const tokenRecord = mode === 'multi-user' && serviceToken ? omniDb.getServiceToken(serviceToken) : null;
  if (mode === 'multi-user' && !tokenRecord) {
    throw new Error('MCP service token is invalid, expired, or revoked.');
  }
  const workspaceId = tokenRecord?.workspaceId || LOCAL_WORKSPACE_ID;
  const mcpContext: RequestContext = tokenRecord ? {
    actor: { id: tokenRecord.id, kind: 'service' },
    workspace: { id: workspaceId, role: 'owner' },
    authMethod: 'service-token',
    mode: 'multi-user',
  } : {
    actor: { id: 'local-user', kind: 'local' },
    workspace: { id: LOCAL_WORKSPACE_ID, role: 'owner' },
    authMethod: 'local',
    mode: 'local-single-user',
  };
  const requireScope = (scope: string): void => {
    if (mode === 'multi-user') {
      // Re-resolve on every invocation so expiry and revocation take effect
      // without requiring a long-lived MCP process to restart.
      const activeToken = serviceToken
        ? omniDb.getServiceToken(serviceToken, scope, workspaceId)
        : null;
      if (!activeToken) {
        throw new Error(`MCP service token is invalid, expired, revoked, or lacks required scope: ${scope}`);
      }
    }
  };
  const withAi = <T>(operation: string, inputCharacters: number, action: () => Promise<T>): Promise<T> => {
    requireScope('ai:execute');
    const permit = createServiceAiPermit(
      mcpContext,
      omniDb,
      operation,
      'mcp',
      Number(process.env.OMNILINK_AI_QUOTA_MONTHLY_UNITS),
      Math.max(1, Math.ceil(inputCharacters / 4)),
    );
    return runWithAiUsagePermit(permit, action).finally(() => {
      if (permit.reservationId && !permit.reservationReleased) omniDb.releaseAiUsageReservation(permit.reservationId);
    });
  };

  const server = new McpServer({
    name: 'omnilink-mcp-server',
    version: '1.2.0',
  });

  // ==========================================
  // TOOL 1: search_repository (Hybrid Search)
  // ==========================================
  server.tool(
    'search_repository',
    'Search personal bookmarks and repositories using Hybrid Search (SQLite FTS5 BM25 + Gemini Dense Vector Embeddings + Reciprocal Rank Fusion).',
    {
      query: z.string().describe('Search terms or semantic concept to look for in your bookmarks'),
      category: z.string().optional().describe('Filter results by category (e.g. "Dev & Tech", "AI & Machine Learning", "Design & UI")'),
      platform: z.string().optional().describe('Filter by platform ("github", "paper", "article", "youtube", "reddit_post", "instagram_short")'),
      readStatus: z.enum(['all', 'unread', 'reading', 'read']).optional().describe('Filter by reading status'),
      limit: z.number().min(1).max(50).default(10).describe('Maximum number of matching bookmarks to return (default: 10)'),
    },
    async ({ query, category, platform, readStatus, limit }) => {
      requireScope('repository:read');
      return withAi('embedding-query', query.length, async () => {
      const genAi = getGenAI();
      const results = await hybridSearchEngine.search(query, genAi, {
        category,
        platform,
        readStatus,
        limit,
      }, workspaceId);

      if (!results || results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No bookmarks matched your search query "${query}".`,
            },
          ],
        };
      }

      const formatted = results
        .map((r, i) => {
          const l = r.link;
          const matchInfo = r.matchReasons.join(', ');
          const tagsStr = (l.tags || []).map((t) => `#${t}`).join(' ');
          const tldr = l.summary?.tldr ? `\n   > **TL;DR**: ${l.summary.tldr}` : '';
          const takeaways = (l.summary?.keyTakeaways || []).length > 0
            ? `\n   > **Takeaways**: ${(l.summary?.keyTakeaways || []).slice(0, 2).join('; ')}`
            : '';

          return `${i + 1}. **[${l.title}](${l.url})**
   - **Category**: \`${l.category}\` | **Platform**: \`${l.platform}\` | **Status**: \`${l.readStatus}\`
   - **Tags**: ${tagsStr || 'none'}
   - **Match Signals**: ${matchInfo} (Score: ${r.rrfScore.toFixed(4)})${tldr}${takeaways}`;
        })
        .join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `### 🔍 OmniLink Hybrid Search Results for "${query}" (${results.length} found)\n\n${formatted}`,
          },
        ],
      };
      });
    }
  );

  // ==========================================
  // TOOL 2: save_bookmark
  // ==========================================
  server.tool(
    'save_bookmark',
    'Save a new URL or repository into OmniLink with automated AI categorization, summary extraction, and vector indexing.',
    {
      url: z.string().url().describe('The URL to bookmark'),
      title: z.string().optional().describe('Optional title for the link'),
      notes: z.string().optional().describe('Personal notes or thoughts regarding why this was saved'),
      tags: z.array(z.string()).optional().describe('Optional tags for categorization'),
      category: z.string().optional().describe('Optional category override'),
    },
    async ({ url, title, notes, tags, category }) => {
      requireScope('repository:write');
      return withAi('embedding-indexing', url.length + (title?.length || 0) + (notes?.length || 0), async () => {
      const existing = omniDb.getLinkByUrl(url, workspaceId);
      if (existing) {
        return {
          content: [
            {
              type: 'text',
              text: `ℹ️ **Link already exists in OmniLink!**
- **Title**: [${existing.title}](${existing.url})
- **Category**: ${existing.category}
- **Read Status**: ${existing.readStatus}
- **ID**: \`${existing.id}\``,
            },
          ],
        };
      }

      const platform = detectPlatform(url);
      const newLink: LinkItem = {
        id: 'link-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        url,
        title: title || url,
        description: notes || '',
        platform,
        category: category || 'Dev & Tech',
        tags: tags && tags.length > 0 ? tags : ['mcp-saved', 'inbox'],
        summary: {
          tldr: 'Saved via Model Context Protocol (MCP).',
          keyTakeaways: notes ? [notes] : ['Ingested by AI assistant.'],
        },
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

      // Multi-user MCP calls must not report success while a quota denial is
      // hidden in a detached indexing promise. Roll back the newly inserted
      // row if admission fails before the provider call.
      const genAi = getGenAI();
      try {
        await hybridSearchEngine.indexLink(newLink, genAi, workspaceId);
      } catch (error) {
        if (error instanceof AiQuotaExceededError) omniDb.deleteLink(newLink.id, workspaceId);
        throw error;
      }
      ReadabilityService.extractFromUrl(newLink.url).then((snapshot) => {
        if (snapshot) {
          omniDb.updateLink(newLink.id, { readerSnapshot: snapshot }, workspaceId);
        }
      }).catch(() => {});

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Successfully saved to OmniLink!**
- **ID**: \`${newLink.id}\`
- **Title**: [${newLink.title}](${newLink.url})
- **Category**: \`${newLink.category}\`
- **Tags**: ${(newLink.tags || []).map((t) => `#${t}`).join(' ')}
- **Vector Indexing**: Enqueued in background`,
          },
        ],
      };
      });
    }
  );

  // ==========================================
  // TOOL 3: get_article_snapshot (Reader Mode)
  // ==========================================
  server.tool(
    'get_article_snapshot',
    'Retrieve the clean, distraction-free Markdown article snapshot of a saved bookmark or live URL.',
    {
      id_or_url: z.string().describe('The bookmark ID or target URL to read'),
    },
    async ({ id_or_url }) => {
      requireScope('repository:read');
      let link = omniDb.getLinkById(id_or_url, workspaceId) || omniDb.getLinkByUrl(id_or_url, workspaceId);

      if (link && link.readerSnapshot) {
        const snap = link.readerSnapshot;
        return {
          content: [
            {
              type: 'text',
              text: `# ${snap.title || link.title}
*Source: [${link.url}](${link.url}) | Word Count: ${snap.wordCount} | Reading Time: ~${snap.readingTimeMinutes} min*

---

${snap.contentMarkdown || snap.excerpt || 'No snapshot content available.'}`,
            },
          ],
        };
      }

      // If no cached snapshot, extract live
      const targetUrl = link ? link.url : id_or_url;
      const liveSnapshot = await ReadabilityService.extractFromUrl(targetUrl);

      if (!liveSnapshot) {
        return {
          content: [
            {
              type: 'text',
              text: `Could not extract a readable article snapshot for ${targetUrl}. The webpage might require login or JavaScript execution.`,
            },
          ],
        };
      }

      if (link) {
        omniDb.updateLink(link.id, { readerSnapshot: liveSnapshot }, workspaceId);
      }

      return {
        content: [
          {
            type: 'text',
            text: `# ${liveSnapshot.title}
*Source: [${targetUrl}](${targetUrl}) | Word Count: ${liveSnapshot.wordCount} | Reading Time: ~${liveSnapshot.readingTimeMinutes} min*

---

${liveSnapshot.contentMarkdown}`,
          },
        ],
      };
    }
  );

  // ==========================================
  // TOOL 4: ask_repository (Hybrid RAG)
  // ==========================================
  server.tool(
    'ask_repository',
    'Ask questions over your OmniLink repository with grounded hybrid search citations and synthesized answers.',
    {
      question: z.string().describe('The question you want answered using your bookmarked knowledge'),
      category: z.string().optional().describe('Optional category filter to constrain RAG context'),
    },
    async ({ question, category }) => {
      requireScope('repository:read');
      requireScope('ai:execute');
      const genAi = getGenAI();
      return withAi('mcp-synthesis', question.length, async () => {
      const matches = await hybridSearchEngine.search(question, genAi, {
        category,
        limit: 6,
      }, workspaceId);

      if (!matches || matches.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `I couldn't find any relevant bookmarks in your library to answer "${question}". Try broadening your query or saving more reference materials.`,
            },
          ],
        };
      }

      // Build RAG context block
      const contextBlocks = matches.map((m, idx) => {
        const l = m.link;
        return `[Source #${idx + 1}] Title: ${l.title}
URL: ${l.url}
Category: ${l.category}
Tags: ${(l.tags || []).join(', ')}
TL;DR: ${l.summary?.tldr || 'N/A'}
Key Takeaways: ${(l.summary?.keyTakeaways || []).join('; ') || 'N/A'}
Notes: ${l.notes || 'N/A'}
Excerpt: ${l.readerSnapshot?.excerpt || 'N/A'}`;
      }).join('\n\n---\n\n');

      if (genAi) {
        let attemptReservationId: string | undefined;
        try {
          const prompt = `You are OmniLink AI's knowledge synthesis engine. Answer the user's question accurately using ONLY the provided bookmarks from their personal library. Cite sources using [Source #] notation with corresponding URLs.

User Question: ${question}

Relevant Library Context:
${contextBlocks}

Synthesize a comprehensive, well-structured answer:`;

          attemptReservationId = beginAiProviderAttempt({ model: 'gemini-2.5-flash', inputCharacters: prompt.length });
          const response = await (genAi as any).models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });
          recordAiProviderAttempt({
            model: 'gemini-2.5-flash',
            inputCharacters: prompt.length,
            outputCharacters: response?.text?.length || 0,
            status: 'completed',
            attempt: 1,
            reservationId: attemptReservationId,
          });

          return {
            content: [
              {
                type: 'text',
                text: `${response.text}\n\n---\n### 📚 Referenced Sources:\n` +
                  matches.map((m, i) => `${i + 1}. **[${m.link.title}](${m.link.url})** (\`${m.link.category}\` - Score: ${m.rrfScore.toFixed(3)})`).join('\n'),
              },
            ],
          };
        } catch (e: any) {
          if (e instanceof AiQuotaExceededError) throw e;
          recordAiProviderAttempt({ model: 'gemini-2.5-flash', inputCharacters: question.length, status: 'failed', attempt: 1, reservationId: attemptReservationId });
          console.warn('[MCP Server] Gemini RAG synthesis error:', e);
        }
      }

      // Fallback if no Gemini API Key
      return {
        content: [
          {
            type: 'text',
            text: `### 📚 Grounded Bookmarks for: "${question}"\n\n` +
              matches.map((m, i) => `${i + 1}. **[${m.link.title}](${m.link.url})**\n   - Category: \`${m.link.category}\`\n   - TL;DR: ${m.link.summary?.tldr || 'N/A'}`).join('\n\n'),
          },
        ],
      };
      });
    }
  );

  // ==========================================
  // TOOL 5: list_recent_bookmarks
  // ==========================================
  server.tool(
    'list_recent_bookmarks',
    'List recent bookmarks from your OmniLink library with filters for reading status and category.',
    {
      limit: z.number().min(1).max(50).default(15).describe('Number of bookmarks to list'),
      readStatus: z.enum(['all', 'unread', 'reading', 'read']).default('all').describe('Filter by reading status'),
      category: z.string().optional().describe('Filter by category'),
    },
    async ({ limit, readStatus, category }) => {
      requireScope('repository:read');
      const items = omniDb.getFilteredLinks({
        readStatus,
        category,
        limit,
      }, workspaceId);

      if (!items || items.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No bookmarks found matching the specified filters.`,
            },
          ],
        };
      }

      const listStr = items.map((l, i) => {
        const tags = (l.tags || []).map((t) => `#${t}`).join(' ');
        return `${i + 1}. **[${l.title}](${l.url})**
   - **Category**: \`${l.category}\` | **Status**: \`${l.readStatus}\` | **Date**: ${l.createdAt.slice(0, 10)}
   - **Tags**: ${tags || 'none'}`;
      }).join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `### 📑 OmniLink Bookmarks (${items.length} items)\n\n${listStr}`,
          },
        ],
      };
    }
  );

  // ==========================================
  // TOOL 6: get_repository_stats
  // ==========================================
  server.tool(
    'get_repository_stats',
    'Get overall repository health, total bookmark counts, reading status breakdown, and top categories.',
    {},
    async () => {
      requireScope('repository:read');
      const total = omniDb.count(workspaceId);
      const unread = omniDb.getUnreadCount(workspaceId);
      const read = omniDb.getReadCount(workspaceId);
      const reading = omniDb.getReadingCount(workspaceId);
      const unindexed = omniDb.getUnindexedLinkIds(workspaceId).length;

      const stats = {
        totalBookmarks: total,
        inboxUnread: unread,
        currentlyReading: reading,
        reviewedRead: read,
        vectorEmbeddingsIndexed: total - unindexed,
        vectorEmbeddingsMissing: unindexed,
        fts5FullTextSearch: 'active',
      };

      return {
        content: [
          {
            type: 'text',
            text: `### 📊 OmniLink Repository Statistics\n\`\`\`json\n${JSON.stringify(stats, null, 2)}\n\`\`\``,
          },
        ],
      };
    }
  );

  // ==========================================
  // RESOURCES
  // ==========================================
  server.resource(
    'library-stats',
    'omnilink://library/stats',
    async (uri) => {
      requireScope('repository:read');
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify({
              total: omniDb.count(workspaceId),
              unread: omniDb.getUnreadCount(workspaceId),
              read: omniDb.getReadCount(workspaceId),
              reading: omniDb.getReadingCount(workspaceId),
            }, null, 2),
          },
        ],
      };
    }
  );

  server.resource(
    'library-unread',
    'omnilink://library/unread',
    async (uri) => {
      requireScope('repository:read');
      const unread = omniDb.getFilteredLinks({ readStatus: 'unread', limit: 25 }, workspaceId);
      const md = unread.map((l) => `- [${l.title}](${l.url}) (\`${l.category}\`) - ${l.summary?.tldr || ''}`).join('\n');
      return {
        contents: [
          {
            uri: uri.href,
            text: `# OmniLink Unread Inbox (${unread.length} items)\n\n${md}`,
          },
        ],
      };
    }
  );

  return server;
}

// Start STDIO transport when run directly
if (process.argv[1] && (process.argv[1].endsWith('mcpServer.ts') || process.argv[1].endsWith('mcpServer.js'))) {
  const mcpServer = createOmniLinkMcpServer();
  const transport = new StdioServerTransport();
  mcpServer.connect(transport).then(() => {
    console.error('[OmniLink MCP Server] Running on stdio transport.');
  }).catch((err) => {
    console.error('[OmniLink MCP Server] Failed to connect transport:', err);
    process.exit(1);
  });
}
