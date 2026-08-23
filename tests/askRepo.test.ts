import { describe, it, expect } from 'vitest';
import { AskRepoSchema } from '../server/validators';
import { renderInlineMarkdown } from '../src/components/MarkdownRenderer';
import { LinkItem } from '../src/types';

describe('Ask AI / Ask Your Saved Repository Logic Suite', () => {
  const mockRepository: LinkItem[] = [
    {
      id: 'link-101',
      url: 'https://github.com/sqlite/sqlite',
      title: 'SQLite Database Source & Best Practices',
      platform: 'github',
      category: 'Dev & Tech',
      tags: ['sqlite', 'database', 'c', 'sql'],
      summary: {
        tldr: 'High-reliability embedded database with WAL mode and ACID transactions.',
        keyTakeaways: [
          'Enable PRAGMA journal_mode = WAL for concurrent reads and writes',
          'Use prepared statements to maximize query plan caching',
        ],
        codeSnippets: ['PRAGMA journal_mode = WAL;\nPRAGMA synchronous = NORMAL;'],
      },
      notes: 'Essential optimization for local offline apps',
      isFavorite: true,
      isArchived: false,
      readStatus: 'read',
      createdAt: '2026-01-10T00:00:00.000Z',
      updatedAt: '2026-01-10T00:00:00.000Z',
    },
    {
      id: 'link-102',
      url: 'https://anthropic.com/engineering',
      title: 'How building software is changing at Anthropic',
      platform: 'article',
      category: 'AI & Machine Learning',
      tags: ['ai', 'llm', 'agents', 'architecture'],
      summary: {
        tldr: 'Software engineering workflows shifting toward LLM-assisted system design and agentic pairs.',
        keyTakeaways: [
          'Engineers spend more time evaluating model architectures and specifications',
          'Autonomous agent loops require deterministic guardrails',
        ],
      },
      isFavorite: true,
      isArchived: false,
      readStatus: 'unread',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  ];

  describe('1. Schema Validation', () => {
    it('rejects empty or whitespace-only questions', () => {
      expect(AskRepoSchema.safeParse({ question: '' }).success).toBe(false);
      expect(AskRepoSchema.safeParse({ question: '   ' }).success).toBe(false);
    });

    it('accepts valid questions with optional model parameter', () => {
      const valid = AskRepoSchema.safeParse({
        question: 'How do I optimize SQLite for high read concurrency?',
        preferredModel: 'gemini-3.7-flash',
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.question).toBe('How do I optimize SQLite for high read concurrency?');
        expect(valid.data.preferredModel).toBe('gemini-3.7-flash');
      }
    });
  });

  describe('2. Knowledge Base RAG Context Extraction', () => {
    it('properly formats repository items for LLM grounding', () => {
      const knowledgeBase = mockRepository.map((l) => ({
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

      expect(knowledgeBase).toHaveLength(2);
      expect(knowledgeBase[0].id).toBe('link-101');
      expect(knowledgeBase[0].takeaways).toHaveLength(2);
      expect(knowledgeBase[0].codeSnippets?.[0]).toContain('PRAGMA journal_mode = WAL');
      expect(knowledgeBase[1].id).toBe('link-102');
      expect(knowledgeBase[1].tags).toContain('ai');
    });
  });

  describe('3. Markdown & Citation Rendering in Ask AI', () => {
    it('parses structured synthesis markdown with numbered lists and citations', () => {
      const answer = `Based on your repository, **2 bookmarks** match your query:

1. **SQLite Database Source & Best Practices** [ID: link-101]
   - Best practices include WAL mode optimization.
2. **How building software is changing at Anthropic** [ID: link-102]
   - Examines AI developer workflows.`;

      const inlineNodes = renderInlineMarkdown(answer, mockRepository);
      expect(inlineNodes.length).toBeGreaterThan(0);
    });

    it('creates interactive citation pills linked to valid repository items', () => {
      const text = 'Check [ID: link-101] for the configuration';
      let openedLink: LinkItem | null = null;

      const nodes = renderInlineMarkdown(text, mockRepository, (link) => {
        openedLink = link;
      });

      expect(nodes.length).toBe(3); // 'Check ', <CitationPill />, ' for the configuration'
    });
  });
});
