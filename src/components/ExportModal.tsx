import React, { useState, useMemo } from 'react';
import {
  X,
  FileText,
  Copy,
  Check,
  Download,
  Sparkles,
  Layers,
  Code2,
  Quote,
  Settings,
  Folder,
  Globe,
  CheckSquare,
  Eye,
  BookOpen,
  ArrowRight,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { LinkItem } from '../types';
import {
  ExportFormatPreset,
  GroupingOption,
  MarkdownExportOptions,
  defaultExportOptions,
  generateMarkdownExport,
  downloadMarkdownFile,
} from '../services/markdownExporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allLinks: LinkItem[];
  filteredLinks: LinkItem[];
  selectedIds: string[];
  initialSelectedLink?: LinkItem | null;
  onToast?: (type: 'success' | 'info' | 'error' | 'ai', message: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  allLinks,
  filteredLinks,
  selectedIds,
  initialSelectedLink,
  onToast,
}) => {
  if (!isOpen) return null;

  // Determine initial scope: If single link passed -> single; else if selectedIds exist -> selected; else filtered/all
  const [scope, setScope] = useState<'selected' | 'filtered' | 'all' | 'single'>(() => {
    if (initialSelectedLink) return 'single';
    if (selectedIds.length > 0) return 'selected';
    if (filteredLinks.length < allLinks.length && filteredLinks.length > 0) return 'filtered';
    return 'all';
  });

  const [options, setOptions] = useState<MarkdownExportOptions>(defaultExportOptions);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'options'>('preview');

  // Compute active links based on scope
  const targetLinks = useMemo<LinkItem[]>(() => {
    if (scope === 'single' && initialSelectedLink) {
      return [initialSelectedLink];
    }
    if (scope === 'selected') {
      const selected = allLinks.filter((l) => selectedIds.includes(l.id));
      return selected.length > 0 ? selected : allLinks;
    }
    if (scope === 'filtered') {
      return filteredLinks;
    }
    return allLinks;
  }, [scope, initialSelectedLink, selectedIds, allLinks, filteredLinks]);

  // Generate Markdown output in real-time
  const markdownOutput = useMemo(() => {
    return generateMarkdownExport(targetLinks, options);
  }, [targetLinks, options]);

  // Document metrics
  const metrics = useMemo(() => {
    const lines = markdownOutput.split('\n').length;
    const words = markdownOutput.trim().split(/\s+/).filter(Boolean).length;
    const chars = markdownOutput.length;
    const codeSnippetCount = targetLinks.reduce(
      (acc, l) => acc + (l.summary?.codeSnippets?.length || l.aiSummary?.codeSnippets?.length || 0),
      0
    );
    return { lines, words, chars, codeSnippetCount };
  }, [markdownOutput, targetLinks]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdownOutput);
      setCopied(true);
      if (onToast) {
        onToast(
          'success',
          `Copied ${targetLinks.length} ${targetLinks.length === 1 ? 'link' : 'links'} formatted for ${
            options.preset === 'obsidian' ? 'Obsidian' : options.preset === 'notion' ? 'Notion' : 'Markdown'
          } to clipboard!`
        );
      }
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy markdown:', e);
      if (onToast) onToast('error', 'Failed to copy to clipboard');
    }
  };

  const handleDownload = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `omnilink-${options.preset}-export-${dateStr}.md`;
    downloadMarkdownFile(markdownOutput, filename);
    if (onToast) {
      onToast('success', `Downloaded ${filename}`);
    }
  };

  const updateOption = <K extends keyof MarkdownExportOptions>(
    key: K,
    value: MarkdownExportOptions[K]
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div
      id="export-markdown-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="export-markdown-modal"
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden text-slate-900 dark:text-[#f7f6f3] transition-all"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] flex items-center justify-center border border-[#d97757]/20 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-newsreader text-xl font-medium tracking-tight flex items-center gap-2.5">
                Export to Markdown
                <span className="font-mono text-[10px] uppercase font-normal px-2 py-0.5 rounded bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] border border-[#d97757]/20">
                  {options.preset.toUpperCase()}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Formatted for 1-click copy-pasting or file importing into Obsidian, Notion, and Logseq
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Scope & Preset Switchers */}
        <div className="px-5 py-3 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Target Scope Selection */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-mono text-[11px] text-slate-400 mr-1 font-medium">Export:</span>
            {initialSelectedLink && (
              <button
                onClick={() => setScope('single')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  scope === 'single'
                    ? 'bg-[#d97757] text-white shadow-2xs font-semibold'
                    : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Current Link
              </button>
            )}

            <button
              onClick={() => setScope('selected')}
              disabled={selectedIds.length === 0}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                scope === 'selected'
                  ? 'bg-[#d97757] text-white shadow-2xs font-semibold'
                  : selectedIds.length === 0
                  ? 'opacity-40 cursor-not-allowed bg-black/5 dark:bg-white/5 text-slate-400'
                  : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Selected ({selectedIds.length})
            </button>

            <button
              onClick={() => setScope('filtered')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                scope === 'filtered'
                  ? 'bg-[#d97757] text-white shadow-2xs font-semibold'
                  : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Filtered ({filteredLinks.length})
            </button>

            <button
              onClick={() => setScope('all')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                scope === 'all'
                  ? 'bg-[#d97757] text-white shadow-2xs font-semibold'
                  : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All Links ({allLinks.length})
            </button>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
            <button
              onClick={() => updateOption('preset', 'obsidian')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                options.preset === 'obsidian'
                  ? 'bg-white dark:bg-[#1f1e1c] shadow-2xs text-[#d97757] dark:text-[#e08264] font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Obsidian Preset</span>
            </button>

            <button
              onClick={() => updateOption('preset', 'notion')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                options.preset === 'notion'
                  ? 'bg-white dark:bg-[#1f1e1c] shadow-2xs text-[#d97757] dark:text-[#e08264] font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Notion Preset</span>
            </button>

            <button
              onClick={() => updateOption('preset', 'standard')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                options.preset === 'standard'
                  ? 'bg-white dark:bg-[#1f1e1c] shadow-2xs text-slate-900 dark:text-slate-100 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Standard GFM</span>
            </button>
          </div>
        </div>

        {/* Sub-nav Tabs: Preview vs Options */}
        <div className="flex border-b border-black/10 dark:border-white/10 px-5 text-xs font-medium shrink-0">
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-2 px-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'preview'
                ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264] font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Markdown Live Preview</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 text-slate-500">
              {metrics.lines} lines
            </span>
          </button>

          <button
            onClick={() => setActiveTab('options')}
            className={`py-2 px-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'options'
                ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264] font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Formatting Settings</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto min-h-[320px] max-h-[500px]">
          {activeTab === 'preview' ? (
            <div className="p-5 flex flex-col h-full space-y-3">
              {/* Output Preview Window */}
              <div className="relative flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-[#f5f3ee] dark:bg-[#141413] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-3.5 py-2 border-b border-black/5 dark:border-white/5 bg-black/[0.03] dark:bg-white/[0.03] text-[11px] font-mono text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span>
                      {options.preset === 'obsidian'
                        ? 'Obsidian Callouts & Frontmatter'
                        : options.preset === 'notion'
                        ? 'Notion Blocks Markdown'
                        : 'GitHub Flavored Markdown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{metrics.words.toLocaleString()} words</span>
                    <span>•</span>
                    <span>{metrics.chars.toLocaleString()} chars</span>
                    {metrics.codeSnippetCount > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {metrics.codeSnippetCount} code snippets
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto font-mono text-[12px] leading-relaxed select-text whitespace-pre text-slate-800 dark:text-[#e8e6e1] max-h-[380px]">
                  {markdownOutput}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Section 1: Content Inclusions */}
              <div className="space-y-3">
                <h4 className="font-mono text-xs uppercase tracking-wider text-[#d97757] dark:text-[#e08264] font-semibold flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" /> Included Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 p-2.5 rounded-lg border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={options.includeTitleAndUrl}
                      onChange={(e) => updateOption('includeTitleAndUrl', e.target.checked)}
                      className="rounded text-[#d97757] focus:ring-[#d97757]"
                    />
                    <div className="text-xs">
                      <div className="font-medium">Title & Clickable URL</div>
                      <div className="text-[11px] text-slate-400">Link anchor header with target URI</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-lg border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={options.includeSummary}
                      onChange={(e) => updateOption('includeSummary', e.target.checked)}
                      className="rounded text-[#d97757] focus:ring-[#d97757]"
                    />
                    <div className="text-xs">
                      <div className="font-medium">AI TL;DR Summary</div>
                      <div className="text-[11px] text-slate-400">Concise 1-sentence synthesis</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-lg border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={options.includeTakeaways}
                      onChange={(e) => updateOption('includeTakeaways', e.target.checked)}
                      className="rounded text-[#d97757] focus:ring-[#d97757]"
                    />
                    <div className="text-xs">
                      <div className="font-medium">Key Insights & Takeaways</div>
                      <div className="text-[11px] text-slate-400">Bulleted actionable points</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-lg border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={options.includeCodeSnippets}
                      onChange={(e) => updateOption('includeCodeSnippets', e.target.checked)}
                      className="rounded text-[#d97757] focus:ring-[#d97757]"
                    />
                    <div className="text-xs">
                      <div className="font-medium">Fenced Code Snippets</div>
                      <div className="text-[11px] text-slate-400">With language detection tag</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-lg border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={options.includeQuotes}
                      onChange={(e) => updateOption('includeQuotes', e.target.checked)}
                      className="rounded text-[#d97757] focus:ring-[#d97757]"
                    />
                    <div className="text-xs">
                      <div className="font-medium">Discussion & Quotes</div>
                      <div className="text-[11px] text-slate-400">Community highlights</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-lg border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={options.includeNotes}
                      onChange={(e) => updateOption('includeNotes', e.target.checked)}
                      className="rounded text-[#d97757] focus:ring-[#d97757]"
                    />
                    <div className="text-xs">
                      <div className="font-medium">Personal Notes</div>
                      <div className="text-[11px] text-slate-400">User-authored annotations</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Section 2: Organization & Metadata */}
              <div className="space-y-3">
                <h4 className="font-mono text-xs uppercase tracking-wider text-[#d97757] dark:text-[#e08264] font-semibold flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" /> Grouping & Layout
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  {(
                    [
                      { id: 'none', label: 'Flat List', desc: 'Sequential' },
                      { id: 'category', label: 'By Category', desc: 'Grouped folders' },
                      { id: 'platform', label: 'By Platform', desc: 'GitHub, Reddit...' },
                      { id: 'status', label: 'By Status', desc: 'Unread / Read' },
                    ] as { id: GroupingOption; label: string; desc: string }[]
                  ).map((grp) => (
                    <button
                      key={grp.id}
                      onClick={() => updateOption('groupBy', grp.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        options.groupBy === grp.id
                          ? 'border-[#d97757] bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] font-semibold'
                          : 'border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:border-black/20'
                      }`}
                    >
                      <div className="text-xs">{grp.label}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{grp.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 3: Obsidian Specific */}
              {options.preset === 'obsidian' && (
                <div className="space-y-3 p-4 rounded-xl border border-[#d97757]/20 bg-[#d97757]/5">
                  <h4 className="font-mono text-xs uppercase tracking-wider text-[#d97757] dark:text-[#e08264] font-semibold flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" /> Obsidian Vault Enhancements
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-3 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.includeFrontmatter}
                        onChange={(e) => updateOption('includeFrontmatter', e.target.checked)}
                        className="rounded text-[#d97757] focus:ring-[#d97757]"
                      />
                      <div>
                        <div className="font-medium">YAML Frontmatter (---)</div>
                        <div className="text-[11px] text-slate-400">Dataview-compatible document tags and dates</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.useWikilinksForTags}
                        onChange={(e) => updateOption('useWikilinksForTags', e.target.checked)}
                        className="rounded text-[#d97757] focus:ring-[#d97757]"
                      />
                      <div>
                        <div className="font-medium">Use [[Wikilinks]] for Tags</div>
                        <div className="text-[11px] text-slate-400">Convert #tags into bi-directional [[links]]</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Action Bar */}
        <div className="p-4 px-6 border-t border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>Exporting</span>
            <span className="font-semibold text-slate-900 dark:text-[#f7f6f3]">
              {targetLinks.length} {targetLinks.length === 1 ? 'item' : 'items'}
            </span>
            <span>as</span>
            <span className="capitalize font-semibold text-[#d97757] dark:text-[#e08264]">
              {options.preset}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#272522] text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .md</span>
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#d97757] hover:bg-[#c66a4c] text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy for {options.preset === 'obsidian' ? 'Obsidian' : options.preset === 'notion' ? 'Notion' : 'Markdown'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
