import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Bookmark, Code2 } from 'lucide-react';
import { LinkItem } from '../types';

interface MarkdownRendererProps {
  content: string;
  links?: LinkItem[];
  onOpenLinkDetail?: (link: LinkItem) => void;
  className?: string;
}

// Code Block Component with Copy Button
const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl border border-black/10 dark:border-white/10 overflow-hidden bg-[#18181b] text-slate-200 text-xs font-mono">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-black/40 border-b border-white/5 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <Code2 className="w-3.5 h-3.5 text-[#d97757]" />
          <span className="font-semibold text-slate-300 uppercase">{language || 'code'}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto leading-relaxed text-slate-100 font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
};

// Inline Citation Pill Component
const CitationPill: React.FC<{
  citationId: string;
  links?: LinkItem[];
  onOpenLinkDetail?: (link: LinkItem) => void;
}> = ({ citationId, links, onOpenLinkDetail }) => {
  const cleanId = citationId.trim();
  const targetLink = links?.find((l) => l.id === cleanId || l.id.toLowerCase() === cleanId.toLowerCase());

  if (targetLink && onOpenLinkDetail) {
    return (
      <button
        type="button"
        onClick={() => onOpenLinkDetail(targetLink)}
        title={`View Source: "${targetLink.title}"`}
        className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] hover:bg-[#d97757]/20 border border-[#d97757]/30 transition-all cursor-pointer align-baseline shadow-2xs group"
      >
        <Bookmark className="w-2.5 h-2.5 opacity-70 group-hover:opacity-100" />
        <span className="truncate max-w-[140px]">{targetLink.title}</span>
        <ExternalLink className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <span
      title={`Reference ID: ${cleanId}`}
      className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-400 border border-black/5 dark:border-white/10 align-baseline"
    >
      <Bookmark className="w-2.5 h-2.5 opacity-60" />
      <span>{cleanId.replace(/^link-rss-/, 'rss:').replace(/^link-/, '')}</span>
    </span>
  );
};

// Parse inline formatting (Bold, Italic, Code, Citations, Links, Images)
export const renderInlineMarkdown = (
  text: string,
  links?: LinkItem[],
  onOpenLinkDetail?: (link: LinkItem) => void,
  keyPrefix = 'inline'
): React.ReactNode[] => {
  if (!text) return [];

  // Match citation [ID: xxx], link [label](url), image ![alt](url), inline code `code`, bold+italic ***x***, bold **x**, italic *x* or _x_, strikethrough ~~x~~
  const inlineRegex =
    /(\[ID:\s*[^\]]+\])|(!?\[[^\]]*\]\([^)]+\))|(`[^`]+`)|(\*\*\*[^*]+\*\*\*|___[^_]+___)|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*]+\*|_[^_]+_)|(~~[^~]+~~)/g;

  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${idx++}`;

    if (token.startsWith('[ID:') && token.endsWith(']')) {
      const id = token.slice(4, -1).trim();
      result.push(
        <CitationPill
          key={key}
          citationId={id}
          links={links}
          onOpenLinkDetail={onOpenLinkDetail}
        />
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      const code = token.slice(1, -1);
      result.push(
        <code
          key={key}
          className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[#d97757] dark:text-[#e08264] font-mono text-[0.9em] border border-black/5 dark:border-white/10"
        >
          {code}
        </code>
      );
    } else if (token.startsWith('![') && token.includes('](')) {
      const alt = token.slice(2, token.indexOf(']('));
      const url = token.slice(token.indexOf('](') + 2, -1);
      result.push(
        <img
          key={key}
          src={url}
          alt={alt}
          className="rounded-lg max-w-full my-2 border border-black/10 dark:border-white/10"
        />
      );
    } else if (token.startsWith('[') && token.includes('](')) {
      const label = token.slice(1, token.indexOf(']('));
      const url = token.slice(token.indexOf('](') + 2, -1);
      result.push(
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#d97757] dark:text-[#e08264] underline underline-offset-2 hover:opacity-80 transition-opacity font-medium"
        >
          {renderInlineMarkdown(label, links, onOpenLinkDetail, `${key}-lbl`)}
        </a>
      );
    } else if (
      (token.startsWith('***') && token.endsWith('***')) ||
      (token.startsWith('___') && token.endsWith('___'))
    ) {
      const inner = token.slice(3, -3);
      result.push(
        <strong key={key} className="font-bold">
          <em>{renderInlineMarkdown(inner, links, onOpenLinkDetail, `${key}-bi`)}</em>
        </strong>
      );
    } else if (
      (token.startsWith('**') && token.endsWith('**')) ||
      (token.startsWith('__') && token.endsWith('__'))
    ) {
      const inner = token.slice(2, -2);
      result.push(
        <strong key={key} className="font-bold text-slate-900 dark:text-[#f7f6f3]">
          {renderInlineMarkdown(inner, links, onOpenLinkDetail, `${key}-b`)}
        </strong>
      );
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      const inner = token.slice(1, -1);
      result.push(
        <em key={key} className="italic">
          {renderInlineMarkdown(inner, links, onOpenLinkDetail, `${key}-i`)}
        </em>
      );
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      const inner = token.slice(2, -2);
      result.push(
        <del key={key} className="line-through text-slate-400">
          {renderInlineMarkdown(inner, links, onOpenLinkDetail, `${key}-del`)}
        </del>
      );
    }

    lastIndex = inlineRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
};

// Main MarkdownRenderer Component
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  links,
  onOpenLinkDetail,
  className = '',
}) => {
  if (!content) return null;

  // Pre-process raw text into blocks
  const lines = content.split(/\r?\n/);
  const elements: React.ReactNode[] = [];

  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Fenced Code Block
    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      elements.push(
        <CodeBlock
          key={`code-${blockKey++}`}
          language={language}
          code={codeLines.join('\n')}
        />
      );
      continue;
    }

    // 2. Horizontal Rule
    if (/^(---|___|\*\*\*)\s*$/.test(line.trim())) {
      elements.push(
        <hr
          key={`hr-${blockKey++}`}
          className="border-t border-black/10 dark:border-white/10 my-4"
        />
      );
      i++;
      continue;
    }

    // 3. Headings (# Heading)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const inline = renderInlineMarkdown(headingText, links, onOpenLinkDetail, `h-${blockKey}`);

      if (level === 1) {
        elements.push(
          <h1
            key={`h1-${blockKey++}`}
            className="font-newsreader text-lg sm:text-xl font-bold text-slate-900 dark:text-[#f7f6f3] mt-4 mb-2 pb-1 border-b border-black/5 dark:border-white/5"
          >
            {inline}
          </h1>
        );
      } else if (level === 2) {
        elements.push(
          <h2
            key={`h2-${blockKey++}`}
            className="font-newsreader text-base sm:text-lg font-semibold text-slate-900 dark:text-[#f7f6f3] mt-3.5 mb-1.5"
          >
            {inline}
          </h2>
        );
      } else if (level === 3) {
        elements.push(
          <h3
            key={`h3-${blockKey++}`}
            className="font-newsreader text-sm sm:text-base font-semibold text-slate-900 dark:text-[#f7f6f3] mt-3 mb-1 text-[#d97757] dark:text-[#e08264]"
          >
            {inline}
          </h3>
        );
      } else {
        elements.push(
          <h4
            key={`h4-${blockKey++}`}
            className="font-newsreader text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mt-2 mb-1"
          >
            {inline}
          </h4>
        );
      }
      i++;
      continue;
    }

    // 4. Blockquotes (> quote)
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      elements.push(
        <blockquote
          key={`quote-${blockKey++}`}
          className="border-l-3 border-[#d97757] dark:border-[#e08264] bg-black/[0.02] dark:bg-white/[0.02] pl-3.5 py-1.5 my-2.5 rounded-r-lg text-slate-700 dark:text-slate-300 italic text-xs sm:text-sm"
        >
          {quoteLines.map((q, qIdx) => (
            <p key={qIdx} className="leading-relaxed my-0.5">
              {renderInlineMarkdown(q, links, onOpenLinkDetail, `quote-${blockKey}-${qIdx}`)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // 5. Table (| Header | Header |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        const isSeparator = /^\|?(\s*:?-+:?\s*\|?)+$/.test(tableLines[1]);
        const bodyRows = (isSeparator ? tableLines.slice(2) : tableLines.slice(1)).map((row) =>
          row
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())
        );

        elements.push(
          <div key={`table-${blockKey++}`} className="overflow-x-auto my-3 rounded-xl border border-black/10 dark:border-white/10">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10 text-slate-900 dark:text-[#f7f6f3] font-semibold">
                <tr>
                  {headerRow.map((cell, cIdx) => (
                    <th key={cIdx} className="px-3.5 py-2 font-mono">
                      {renderInlineMarkdown(cell, links, onOpenLinkDetail, `th-${blockKey}-${cIdx}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3.5 py-2 text-slate-700 dark:text-slate-300">
                        {renderInlineMarkdown(cell, links, onOpenLinkDetail, `td-${blockKey}-${rIdx}-${cIdx}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 6. Ordered & Unordered Lists (including nested sub-bullets)
    const isOrdered = /^\s*\d+\.\s+/.test(line);
    const isUnordered = /^\s*[-*+]\s+/.test(line);

    if (isOrdered || isUnordered) {
      const listItems: Array<{
        type: 'ordered' | 'unordered';
        indent: number;
        num?: string;
        text: string;
        children: string[];
      }> = [];

      while (i < lines.length) {
        const curLine = lines[i];
        const ordMatch = curLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
        const unordMatch = curLine.match(/^(\s*)([-*+])\s+(.*)$/);

        if (ordMatch) {
          listItems.push({
            type: 'ordered',
            indent: ordMatch[1].length,
            num: ordMatch[2],
            text: ordMatch[3],
            children: [],
          });
          i++;
        } else if (unordMatch) {
          // If indented or follows an item
          if (listItems.length > 0 && (unordMatch[1].length > 0 || isOrdered)) {
            listItems[listItems.length - 1].children.push(unordMatch[3]);
            i++;
          } else {
            listItems.push({
              type: 'unordered',
              indent: unordMatch[1].length,
              text: unordMatch[3],
              children: [],
            });
            i++;
          }
        } else if (curLine.trim() === '') {
          // Check if next line continues the list
          if (i + 1 < lines.length && /^\s*(\d+\.|[-*+])\s+/.test(lines[i + 1])) {
            i++;
          } else {
            break;
          }
        } else if (/^\s{2,}/.test(curLine) && listItems.length > 0) {
          // Indented continuation text
          listItems[listItems.length - 1].children.push(curLine.trim());
          i++;
        } else {
          break;
        }
      }

      if (isOrdered) {
        elements.push(
          <ol
            key={`ol-${blockKey++}`}
            className="space-y-2.5 my-2.5 list-none pl-0"
          >
            {listItems.map((item, itIdx) => (
              <li key={itIdx} className="space-y-1">
                <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  <span className="font-mono font-bold text-[#d97757] dark:text-[#e08264] shrink-0 text-xs mt-0.5">
                    {item.num || itIdx + 1}.
                  </span>
                  <div className="flex-1">
                    {renderInlineMarkdown(item.text, links, onOpenLinkDetail, `ol-${blockKey}-${itIdx}`)}
                  </div>
                </div>

                {item.children.length > 0 && (
                  <ul className="pl-6 space-y-1 mt-1 border-l border-black/5 dark:border-white/5 ml-2.5">
                    {item.children.map((sub, sIdx) => (
                      <li
                        key={sIdx}
                        className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed"
                      >
                        <span className="text-[#d97757]/70 dark:text-[#e08264]/70 shrink-0 text-[10px] mt-1">•</span>
                        <div className="flex-1">
                          {renderInlineMarkdown(sub, links, onOpenLinkDetail, `sub-${blockKey}-${itIdx}-${sIdx}`)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul
            key={`ul-${blockKey++}`}
            className="space-y-1.5 my-2.5 list-none pl-0"
          >
            {listItems.map((item, itIdx) => (
              <li key={itIdx} className="space-y-1">
                <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  <span className="text-[#d97757] dark:text-[#e08264] shrink-0 text-xs mt-0.5">•</span>
                  <div className="flex-1">
                    {renderInlineMarkdown(item.text, links, onOpenLinkDetail, `ul-${blockKey}-${itIdx}`)}
                  </div>
                </div>

                {item.children.length > 0 && (
                  <ul className="pl-5 space-y-1 mt-1 border-l border-black/5 dark:border-white/5 ml-1.5">
                    {item.children.map((sub, sIdx) => (
                      <li
                        key={sIdx}
                        className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed"
                      >
                        <span className="text-slate-400 shrink-0 text-[10px] mt-1">-</span>
                        <div className="flex-1">
                          {renderInlineMarkdown(sub, links, onOpenLinkDetail, `ul-sub-${blockKey}-${itIdx}-${sIdx}`)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        );
      }
      continue;
    }

    // 7. Empty Line / Paragraph Spacing
    if (line.trim() === '') {
      i++;
      continue;
    }

    // 8. Regular Paragraph (Collect consecutive non-empty lines)
    const pLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !/^\s*(\d+\.|[-*+])\s+/.test(lines[i]) &&
      !/^(---|___|\*\*\*)\s*$/.test(lines[i].trim()) &&
      !(lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|'))
    ) {
      pLines.push(lines[i]);
      i++;
    }

    if (pLines.length > 0) {
      elements.push(
        <p
          key={`p-${blockKey++}`}
          className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed my-2"
        >
          {renderInlineMarkdown(pLines.join(' '), links, onOpenLinkDetail, `p-${blockKey}`)}
        </p>
      );
    }
  }

  return <div className={`markdown-content space-y-1 ${className}`}>{elements}</div>;
};
