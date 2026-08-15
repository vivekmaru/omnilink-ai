import { LinkItem, PlatformType, ReadStatus } from '../types';

export type ExportFormatPreset = 'obsidian' | 'notion' | 'standard';
export type GroupingOption = 'none' | 'category' | 'platform' | 'status';

export interface MarkdownExportOptions {
  preset: ExportFormatPreset;
  includeTitleAndUrl: boolean;
  includeSummary: boolean;
  includeTakeaways: boolean;
  includeCodeSnippets: boolean;
  includeQuotes: boolean;
  includeTags: boolean;
  includeCategory: boolean;
  includePlatform: boolean;
  includeNotes: boolean;
  includeReadStatus: boolean;
  includeReadingTime: boolean;
  includeDate: boolean;
  useWikilinksForTags: boolean; // [[tag]] in obsidian vs #tag
  includeFrontmatter: boolean; // YAML frontmatter block for Obsidian
  groupBy: GroupingOption;
}

export const defaultExportOptions: MarkdownExportOptions = {
  preset: 'obsidian',
  includeTitleAndUrl: true,
  includeSummary: true,
  includeTakeaways: true,
  includeCodeSnippets: true,
  includeQuotes: true,
  includeTags: true,
  includeCategory: true,
  includePlatform: true,
  includeNotes: true,
  includeReadStatus: true,
  includeReadingTime: true,
  includeDate: true,
  useWikilinksForTags: false,
  includeFrontmatter: true,
  groupBy: 'none',
};

const getPlatformLabel = (p: PlatformType): string => {
  switch (p) {
    case 'github':
      return 'GitHub';
    case 'reddit_post':
      return 'Reddit Post';
    case 'reddit_comment':
      return 'Reddit Comment';
    case 'instagram_short':
      return 'Instagram Reel/Short';
    case 'youtube':
      return 'YouTube';
    case 'twitter_x':
      return 'X / Twitter';
    case 'paper':
      return 'ArXiv Paper';
    case 'article':
      return 'Article';
    default:
      return 'Web Link';
  }
};

const getStatusLabel = (s: ReadStatus): string => {
  switch (s) {
    case 'unread':
      return 'Unread';
    case 'reading':
      return 'Reading';
    case 'read':
      return 'Reviewed';
  }
};

/**
 * Detect language hint from code content
 */
function detectCodeLanguage(code: string): string {
  const trimmed = code.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.includes('import React') || trimmed.includes('export const') || trimmed.includes(': string') || trimmed.includes('interface ')) return 'ts';
  if (trimmed.includes('def ') || trimmed.includes('import ') || trimmed.includes('print(')) return 'python';
  if (trimmed.includes('SELECT ') || trimmed.includes('FROM ') || trimmed.includes('WHERE ')) return 'sql';
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) return 'html';
  if (trimmed.includes('npm install') || trimmed.includes('git ') || trimmed.includes('curl ')) return 'bash';
  return '';
}

/**
 * Format an individual link item according to the chosen preset and options
 */
export function formatSingleLinkMarkdown(
  link: LinkItem,
  options: MarkdownExportOptions,
  headingLevel = 2
): string {
  const hPrefix = '#'.repeat(headingLevel);
  const subHPrefix = '#'.repeat(headingLevel + 1);

  const tldr = link.summary?.tldr || link.aiSummary?.tldr || link.description || '';
  const takeaways =
    link.summary?.keyTakeaways ||
    link.summary?.takeaways ||
    link.aiSummary?.takeaways ||
    link.aiSummary?.keyTakeaways ||
    [];
  const codeSnippets =
    link.summary?.codeSnippets || link.aiSummary?.codeSnippets || [];
  const quotes =
    link.summary?.quotes ||
    (link.summary?.quote ? [link.summary.quote] : []) ||
    (link.aiSummary?.quote ? [link.aiSummary.quote] : []);

  const readTime = link.aiSummary?.estimatedReadTimeMinutes || link.readingTimeMinutes;
  const platformName = getPlatformLabel(link.platform);
  const statusName = getStatusLabel(link.readStatus);

  const lines: string[] = [];

  // Title with link
  if (options.includeTitleAndUrl) {
    const cleanTitle = (link.title || link.url).replace(/[\[\]]/g, '');
    lines.push(`${hPrefix} [${cleanTitle}](${link.url})`);
  } else {
    lines.push(`${hPrefix} ${link.title || link.url}`);
  }

  // Formatting by preset:
  if (options.preset === 'obsidian') {
    // --- Obsidian Callout Format ---
    // Metadata Callout
    const metaItems: string[] = [];
    if (options.includePlatform) metaItems.push(`- **Platform**: \`${platformName}\``);
    if (options.includeCategory && link.category) metaItems.push(`- **Category**: ${link.category}`);
    if (options.includeReadStatus) {
      const checkbox = link.readStatus === 'read' ? '[x]' : '[ ]';
      metaItems.push(`- **Status**: ${checkbox} ${statusName}`);
    }
    if (options.includeReadingTime && readTime) metaItems.push(`- **Est. Read Time**: ${readTime} min`);
    if (options.includeDate && link.createdAt) {
      metaItems.push(`- **Saved**: ${new Date(link.createdAt).toISOString().split('T')[0]}`);
    }
    if (options.includeTags && link.tags && link.tags.length > 0) {
      const tagsFormatted = link.tags
        .map((t) => (options.useWikilinksForTags ? `[[${t}]]` : `#${t.replace(/\s+/g, '-')}`))
        .join(' ');
      metaItems.push(`- **Tags**: ${tagsFormatted}`);
    }

    if (metaItems.length > 0) {
      lines.push(`> [!info] Metadata`);
      metaItems.forEach((item) => lines.push(`> ${item}`));
      lines.push('');
    }

    // Summary Callout
    if (options.includeSummary && tldr) {
      lines.push(`> [!abstract] Summary`);
      lines.push(`> ${tldr}`);
      lines.push('');
    }

    // Key Takeaways Callout
    if (options.includeTakeaways && takeaways.length > 0) {
      lines.push(`> [!tip] Key Takeaways`);
      takeaways.forEach((k) => lines.push(`> - ${k}`));
      lines.push('');
    }

    // Discussion / Notable Quotes
    if (options.includeQuotes && quotes.length > 0) {
      lines.push(`> [!quote] Community & Discussion Quotes`);
      quotes.forEach((q) => lines.push(`> "${q}"`));
      lines.push('');
    }

    // Code Snippets
    if (options.includeCodeSnippets && codeSnippets.length > 0) {
      lines.push(`${subHPrefix} Extracted Code Snippets`);
      codeSnippets.forEach((snippet, idx) => {
        const lang = detectCodeLanguage(snippet);
        if (codeSnippets.length > 1) {
          lines.push(`*Snippet ${idx + 1}:*`);
        }
        lines.push(`\`\`\`${lang}`);
        lines.push(snippet.trim());
        lines.push('```');
      });
      lines.push('');
    }

    // Personal Notes
    if (options.includeNotes && link.notes?.trim()) {
      lines.push(`> [!note] Personal Notes`);
      lines.push(`> ${link.notes.trim()}`);
      lines.push('');
    }
  } else if (options.preset === 'notion') {
    // --- Notion Format (Optimized for Notion Markdown Paste Conversion) ---
    const metaParts: string[] = [];
    if (options.includePlatform) metaParts.push(`**Platform**: ${platformName}`);
    if (options.includeCategory && link.category) metaParts.push(`**Category**: ${link.category}`);
    if (options.includeReadStatus) {
      const statusIcon = link.readStatus === 'read' ? '✅' : link.readStatus === 'reading' ? '⏳' : '📥';
      metaParts.push(`**Status**: ${statusIcon} ${statusName}`);
    }
    if (options.includeReadingTime && readTime) metaParts.push(`⏱️ ${readTime} min`);

    if (metaParts.length > 0 || (options.includeTags && link.tags?.length)) {
      lines.push(`> 🔗 **URL**: ${link.url}`);
      if (metaParts.length > 0) {
        lines.push(`> 📌 ${metaParts.join(' • ')}`);
      }
      if (options.includeTags && link.tags && link.tags.length > 0) {
        const tagsStr = link.tags.map((t) => `\`${t}\``).join(', ');
        lines.push(`> 🏷️ **Tags**: ${tagsStr}`);
      }
      lines.push('');
    }

    // Summary
    if (options.includeSummary && tldr) {
      lines.push(`${subHPrefix} 💡 Summary`);
      lines.push(tldr);
      lines.push('');
    }

    // Takeaways
    if (options.includeTakeaways && takeaways.length > 0) {
      lines.push(`${subHPrefix} 🎯 Key Takeaways`);
      takeaways.forEach((k) => lines.push(`- ${k}`));
      lines.push('');
    }

    // Quotes
    if (options.includeQuotes && quotes.length > 0) {
      lines.push(`${subHPrefix} 💬 Notable Quotes`);
      quotes.forEach((q) => lines.push(`> "${q}"`));
      lines.push('');
    }

    // Code Snippets
    if (options.includeCodeSnippets && codeSnippets.length > 0) {
      lines.push(`${subHPrefix} 💻 Code Snippets`);
      codeSnippets.forEach((snippet, idx) => {
        const lang = detectCodeLanguage(snippet);
        if (codeSnippets.length > 1) {
          lines.push(`**Snippet ${idx + 1}:**`);
        }
        lines.push(`\`\`\`${lang}`);
        lines.push(snippet.trim());
        lines.push('```');
        lines.push('');
      });
    }

    // Personal Notes
    if (options.includeNotes && link.notes?.trim()) {
      lines.push(`${subHPrefix} 📝 Notes`);
      lines.push(link.notes.trim());
      lines.push('');
    }
  } else {
    // --- Standard GitHub Flavored Markdown ---
    const metaParts: string[] = [];
    if (options.includePlatform) metaParts.push(`**Platform**: \`${platformName}\``);
    if (options.includeCategory && link.category) metaParts.push(`**Category**: *${link.category}*`);
    if (options.includeReadStatus) metaParts.push(`**Status**: ${statusName}`);
    if (options.includeReadingTime && readTime) metaParts.push(`**Read Time**: ${readTime}m`);
    if (options.includeDate && link.createdAt) {
      metaParts.push(`**Saved**: ${new Date(link.createdAt).toLocaleDateString()}`);
    }

    if (metaParts.length > 0) {
      lines.push(metaParts.join(' | '));
      lines.push('');
    }

    if (options.includeTags && link.tags && link.tags.length > 0) {
      lines.push(`**Tags**: ` + link.tags.map((t) => `\`#${t}\``).join(' '));
      lines.push('');
    }

    if (options.includeSummary && tldr) {
      lines.push(`**Summary (TL;DR)**:`);
      lines.push(`> ${tldr}`);
      lines.push('');
    }

    if (options.includeTakeaways && takeaways.length > 0) {
      lines.push(`**Key Takeaways**:`);
      takeaways.forEach((k) => lines.push(`- ${k}`));
      lines.push('');
    }

    if (options.includeQuotes && quotes.length > 0) {
      lines.push(`**Quotes**:`);
      quotes.forEach((q) => lines.push(`> "${q}"`));
      lines.push('');
    }

    if (options.includeCodeSnippets && codeSnippets.length > 0) {
      lines.push(`**Code Snippets**:`);
      codeSnippets.forEach((snippet) => {
        const lang = detectCodeLanguage(snippet);
        lines.push(`\`\`\`${lang}`);
        lines.push(snippet.trim());
        lines.push('```');
      });
      lines.push('');
    }

    if (options.includeNotes && link.notes?.trim()) {
      lines.push(`**Personal Notes**:`);
      lines.push(link.notes.trim());
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

/**
 * Generate full Markdown document for a collection of links
 */
export function generateMarkdownExport(
  links: LinkItem[],
  options: MarkdownExportOptions = defaultExportOptions
): string {
  if (!links || links.length === 0) {
    return '# OmniLink Export\n\nNo links selected for export.';
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const nowFormatted = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const docLines: string[] = [];

  // Frontmatter (for Obsidian preset or if requested)
  if (options.preset === 'obsidian' && options.includeFrontmatter) {
    const allTags = Array.from(new Set(links.flatMap((l) => l.tags || []))).slice(0, 10);
    docLines.push('---');
    docLines.push(`title: OmniLink Knowledge Export`);
    docLines.push(`date: ${dateStr}`);
    docLines.push(`total_items: ${links.length}`);
    docLines.push(`target: obsidian`);
    docLines.push(`tags:`);
    docLines.push(`  - omnilink`);
    docLines.push(`  - knowledge-base`);
    allTags.forEach((t) => docLines.push(`  - ${t.replace(/\s+/g, '-')}`));
    docLines.push('---');
    docLines.push('');
  }

  // Document Heading
  docLines.push(`# OmniLink Knowledge Export (${links.length} ${links.length === 1 ? 'item' : 'items'})`);
  docLines.push(`*Generated on ${nowFormatted} for ${options.preset === 'obsidian' ? 'Obsidian' : options.preset === 'notion' ? 'Notion' : 'Markdown'}*`);
  docLines.push('');
  docLines.push('---');
  docLines.push('');

  // Grouping logic
  if (options.groupBy === 'category') {
    const categoriesMap = new Map<string, LinkItem[]>();
    links.forEach((l) => {
      const cat = l.category || 'Uncategorized';
      const existing = categoriesMap.get(cat) || [];
      existing.push(l);
      categoriesMap.set(cat, existing);
    });

    categoriesMap.forEach((categoryLinks, categoryName) => {
      docLines.push(`## 📁 ${categoryName} (${categoryLinks.length})`);
      docLines.push('');
      categoryLinks.forEach((link) => {
        docLines.push(formatSingleLinkMarkdown(link, options, 3));
      });
    });
  } else if (options.groupBy === 'platform') {
    const platformsMap = new Map<PlatformType, LinkItem[]>();
    links.forEach((l) => {
      const existing = platformsMap.get(l.platform) || [];
      existing.push(l);
      platformsMap.set(l.platform, existing);
    });

    platformsMap.forEach((platformLinks, platform) => {
      docLines.push(`## 🌐 ${getPlatformLabel(platform)} (${platformLinks.length})`);
      docLines.push('');
      platformLinks.forEach((link) => {
        docLines.push(formatSingleLinkMarkdown(link, options, 3));
      });
    });
  } else if (options.groupBy === 'status') {
    const statusMap: Record<ReadStatus, LinkItem[]> = {
      unread: [],
      reading: [],
      read: [],
    };
    links.forEach((l) => {
      statusMap[l.readStatus]?.push(l);
    });

    const statusOrder: ReadStatus[] = ['unread', 'reading', 'read'];
    statusOrder.forEach((st) => {
      const stLinks = statusMap[st];
      if (stLinks.length > 0) {
        const icon = st === 'read' ? '✅' : st === 'reading' ? '⏳' : '📥';
        docLines.push(`## ${icon} ${getStatusLabel(st)} (${stLinks.length})`);
        docLines.push('');
        stLinks.forEach((link) => {
          docLines.push(formatSingleLinkMarkdown(link, options, 3));
        });
      }
    });
  } else {
    // Flat sequential list
    links.forEach((link) => {
      docLines.push(formatSingleLinkMarkdown(link, options, 2));
    });
  }

  return docLines.join('\n');
}

/**
 * Trigger download of Markdown file in browser
 */
export function downloadMarkdownFile(content: string, filename = 'omnilink-export.md') {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
