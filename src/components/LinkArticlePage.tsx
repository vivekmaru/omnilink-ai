import React, { useState } from 'react';
import {
  ExternalLink,
  Sparkles,
  Copy,
  Check,
  BookOpen,
  Send,
  FileDown,
  Rss,
  ArrowLeft,
  RotateCw,
} from 'lucide-react';
import { LinkItem, ReadStatus } from '../types';
import { ApiService } from '../services/api';
import { analyzeAndSuggestTags } from '../services/autoTagging';
import { MarkdownRenderer } from './MarkdownRenderer';

interface LinkArticlePageProps {
  link: LinkItem;
  onBack: () => void;
  onUpdateLink: (updated: LinkItem) => void;
  onOpenExportModal?: (link: LinkItem) => void;
}

const STATUS_OPTIONS: { value: ReadStatus; label: string }[] = [
  { value: 'unread', label: 'Unread' },
  { value: 'reading', label: 'Reading' },
  { value: 'read', label: 'Read' },
];

const fieldClass =
  'w-full px-3 py-2 text-sm bg-white dark:bg-[#18181b] border border-black/10 dark:border-white/10 rounded-lg focus:outline-none focus:border-[#d97757] text-slate-900 dark:text-[#f7f6f3] transition-colors';

const iconButtonClass =
  'p-2 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer';

const PanelSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
    {children}
  </section>
);

export const LinkArticlePage: React.FC<LinkArticlePageProps> = ({
  link,
  onBack,
  onUpdateLink,
  onOpenExportModal,
}) => {
  const [notes, setNotes] = useState(link.notes || '');
  const [category, setCategory] = useState(link.category);
  const [readStatus, setReadStatus] = useState<ReadStatus>(link.readStatus);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(link.tags || []);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSnippetIdx, setCopiedSnippetIdx] = useState<number | null>(null);

  const [readerLoading, setReaderLoading] = useState(false);
  const [copiedReaderMd, setCopiedReaderMd] = useState(false);

  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  let linkHost = link.url;
  try {
    linkHost = new URL(link.url).hostname.replace(/^www\./, '');
  } catch {
    /* keep the raw url */
  }

  const tldr = link.summary?.tldr || link.aiSummary?.tldr;
  const takeaways =
    link.summary?.keyTakeaways ||
    link.summary?.takeaways ||
    link.aiSummary?.takeaways ||
    link.aiSummary?.keyTakeaways ||
    [];
  const snippets = link.summary?.codeSnippets || link.aiSummary?.codeSnippets || [];
  const quotes =
    link.summary?.quotes ||
    (link.summary?.quote ? [link.summary.quote] : null) ||
    link.aiSummary?.quotes ||
    (link.aiSummary?.quote ? [link.aiSummary.quote] : []);
  const hasChanges =
    notes !== (link.notes || '') ||
    category !== link.category ||
    readStatus !== link.readStatus ||
    tags.join('\n') !== (link.tags || []).join('\n');

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(link.url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1500);
  };

  const handleCaptureReaderSnapshot = async () => {
    setReaderLoading(true);
    try {
      const snapshot = await ApiService.captureReaderSnapshot(link.id);
      onUpdateLink({ ...link, readerSnapshot: snapshot });
    } catch (err) {
      console.error('Failed to capture reader snapshot:', err);
    } finally {
      setReaderLoading(false);
    }
  };

  const handleCopyReaderMarkdown = () => {
    if (!link.readerSnapshot?.contentMarkdown) return;
    navigator.clipboard.writeText(link.readerSnapshot.contentMarkdown);
    setCopiedReaderMd(true);
    setTimeout(() => setCopiedReaderMd(false), 1500);
  };

  const handleCopySnippet = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippetIdx(idx);
    setTimeout(() => setCopiedSnippetIdx(null), 1500);
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    const clean = tagInput.trim().toLowerCase();
    if (!tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput('');
  };

  const handleSuggestTags = () => {
    const res = analyzeAndSuggestTags({
      url: link.url,
      title: link.title,
      description: link.description || link.summary?.tldr,
      notes,
    });
    const newTags = res.suggestedTags.map((s) => s.tag.toLowerCase()).filter((t) => !tags.includes(t));
    if (newTags.length > 0) {
      setTags([...tags, ...newTags]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await ApiService.updateLink(link.id, { notes, category, readStatus, tags });
      onUpdateLink(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (e) {
      console.error('Failed to update link:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAskAIAboutLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    try {
      const response = await ApiService.askRepository(
        `Focus specifically on the saved link titled "${link.title}" (URL: ${link.url}). Question: ${aiQuestion}`
      );
      setAiAnswer(response.answer);
    } catch (e) {
      setAiAnswer('Failed to retrieve AI analysis.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div
      id="link-article-page"
      role="article"
      aria-labelledby="link-article-title"
      className="h-full flex flex-col"
      style={{ backgroundColor: 'var(--card-bg)' }}
    >
      {/* Top bar: back, source, actions */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 border-b border-black/10 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-2 min-w-0 text-sm text-slate-500 dark:text-slate-400">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 -ml-2 mr-1 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            aria-label="Back to links"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          {link.feedTitle || link.isRssFeedItem ? <Rss className="w-3.5 h-3.5 shrink-0" /> : null}
          <span className="truncate capitalize">{link.feedTitle || link.platform.replace('_', ' ')}</span>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button type="button" onClick={handleCopyUrl} title="Copy link" aria-label="Copy link" className={iconButtonClass}>
            {copiedUrl ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
          {onOpenExportModal && (
            <button
              type="button"
              onClick={() => onOpenExportModal(link)}
              title="Export as Markdown"
              aria-label="Export as Markdown"
              className={iconButtonClass}
            >
              <FileDown className="w-4 h-4" />
            </button>
          )}
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 ml-1 px-3 py-1.5 rounded-full text-xs bg-[#d97757] hover:bg-[#c46243] text-white font-semibold transition-colors"
          >
            <span>Open original</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Article on the left, details panel on the right; stacked on narrow screens */}
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:flex">
        <div className="lg:flex-1 lg:min-w-0 lg:overflow-y-auto">
          <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 space-y-6">
            <header>
              <h1
                id="link-article-title"
                className="font-newsreader font-medium text-2xl sm:text-3xl text-slate-900 dark:text-[#f7f6f3] leading-tight"
              >
                {link.title || link.url}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-sm text-slate-500 dark:text-slate-400">
                {link.author && <span>By {link.author}</span>}
                {link.author && <span aria-hidden="true">·</span>}
                <span className="truncate max-w-sm">{linkHost}</span>
                {(link.readerSnapshot?.readingTimeMinutes || link.readingTimeMinutes) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{link.readerSnapshot?.readingTimeMinutes || link.readingTimeMinutes} min read</span>
                  </>
                )}
              </div>
            </header>

            {link.readerSnapshot ? (
              <>
                <article className="py-2">
                  <MarkdownRenderer content={link.readerSnapshot.contentMarkdown} variant="article" />
                </article>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 border-t border-black/10 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400">
                  <span>Saved copy · {link.readerSnapshot.wordCount} words</span>
                  <button
                    type="button"
                    onClick={handleCopyReaderMarkdown}
                    className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {copiedReaderMd ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedReaderMd ? 'Copied' : 'Copy as Markdown'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCaptureReaderSnapshot}
                    disabled={readerLoading}
                    className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RotateCw className={`w-3 h-3 ${readerLoading ? 'animate-spin' : ''}`} />
                    <span>{readerLoading ? 'Refreshing…' : 'Refresh copy'}</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="py-10 px-6 rounded-2xl border border-dashed border-black/15 dark:border-white/15 text-center space-y-3">
                <BookOpen className="w-6 h-6 mx-auto text-slate-400" />
                <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
                  The article text hasn't been saved yet. Save a clean copy to read it here, even if the original goes away.
                </p>
                <button
                  type="button"
                  onClick={handleCaptureReaderSnapshot}
                  disabled={readerLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#d97757] hover:bg-[#c46243] text-white text-sm font-medium rounded-full disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {readerLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <BookOpen className="w-3.5 h-3.5" />
                  )}
                  <span>{readerLoading ? 'Saving article…' : 'Save article text'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Details panel */}
        <aside
          aria-label="Summary and details"
          className="lg:w-[22rem] lg:shrink-0 lg:overflow-y-auto border-t lg:border-t-0 lg:border-l border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.015]"
        >
          <div className="max-w-2xl mx-auto px-5 sm:px-6 py-6 space-y-6">
            {tldr && (
              <PanelSection title="Summary">
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{tldr}</p>
              </PanelSection>
            )}

            {takeaways.length > 0 && (
              <PanelSection title="Key points">
                <ul className="space-y-2">
                  {takeaways.map((takeaway, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      <span className="w-1 h-1 rounded-full bg-slate-400 mt-2.5 shrink-0" />
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </PanelSection>
            )}

            {snippets.length > 0 && (
              <PanelSection title="Code">
                <div className="space-y-2">
                  {snippets.map((snippet, idx) => (
                    <div
                      key={idx}
                      className="relative bg-[#151413] border border-white/10 rounded-xl p-3 text-xs font-mono text-zinc-200 overflow-x-auto"
                    >
                      <button
                        type="button"
                        onClick={() => handleCopySnippet(snippet, idx)}
                        className="absolute top-2 right-2 p-1 rounded-md bg-white/10 hover:bg-white/20 text-zinc-300 transition-colors"
                        aria-label="Copy code"
                      >
                        {copiedSnippetIdx === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                      <pre className="pr-8">{snippet}</pre>
                    </div>
                  ))}
                </div>
              </PanelSection>
            )}

            {quotes.length > 0 && (
              <PanelSection title="Quotes">
                <div className="space-y-2">
                  {quotes.map((quote, idx) => (
                    <blockquote
                      key={idx}
                      className="pl-3 border-l-2 border-black/15 dark:border-white/15 font-newsreader italic text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                    >
                      {quote}
                    </blockquote>
                  ))}
                </div>
              </PanelSection>
            )}

            <div className="space-y-5 pt-5 border-t border-black/10 dark:border-white/10">
              <PanelSection title="Status">
                <div className="grid grid-cols-3 p-0.5 rounded-lg bg-black/5 dark:bg-white/5" role="radiogroup" aria-label="Status">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={readStatus === opt.value}
                      onClick={() => setReadStatus(opt.value)}
                      className={`py-1.5 rounded-md text-sm transition-colors cursor-pointer ${
                        readStatus === opt.value
                          ? 'bg-white dark:bg-[#27272a] text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </PanelSection>

              <PanelSection title="Category">
                <input
                  type="text"
                  aria-label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={fieldClass}
                />
              </PanelSection>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Tags</h3>
                  <button
                    type="button"
                    onClick={handleSuggestTags}
                    className="text-xs text-[#d97757] dark:text-[#e08264] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Suggest</span>
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="text-xs px-2 py-1 rounded-md bg-white dark:bg-[#18181b] border border-black/10 dark:border-white/10 flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
                      >
                        <span>{t}</span>
                        <button
                          type="button"
                          onClick={() => setTags(tags.filter((item) => item !== t))}
                          className="hover:text-rose-500 text-slate-400 cursor-pointer"
                          aria-label={`Remove tag ${t}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  aria-label="Add a tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  onBlur={handleAddTag}
                  placeholder="Add a tag"
                  className={fieldClass}
                />
              </section>

              <PanelSection title="Notes">
                <textarea
                  rows={4}
                  aria-label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Your thoughts, next steps…"
                  className={fieldClass}
                />
              </PanelSection>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || (!hasChanges && !savedSuccess)}
                className={`w-full flex items-center justify-center gap-2 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 cursor-pointer ${
                  savedSuccess ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-[#d97757] hover:bg-[#c46243] dark:bg-[#e08264] dark:hover:bg-[#e9957a]'
                }`}
              >
                {savedSuccess && <Check className="w-4 h-4" />}
                <span>{isSaving ? 'Saving…' : savedSuccess ? 'Saved' : 'Save changes'}</span>
              </button>
            </div>

            <div className="pt-5 border-t border-black/10 dark:border-white/10">
              <PanelSection title="Ask about this link">
                <form onSubmit={handleAskAIAboutLink} className="flex gap-2">
                  <input
                    type="text"
                    aria-label="Question about this link"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="Ask a question"
                    className={fieldClass}
                  />
                  <button
                    type="submit"
                    disabled={aiLoading || !aiQuestion.trim()}
                    aria-label="Ask"
                    className="px-3 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 rounded-lg disabled:opacity-40 flex items-center transition-colors cursor-pointer"
                  >
                    {aiLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </form>
                {aiAnswer && (
                  <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    <MarkdownRenderer content={aiAnswer} />
                  </div>
                )}
              </PanelSection>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
