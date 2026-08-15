import { describe, it, expect } from 'vitest';
import { analyzeAndSuggestTags } from '../src/services/autoTagging';

describe('Auto-Tagging & Heuristic Classifier Suite', () => {
  it('extracts technical tags and recommends Dev & Tech category for Rust codebase', () => {
    const result = analyzeAndSuggestTags({
      url: 'https://github.com/astral-sh/uv',
      title: 'An extremely fast Python package and project manager, written in Rust',
      description: 'A single tool to replace pip, pip-tools, pipx, poetry, pyenv, twine, virtualenv, and more.',
      notes: 'Evaluate replacing poetry in production CI pipeline',
    });

    const tags = result.suggestedTags.map((t) => t.tag);
    expect(tags).toContain('python');
    expect(tags).toContain('rust');
    expect(result.suggestedCategory.category).toBe('Dev & Tech');
  });

  it('classifies Machine Learning papers correctly', () => {
    const result = analyzeAndSuggestTags({
      url: 'https://arxiv.org/abs/2402.12345',
      title: 'Direct Preference Optimization: Your Language Model is Secretly a Reward Model',
      description: 'Reinforcement learning from human feedback (RLHF) and LLM alignment for transformers.',
    });

    const tags = result.suggestedTags.map((t) => t.tag);
    expect(tags.some((t) => t.includes('llm') || t.includes('ai') || t.includes('rlhf') || t.includes('neural') || t.includes('research'))).toBe(true);
    expect(result.suggestedCategory.category).toBe('Research & Papers');
  });
});
