import { AutoTaggingResult, CategorySuggestion, PlatformType, TagSuggestion } from '../types';

// Stopwords to filter out during tokenization
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more',
  'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some',
  'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your',
  'yours', 'yourself', 'yourselves', 'com', 'http', 'https', 'www', 'html', 'org', 'net', 'io', 'app',
  'page', 'site', 'view', 'post', 'item', 'link', 'video', 'watch', 'read', 'check', 'get', 'new'
]);

// Taxonomy keyword mappings to canonical tags and categories
interface TaxonomyRule {
  tag: string;
  aliases: string[];
  category: string;
  baseWeight?: number;
}

const TAXONOMY: TaxonomyRule[] = [
  // AI & Machine Learning
  { tag: 'ai-agents', aliases: ['agent', 'agents', 'autonomous agent', 'subagent', 'multi-agent'], category: 'AI & Machine Learning', baseWeight: 95 },
  { tag: 'llm', aliases: ['llm', 'llms', 'large language model', 'language models', 'foundation model'], category: 'AI & Machine Learning', baseWeight: 92 },
  { tag: 'gemini', aliases: ['gemini', 'gemini-3.7', 'gemini flash', 'gemini pro', 'google ai', 'google genai'], category: 'AI & Machine Learning', baseWeight: 95 },
  { tag: 'openai', aliases: ['openai', 'gpt-4', 'gpt-4o', 'chatgpt', 'chat-gpt', 'o1', 'o3'], category: 'AI & Machine Learning', baseWeight: 90 },
  { tag: 'claude', aliases: ['claude', 'anthropic', 'sonnet', 'opus', 'haiku'], category: 'AI & Machine Learning', baseWeight: 90 },
  { tag: 'rag', aliases: ['rag', 'retrieval augmented', 'retrieval-augmented', 'vector search', 'vector db'], category: 'AI & Machine Learning', baseWeight: 90 },
  { tag: 'embeddings', aliases: ['embeddings', 'embedding', 'vector', 'chromadb', 'pinecone', 'qdrant'], category: 'AI & Machine Learning', baseWeight: 88 },
  { tag: 'prompt-engineering', aliases: ['prompt', 'prompts', 'prompting', 'system prompt', 'few-shot'], category: 'AI & Machine Learning', baseWeight: 85 },
  { tag: 'deep-learning', aliases: ['deep learning', 'neural network', 'neural nets', 'backpropagation'], category: 'AI & Machine Learning', baseWeight: 85 },
  { tag: 'machine-learning', aliases: ['machine learning', 'ml', 'scikit', 'classifier', 'supervised'], category: 'AI & Machine Learning', baseWeight: 85 },
  { tag: 'nlp', aliases: ['nlp', 'natural language', 'tokenization', 'tokenizer'], category: 'AI & Machine Learning', baseWeight: 85 },
  { tag: 'computer-vision', aliases: ['vision', 'ocr', 'image recognition', 'yolo', 'segmentation'], category: 'AI & Machine Learning', baseWeight: 85 },
  { tag: 'local-llm', aliases: ['ollama', 'llama', 'llama3', 'mistral', 'gguf', 'vllm', 'localllama'], category: 'AI & Machine Learning', baseWeight: 90 },
  { tag: 'diffusion', aliases: ['diffusion', 'stable diffusion', 'midjourney', 'flux', 'image gen'], category: 'AI & Machine Learning', baseWeight: 88 },
  { tag: 'langchain', aliases: ['langchain', 'langgraph', 'llamaindex'], category: 'AI & Machine Learning', baseWeight: 88 },

  // Dev & Tech - Frameworks & Languages
  { tag: 'react', aliases: ['react', 'reactjs', 'react 19', 'react-dom', 'hooks', 'useeffect'], category: 'Dev & Tech', baseWeight: 92 },
  { tag: 'typescript', aliases: ['typescript', 'ts', 'tsx', 'types', 'type safety'], category: 'Dev & Tech', baseWeight: 92 },
  { tag: 'javascript', aliases: ['javascript', 'js', 'es6', 'ecmascript', 'nodejs', 'node.js'], category: 'Dev & Tech', baseWeight: 85 },
  { tag: 'python', aliases: ['python', 'py', 'pip', 'pytest', 'fastapi', 'flask', 'django'], category: 'Dev & Tech', baseWeight: 90 },
  { tag: 'rust', aliases: ['rust', 'rustlang', 'cargo', 'tokio', 'wasm'], category: 'Dev & Tech', baseWeight: 92 },
  { tag: 'golang', aliases: ['golang', 'go lang', 'goroutine'], category: 'Dev & Tech', baseWeight: 90 },
  { tag: 'nextjs', aliases: ['nextjs', 'next.js', 'app router', 'server component', 'ssr'], category: 'Dev & Tech', baseWeight: 92 },
  { tag: 'vue', aliases: ['vue', 'vuejs', 'nuxt', 'vue3'], category: 'Dev & Tech', baseWeight: 88 },
  { tag: 'svelte', aliases: ['svelte', 'sveltekit', 'runes'], category: 'Dev & Tech', baseWeight: 88 },
  { tag: 'tailwind', aliases: ['tailwind', 'tailwindcss', 'utility classes'], category: 'Dev & Tech', baseWeight: 90 },
  { tag: 'sqlite', aliases: ['sqlite', 'wal', 'sqlite3', 'libsql', 'turso'], category: 'Dev & Tech', baseWeight: 92 },
  { tag: 'postgresql', aliases: ['postgres', 'postgresql', 'pgvector', 'supabase', 'neon'], category: 'Dev & Tech', baseWeight: 92 },
  { tag: 'database', aliases: ['database', 'db', 'sql', 'nosql', 'redis', 'mongodb', 'schema'], category: 'Dev & Tech', baseWeight: 85 },
  { tag: 'docker', aliases: ['docker', 'container', 'dockerfile', 'docker-compose', 'k8s', 'kubernetes'], category: 'Dev & Tech', baseWeight: 90 },
  { tag: 'backend', aliases: ['backend', 'server', 'api', 'rest', 'graphql', 'grpc', 'microservices'], category: 'Dev & Tech', baseWeight: 85 },
  { tag: 'frontend', aliases: ['frontend', 'client', 'spa', 'browser', 'dom'], category: 'Dev & Tech', baseWeight: 85 },
  { tag: 'fullstack', aliases: ['fullstack', 'full-stack', 'monorepo', 'end-to-end'], category: 'Dev & Tech', baseWeight: 88 },
  { tag: 'performance', aliases: ['performance', 'optimization', 'latency', 'throughput', 'benchmarks', 'speed'], category: 'Dev & Tech', baseWeight: 85 },
  { tag: 'security', aliases: ['security', 'encryption', 'aes', 'auth', 'oauth', 'jwt', 'vulnerability'], category: 'Dev & Tech', baseWeight: 88 },
  { tag: 'github', aliases: ['github', 'repo', 'open source', 'repository', 'pull request', 'oss'], category: 'Dev & Tech', baseWeight: 85 },

  // Design & UI
  { tag: 'design-systems', aliases: ['design system', 'design systems', 'tokens', 'storybook', 'shadcn'], category: 'Design & UI', baseWeight: 92 },
  { tag: 'ui-ux', aliases: ['ui', 'ux', 'ui/ux', 'user interface', 'user experience', 'wireframe'], category: 'Design & UI', baseWeight: 90 },
  { tag: 'figma', aliases: ['figma', 'auto-layout', 'design tokens', 'prototyping'], category: 'Design & UI', baseWeight: 92 },
  { tag: 'animation', aliases: ['animation', 'motion', 'framer-motion', 'keyframes', 'transitions'], category: 'Design & UI', baseWeight: 88 },
  { tag: 'typography', aliases: ['typography', 'fonts', 'font-pairing', 'hierarchy', 'kerning'], category: 'Design & UI', baseWeight: 85 },
  { tag: 'minimalism', aliases: ['minimalism', 'minimalist', 'clean design', 'clean setup', 'aesthetic'], category: 'Design & UI', baseWeight: 85 },
  { tag: 'dark-mode', aliases: ['dark mode', 'theme switch', 'color palette', 'contrast'], category: 'Design & UI', baseWeight: 82 },
  { tag: 'accessibility', aliases: ['accessibility', 'a11y', 'screen reader', 'aria', 'wcag'], category: 'Design & UI', baseWeight: 88 },

  // Productivity & Workflows
  { tag: 'productivity', aliases: ['productivity', 'productive', 'focus', 'flow state', 'efficiency'], category: 'Productivity', baseWeight: 88 },
  { tag: 'desk-setup', aliases: ['desk setup', 'workspace', 'cable management', 'ergonomic', 'battlestation'], category: 'Productivity', baseWeight: 90 },
  { tag: 'workflow', aliases: ['workflow', 'automation', 'shortcuts', 'zsh', 'terminal', 'cli'], category: 'Productivity', baseWeight: 85 },
  { tag: 'second-brain', aliases: ['second brain', 'pkm', 'obsidian', 'notion', 'knowledge management', 'zettelkasten'], category: 'Productivity', baseWeight: 90 },
  { tag: 'notes', aliases: ['notes', 'bookmarking', 'archival', 'summaries', 'digest'], category: 'Productivity', baseWeight: 80 },

  // Tutorials & Guides
  { tag: 'tutorial', aliases: ['tutorial', 'guide', 'how-to', 'walkthrough', 'step-by-step', 'masterclass', 'crash course'], category: 'Tutorials & Guides', baseWeight: 90 },
  { tag: 'cheatsheet', aliases: ['cheatsheet', 'reference', 'commands', 'cheat sheet', 'summary table'], category: 'Tutorials & Guides', baseWeight: 88 },
  { tag: 'architecture', aliases: ['architecture', 'system design', 'distributed systems', 'patterns'], category: 'Tutorials & Guides', baseWeight: 88 },

  // Research & Papers
  { tag: 'research-paper', aliases: ['arxiv', 'paper', 'research', 'benchmark', 'empirical', 'methodology', 'thesis'], category: 'Research & Papers', baseWeight: 92 },

  // Reddit & Community
  { tag: 'reddit-discussion', aliases: ['reddit', 'r/', 'subreddit', 'thread', 'comments', 'consensus', 'ama'], category: 'Reddit Discussions', baseWeight: 88 },

  // Social & Reels
  { tag: 'instagram-reel', aliases: ['instagram', 'reel', 'reels', 'ig short', 'story', 'carousel'], category: 'Instagram & Social', baseWeight: 90 },
  { tag: 'youtube-video', aliases: ['youtube', 'video', 'channel', 'playlist', 'watch'], category: 'Tutorials & Guides', baseWeight: 85 },
];

/**
 * Tokenizes text and extracts normalized n-grams (1-word, 2-word, 3-word combinations)
 */
function extractTokens(text: string): { words: string[]; rawText: string; phrases: string[] } {
  if (!text) return { words: [], rawText: '', phrases: [] };

  const clean = text
    .toLowerCase()
    .replace(/[^\w\s-./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = clean
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));

  const phrases: string[] = [];
  for (let i = 0; i < words.length; i++) {
    phrases.push(words[i]);
    if (i + 1 < words.length) phrases.push(`${words[i]} ${words[i + 1]}`);
    if (i + 2 < words.length) phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }

  return { words, rawText: clean, phrases };
}

/**
 * Detects URL Platform
 */
export function detectPlatformFromUrl(url: string): PlatformType {
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

/**
 * Extracts keywords, ranks tag suggestions, and determines best category based on Title, Description, Notes, and URL.
 * Runs instantly on the client-side or server-side before form submission.
 */
export function analyzeAndSuggestTags(input: {
  url?: string;
  title?: string;
  description?: string;
  notes?: string;
  platformOverride?: PlatformType;
}): AutoTaggingResult {
  const url = input.url || '';
  const title = input.title || '';
  const description = input.description || '';
  const notes = input.notes || '';
  const platform = input.platformOverride || (url ? detectPlatformFromUrl(url) : 'other');

  const titleTokens = extractTokens(title);
  const descTokens = extractTokens(description);
  const notesTokens = extractTokens(notes);
  const urlTokens = extractTokens(url.replace(/https?:\/\//g, '').replace(/[/_.-]/g, ' '));

  const tagScores = new Map<string, { tag: string; score: number; matchedIn: 'title' | 'description' | 'url' | 'domain'; reason: string; category: string }>();
  const categoryScores = new Map<string, number>();

  // Category initial weighting based on detected platform
  switch (platform) {
    case 'github':
      categoryScores.set('Dev & Tech', (categoryScores.get('Dev & Tech') || 0) + 30);
      tagScores.set('github', { tag: 'github', score: 85, matchedIn: 'url', reason: 'GitHub repository URL', category: 'Dev & Tech' });
      tagScores.set('open-source', { tag: 'open-source', score: 75, matchedIn: 'url', reason: 'Open source project', category: 'Dev & Tech' });
      break;
    case 'reddit_post':
    case 'reddit_comment':
      categoryScores.set('Reddit Discussions', (categoryScores.get('Reddit Discussions') || 0) + 40);
      tagScores.set('reddit', { tag: 'reddit', score: 85, matchedIn: 'url', reason: 'Reddit community thread', category: 'Reddit Discussions' });
      if (platform === 'reddit_comment') {
        tagScores.set('reddit-comment', { tag: 'reddit-comment', score: 90, matchedIn: 'url', reason: 'Direct comment permalink', category: 'Reddit Discussions' });
      }
      break;
    case 'instagram_short':
      categoryScores.set('Instagram & Social', (categoryScores.get('Instagram & Social') || 0) + 40);
      tagScores.set('instagram', { tag: 'instagram', score: 85, matchedIn: 'url', reason: 'Instagram Reel/Post', category: 'Instagram & Social' });
      tagScores.set('reels', { tag: 'reels', score: 80, matchedIn: 'url', reason: 'Short-form visual media', category: 'Instagram & Social' });
      break;
    case 'youtube':
      categoryScores.set('Tutorials & Guides', (categoryScores.get('Tutorials & Guides') || 0) + 20);
      tagScores.set('youtube', { tag: 'youtube', score: 85, matchedIn: 'url', reason: 'YouTube video', category: 'Tutorials & Guides' });
      break;
    case 'paper':
      categoryScores.set('Research & Papers', (categoryScores.get('Research & Papers') || 0) + 45);
      tagScores.set('research-paper', { tag: 'research-paper', score: 90, matchedIn: 'url', reason: 'Academic paper repository', category: 'Research & Papers' });
      break;
    default:
      break;
  }

  // Evaluate against Taxonomy
  for (const rule of TAXONOMY) {
    let bestScore = 0;
    let matchedLocation: 'title' | 'description' | 'url' | 'domain' = 'title';
    let matchKeyword = '';

    for (const alias of rule.aliases) {
      const aliasClean = alias.toLowerCase();

      // Check in Title (Highest weight: 1.5x)
      if (titleTokens.rawText.includes(aliasClean)) {
        const score = (rule.baseWeight || 80) * 1.05;
        if (score > bestScore) {
          bestScore = score;
          matchedLocation = 'title';
          matchKeyword = alias;
        }
      }
      // Check in Description / Notes (Weight: 1.0x)
      else if (descTokens.rawText.includes(aliasClean) || notesTokens.rawText.includes(aliasClean)) {
        const score = (rule.baseWeight || 80) * 0.92;
        if (score > bestScore) {
          bestScore = score;
          matchedLocation = 'description';
          matchKeyword = alias;
        }
      }
      // Check in URL / Domain (Weight: 0.85x)
      else if (urlTokens.rawText.includes(aliasClean.replace(/\s+/g, ''))) {
        const score = (rule.baseWeight || 80) * 0.82;
        if (score > bestScore) {
          bestScore = score;
          matchedLocation = 'url';
          matchKeyword = alias;
        }
      }
    }

    if (bestScore > 0) {
      const confidence = Math.min(99, Math.round(bestScore));
      const reason =
        matchedLocation === 'title'
          ? `Matched keyword "${matchKeyword}" in title`
          : matchedLocation === 'description'
          ? `Found term "${matchKeyword}" in description/notes`
          : `Matched keyword "${matchKeyword}" in URL path`;

      tagScores.set(rule.tag, {
        tag: rule.tag,
        score: confidence,
        matchedIn: matchedLocation,
        reason,
        category: rule.category,
      });

      // Increase category score
      categoryScores.set(rule.category, (categoryScores.get(rule.category) || 0) + confidence);
    }
  }

  // Extract additional distinctive single-word keywords from Title if not already in taxonomy
  for (const word of titleTokens.words) {
    if (word.length >= 4 && !STOPWORDS.has(word) && !tagScores.has(word)) {
      // Check if word appears 1+ times or has technical flair
      const isTechnical = /[0-9]|api|db|ui|ux|web|ai|dev|bot|rag|cli|app/.test(word);
      if (isTechnical) {
        tagScores.set(word, {
          tag: word,
          score: 72,
          matchedIn: 'title',
          reason: `Distinctive keyword "${word}" in title`,
          category: 'Dev & Tech',
        });
      }
    }
  }

  // Rank tag suggestions
  const suggestedTags: TagSuggestion[] = Array.from(tagScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((item) => ({
      tag: item.tag,
      confidence: item.score,
      matchedIn: item.matchedIn,
      reason: item.reason,
    }));

  // Determine Best Category
  const defaultCategories = [
    'Dev & Tech',
    'AI & Machine Learning',
    'Design & UI',
    'Reddit Discussions',
    'Instagram & Social',
    'Tutorials & Guides',
    'Research & Papers',
    'Productivity',
    'Other',
  ];

  let bestCategory = 'Dev & Tech';
  let highestCatScore = 0;

  for (const [cat, score] of categoryScores.entries()) {
    if (score > highestCatScore) {
      highestCatScore = score;
      bestCategory = cat;
    }
  }

  if (highestCatScore === 0) {
    if (platform === 'instagram_short') bestCategory = 'Instagram & Social';
    else if (platform === 'reddit_post' || platform === 'reddit_comment') bestCategory = 'Reddit Discussions';
    else if (platform === 'paper') bestCategory = 'Research & Papers';
    else if (platform === 'youtube') bestCategory = 'Tutorials & Guides';
    else bestCategory = 'Dev & Tech';
  }

  const categoryConfidence = Math.min(98, Math.max(65, Math.round(highestCatScore || 70)));
  const categoryReason =
    highestCatScore > 0
      ? `Strong correlation with ${suggestedTags.filter(t => tagScores.get(t.tag)?.category === bestCategory).length} extracted keywords`
      : `Recommended default based on detected ${platform} format`;

  const extractedKeywords = Array.from(
    new Set([...titleTokens.words.slice(0, 8), ...descTokens.words.slice(0, 6)])
  ).filter((w) => w.length > 2);

  return {
    suggestedTags,
    suggestedCategory: {
      category: bestCategory,
      confidence: categoryConfidence,
      reason: categoryReason,
    },
    extractedKeywords,
    platform,
  };
}
