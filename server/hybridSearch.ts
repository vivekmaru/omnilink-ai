import { GoogleGenAI } from '@google/genai';
import { LOCAL_WORKSPACE_ID, OmniLinkDB, omniDb } from './db';
import { LinkItem } from '../src/types';
import { AiQuotaExceededError, beginAiProviderAttempt, recordAiProviderAttempt } from './aiUsage';

export interface HybridSearchResult {
  link: LinkItem;
  rrfScore: number;
  ftsRank: number | null;
  vectorSimilarity: number | null;
  matchReasons: string[];
}

export interface HybridSearchOptions {
  limit?: number;
  category?: string;
  platform?: string;
  readStatus?: string;
  minScore?: number;
}

export class HybridSearchEngine {
  private db: OmniLinkDB;
  private isIndexing: boolean = false;

  constructor(db: OmniLinkDB = omniDb) {
    this.db = db;
  }

  // Format link content into a rich text chunk for high-fidelity embedding
  static formatLinkForEmbedding(link: LinkItem): string {
    const parts: string[] = [
      `Title: ${link.title}`,
      `Category: ${link.category}`,
      `Platform: ${link.platform}`,
    ];

    if (link.tags && link.tags.length > 0) {
      parts.push(`Tags: ${link.tags.join(', ')}`);
    }

    if (link.summary?.tldr) {
      parts.push(`Summary: ${link.summary.tldr}`);
    }

    if (link.summary?.keyTakeaways && link.summary.keyTakeaways.length > 0) {
      parts.push(`Takeaways: ${link.summary.keyTakeaways.join('; ')}`);
    }

    if (link.notes && link.notes.trim()) {
      parts.push(`User Notes: ${link.notes.trim()}`);
    }

    return parts.join('\n');
  }

  // Cosine Similarity between two Float32 vectors
  static cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Reciprocal Rank Fusion (RRF) formula: (1 / (k + ftsRank)) + (1 / (k + vectorRank))
  static computeRrfScore(ftsRank: number | null, vectorRank: number | null, k = 60): number {
    let score = 0;
    if (ftsRank !== null && ftsRank > 0) {
      score += 1.0 / (k + ftsRank);
    }
    if (vectorRank !== null && vectorRank > 0) {
      score += 1.0 / (k + vectorRank);
    }
    return score;
  }

  // Generate embedding using Gemini text-embedding-004
  async generateEmbedding(text: string, genAi: GoogleGenAI | null): Promise<number[]> {
    if (!text || !text.trim()) {
      return new Array(768).fill(0);
    }

    if (genAi) {
      let attemptReservationId: string | undefined;
      try {
        attemptReservationId = beginAiProviderAttempt({ model: 'text-embedding-004', inputCharacters: text.length });
        const response = await (genAi as any).models.embedContent({
          model: 'text-embedding-004',
          contents: text,
        });

        if (response?.embedding?.values && Array.isArray(response.embedding.values)) {
          recordAiProviderAttempt({ model: 'text-embedding-004', inputCharacters: text.length, status: 'completed', attempt: 1, reservationId: attemptReservationId });
          return response.embedding.values;
        }
      } catch (err) {
        if (err instanceof AiQuotaExceededError) throw err;
        recordAiProviderAttempt({ model: 'text-embedding-004', inputCharacters: text.length, status: 'failed', attempt: 1, reservationId: attemptReservationId });
        console.warn('[HybridSearch] Gemini embedding failed, falling back to term hash vector:', err);
      }
    }

    // Fallback deterministic pseudo-vector (384/768-d term frequency hashing) for offline operation
    return this.generateDeterministicHashVector(text, 768);
  }

  // Deterministic term frequency hashing vector (Offline / No API Key fallback)
  private generateDeterministicHashVector(text: string, dimensions: number = 768): number[] {
    const vec = new Float32Array(dimensions);
    const tokens = text.toLowerCase().split(/[^\w]+/).filter((t) => t.length > 2);

    if (tokens.length === 0) return Array.from(vec);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let hash = 0;
      for (let j = 0; j < token.length; j++) {
        hash = (hash << 5) - hash + token.charCodeAt(j);
        hash |= 0;
      }
      const idx = Math.abs(hash) % dimensions;
      const sign = (hash & 1) === 0 ? 1.0 : -1.0;
      vec[idx] += sign * (1.0 / Math.sqrt(tokens.length));
    }

    // Normalize
    let norm = 0;
    for (let i = 0; i < dimensions; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < dimensions; i++) vec[i] /= norm;
    }

    return Array.from(vec);
  }

  // Index single link embedding in database
  async indexLink(link: LinkItem, genAi: GoogleGenAI | null, workspaceId: string = LOCAL_WORKSPACE_ID): Promise<void> {
    try {
      const text = HybridSearchEngine.formatLinkForEmbedding(link);
      const vector = await this.generateEmbedding(text, genAi);
      this.db.storeEmbedding(link.id, vector, genAi ? 'text-embedding-004' : 'term-hash-v1', text, workspaceId);
    } catch (err) {
      if (err instanceof AiQuotaExceededError) throw err;
      console.warn(`[HybridSearch] Failed to index link ${link.id}:`, err);
    }
  }

  // Run background indexing for all unindexed bookmarks
  async runBackgroundIndexing(genAi: GoogleGenAI | null, workspaceId: string = LOCAL_WORKSPACE_ID): Promise<{ indexed: number; total: number }> {
    if (this.isIndexing) {
      return { indexed: 0, total: this.db.count(workspaceId) };
    }

    this.isIndexing = true;
    const unindexedIds = this.db.getUnindexedLinkIds(workspaceId);
    console.log(`[HybridSearch] Found ${unindexedIds.length} bookmarks missing vector embeddings. Starting background indexing...`);

    let count = 0;
    try {
      for (const id of unindexedIds) {
        const link = this.db.getLinkById(id, workspaceId);
        if (link) {
          await this.indexLink(link, genAi, workspaceId);
          count++;
          // Non-blocking yield
          if (count % 5 === 0) {
            await new Promise((r) => setTimeout(r, 100));
          }
        }
      }
      console.log(`[HybridSearch] Background indexing complete! Indexed ${count} bookmarks.`);
    } catch (err) {
      if (err instanceof AiQuotaExceededError) throw err;
      console.error('[HybridSearch] Error during background indexing:', err);
    } finally {
      this.isIndexing = false;
    }

    return { indexed: count, total: this.db.count(workspaceId) };
  }

  // HYBRID SEARCH: BM25 Lexical (FTS5) + Dense Vector Semantic (text-embedding-004) + Reciprocal Rank Fusion (RRF)
  async search(
    query: string,
    genAi: GoogleGenAI | null,
    options: HybridSearchOptions = {},
    workspaceId: string = LOCAL_WORKSPACE_ID,
  ): Promise<HybridSearchResult[]> {
    const { limit = 10, category, platform, readStatus, minScore = 0.001 } = options;
    const trimmedQuery = query ? query.trim() : '';

    if (!trimmedQuery) {
      // Empty query: return most recent bookmarks
      const all = this.db.getAllLinks(workspaceId).slice(0, limit);
      return all.map((l) => ({
        link: l,
        rrfScore: 1.0,
        ftsRank: null,
        vectorSimilarity: null,
        matchReasons: ['Recent bookmark'],
      }));
    }

    // Step 1: Lexical Search via SQLite FTS5 (BM25)
    const ftsMatches = this.db.searchFts(trimmedQuery, 30, workspaceId);
    const ftsRankMap = new Map<string, number>();
    ftsMatches.forEach((m, idx) => {
      ftsRankMap.set(m.id, idx + 1); // 1-indexed rank
    });

    // Step 2: Dense Vector Semantic Search
    let queryEmbedding: Float32Array | null = null;
    const vectorScoresMap = new Map<string, number>();
    const vectorRankMap = new Map<string, number>();

    try {
      const qVec = await this.generateEmbedding(trimmedQuery, genAi);
      queryEmbedding = new Float32Array(qVec);

      const allEmbeddings = this.db.getAllEmbeddings(workspaceId);
      const scored: Array<{ linkId: string; sim: number }> = [];

      for (const item of allEmbeddings) {
        const sim = HybridSearchEngine.cosineSimilarity(queryEmbedding, item.vector);
        if (sim > 0.1) {
          scored.push({ linkId: item.linkId, sim });
        }
      }

      // Sort by similarity DESC
      scored.sort((a, b) => b.sim - a.sim);

      scored.slice(0, 30).forEach((item, idx) => {
        vectorScoresMap.set(item.linkId, item.sim);
        vectorRankMap.set(item.linkId, idx + 1);
      });
    } catch (embErr) {
      if (embErr instanceof AiQuotaExceededError) throw embErr;
      console.warn('[HybridSearch] Vector search step error:', embErr);
    }

    // Step 3: Reciprocal Rank Fusion (RRF)
    // Formula: RRF_Score = (1 / (60 + FTS_Rank)) + (1 / (60 + Vector_Rank))
    const K = 60;
    const candidateIds = new Set<string>([...ftsRankMap.keys(), ...vectorRankMap.keys()]);
    const fusedResults: HybridSearchResult[] = [];

    for (const id of candidateIds) {
      const link = this.db.getLinkById(id, workspaceId);
      if (!link) continue;

      // Apply metadata filters if specified
      if (category && category !== 'all' && link.category !== category) continue;
      if (platform && platform !== 'all' && link.platform !== platform) continue;
      if (readStatus && readStatus !== 'all' && link.readStatus !== readStatus) continue;

      const ftsRank = ftsRankMap.get(id) || null;
      const vecRank = vectorRankMap.get(id) || null;
      const vecSim = vectorScoresMap.get(id) || null;

      let rrfScore = 0;
      const matchReasons: string[] = [];

      if (ftsRank !== null) {
        rrfScore += 1.0 / (K + ftsRank);
        matchReasons.push(`FTS5 Lexical Match (Rank #${ftsRank})`);
      }
      if (vecRank !== null) {
        rrfScore += 1.0 / (K + vecRank);
        const pct = vecSim !== null ? Math.round(vecSim * 100) : 0;
        matchReasons.push(`Semantic Vector Match (${pct}% similarity, Rank #${vecRank})`);
      }

      if (rrfScore >= minScore) {
        fusedResults.push({
          link,
          rrfScore,
          ftsRank,
          vectorSimilarity: vecSim,
          matchReasons,
        });
      }
    }

    // Sort by RRF score DESC
    fusedResults.sort((a, b) => b.rrfScore - a.rrfScore);

    return fusedResults.slice(0, limit);
  }
}

export const hybridSearchEngine = new HybridSearchEngine();
