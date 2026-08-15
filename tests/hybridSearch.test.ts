import { describe, it, expect } from 'vitest';
import { HybridSearchEngine } from '../server/hybridSearch';
import { omniDb } from '../server/db';
import { LinkItem } from '../src/types';

describe('Hybrid Search Engine & RRF Rank Fusion Suite', () => {
  it('computes Cosine Similarity accurately between vector embeddings', () => {
    const vecA = new Float32Array([1, 0, 0, 0]);
    const vecB = new Float32Array([1, 0, 0, 0]);
    const vecC = new Float32Array([0, 1, 0, 0]);
    const vecD = new Float32Array([0.7071, 0.7071, 0, 0]);

    // Identical vectors = 1.0
    expect(HybridSearchEngine.cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0, 4);
    // Orthogonal vectors = 0.0
    expect(HybridSearchEngine.cosineSimilarity(vecA, vecC)).toBeCloseTo(0.0, 4);
    // 45 degree angle vectors ≈ 0.7071
    expect(HybridSearchEngine.cosineSimilarity(vecA, vecD)).toBeCloseTo(0.7071, 2);
  });

  it('calculates Reciprocal Rank Fusion (RRF) scores accurately', () => {
    // Both lists rank #1: (1/61) + (1/61) ≈ 0.03278
    const dualRank1 = HybridSearchEngine.computeRrfScore(1, 1, 60);
    expect(dualRank1).toBeCloseTo(0.03278, 4);

    // Only FTS rank #1: (1/61) ≈ 0.01639
    const ftsOnlyRank1 = HybridSearchEngine.computeRrfScore(1, null, 60);
    expect(ftsOnlyRank1).toBeCloseTo(0.01639, 4);

    // Dual match always ranks strictly higher than single match
    expect(dualRank1).toBeGreaterThan(ftsOnlyRank1);

    // Rank 10 is lower than Rank 1
    const ftsRank10 = HybridSearchEngine.computeRrfScore(10, null, 60);
    expect(ftsOnlyRank1).toBeGreaterThan(ftsRank10);
  });
});
