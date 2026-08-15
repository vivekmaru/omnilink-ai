import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Star,
  Clock,
  Sparkles,
  Copy,
  Check,
  Code2,
  Quote,
  Tag,
  Save,
  MessageSquare,
  BookOpen,
  ArrowRight,
  Send,
  FileDown,
  Rss,
} from 'lucide-react';
import { LinkItem, ReadStatus } from '../types';
import { ApiService } from '../services/api';
import { analyzeAndSuggestTags } from '../services/autoTagging';

interface LinkDetailModalProps {
  link: LinkItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateLink: (updated: LinkItem) => void;
  onOpenExportModal?: (link: LinkItem) => void;
}

export const LinkDetailModal: React.FC<LinkDetailModalProps> = ({
  link,
  isOpen,
  onClose,
  onUpdateLink,
  onOpenExportModal,
}) => {
  if (!isOpen || !link) return null;

  const [notes, setNotes] = useState(link.notes || '');
  const [category, setCategory] = useState(link.category);
  const [readStatus, setReadStatus] = useState<ReadStatus>(link.readStatus);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(link.tags || []);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSnippetIdx, setCopiedSnippetIdx] = useState<number | null>(null);

  // Reader Mode state
  const [activeTab, setActiveTab] = useState<'insights' | 'reader'>('insights');
  const [readerLoading, setReaderLoading] = useState(false);
  const [copiedReaderMd, setCopiedReaderMd] = useState(false);

  // AI Deep Dive Chat state
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(link.url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1500);
  };

  const handleCaptureReaderSnapshot = async () => {
    setReaderLoading(true);
    try {
      const snapshot = await ApiService.captureReaderSnapshot(link.id);
      const updated = { ...link, readerSnapshot: snapshot };
      onUpdateLink(updated);
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

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((item) => item !== t));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await ApiService.updateLink(link.id, {
        notes,
        category,
        readStatus,
        tags,
      });
      onUpdateLink(updated);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
      <div
        id="link-detail-modal-card"
        className="w-full max-w-3xl max-h-[90vh] border rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
      >
        {/* Modal Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-b border-black/10 dark:border-white/10 shrink-0 bg-black/[0.01] dark:bg-white/[0.01]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase font-bold px-3 py-1 rounded-full bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] border border-[#d97757]/20">
              {link.platform.replace('_', ' ')}
            </span>
            {/* View Mode Tab Switcher */}
            <div className="flex items-center p-0.5 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
              <button
                onClick={() => setActiveTab('insights')}
                className={`px-3 py-1 rounded-full font-mono text-[11px] font-medium transition-all ${
                  activeTab === 'insights'
                    ? 'bg-white dark:bg-[#1f1e1c] text-[#d97757] dark:text-[#e08264] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                AI Insights & Meta
              </button>
              <button
                onClick={() => setActiveTab('reader')}
                className={`flex items-center gap-1 px-3 py-1 rounded-full font-mono text-[11px] font-medium transition-all ${
                  activeTab === 'reader'
                    ? 'bg-white dark:bg-[#1f1e1c] text-[#d97757] dark:text-[#e08264] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                <span>Reader Mode</span>
                {link.readerSnapshot && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyUrl}
              title="Copy URL"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs bg-black/5 dark:bg-white/5 hover:bg-black/10 text-slate-700 dark:text-slate-300 transition-colors"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Copied' : 'Copy URL'}</span>
            </button>

            {onOpenExportModal && (
              <button
                onClick={() => onOpenExportModal(link)}
                title="Export as Markdown for Obsidian or Notion"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] hover:bg-[#d97757]/20 transition-colors border border-[#d97757]/30"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export .md</span>
              </button>
            )}

            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs bg-[#d97757] hover:bg-[#c46243] text-white font-semibold shadow-xs transition-colors"
            >
              <span>Visit Source</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {/* Main Title & Author Header */}
          <div>
            <h2 className="font-newsreader font-medium text-2xl sm:text-3xl text-slate-900 dark:text-[#f7f6f3] leading-tight">
              {link.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">
              {(link.isRssFeedItem || link.feedTitle) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 font-medium">
                  <Rss className="w-3 h-3" />
                  <span>RSS Feed: {link.feedTitle || 'Subscribed Feed'}</span>
                </span>
              )}
              {link.author && <span>Curated by: <strong className="text-slate-900 dark:text-[#f7f6f3]">{link.author}</strong></span>}
              <span>•</span>
              <span className="truncate max-w-sm">{link.url}</span>
              {link.readingTimeMinutes && (
                <>
                  <span>•</span>
                  <span>{link.readingTimeMinutes} min read</span>
                </>
              )}
            </div>
          </div>

          {/* TAB 1: AI Insights & Meta */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              {/* AI Executive TL;DR Summary */}
              {(link.summary?.tldr || link.aiSummary?.tldr) && (
                <div className="p-5 rounded-[20px] bg-black/[0.02] dark:bg-white/[0.02] border border-[#d97757]/30 space-y-2">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#d97757] dark:text-[#e08264] uppercase tracking-wider">
                    <Sparkles className="w-4 h-4" />
                    <span>Executive AI TL;DR</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {link.summary?.tldr || link.aiSummary?.tldr}
                  </p>
                </div>
              )}

          {/* Key Takeaways */}
          {((link.summary?.keyTakeaways && link.summary.keyTakeaways.length > 0) ||
            (link.summary?.takeaways && link.summary.takeaways.length > 0) ||
            (link.aiSummary?.takeaways && link.aiSummary.takeaways.length > 0) ||
            (link.aiSummary?.keyTakeaways && link.aiSummary.keyTakeaways.length > 0)) && (
            <div className="space-y-3">
              <h4 className="font-newsreader font-medium text-base text-slate-900 dark:text-[#f7f6f3]">
                Key Actionable Takeaways
              </h4>
              <ul className="space-y-2">
                {(link.summary?.keyTakeaways || link.summary?.takeaways || link.aiSummary?.takeaways || link.aiSummary?.keyTakeaways || []).map((takeaway, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-[#d97757] dark:bg-[#e08264] mt-2 shrink-0" />
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Extracted Code Snippets */}
          {((link.summary?.codeSnippets && link.summary.codeSnippets.length > 0) ||
            (link.aiSummary?.codeSnippets && link.aiSummary.codeSnippets.length > 0)) && (
            <div className="space-y-3">
              <h4 className="font-newsreader font-medium text-base text-slate-900 dark:text-[#f7f6f3] flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-500" />
                <span>Extracted Code Snippets</span>
              </h4>
              <div className="space-y-3">
                {(link.summary?.codeSnippets || link.aiSummary?.codeSnippets || []).map((snippet, idx) => (
                  <div
                    key={idx}
                    className="relative group bg-[#151413] border border-white/10 rounded-2xl p-4 text-xs font-mono text-zinc-200 overflow-x-auto shadow-inner"
                  >
                    <button
                      onClick={() => handleCopySnippet(snippet, idx)}
                      className="absolute top-2.5 right-2.5 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[10px] text-zinc-300 font-mono flex items-center gap-1 transition-colors"
                    >
                      {copiedSnippetIdx === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSnippetIdx === idx ? 'Copied' : 'Copy'}</span>
                    </button>
                    <pre className="pr-12">{snippet}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discussion Quotes */}
          {((link.summary?.quotes && link.summary.quotes.length > 0) ||
            link.summary?.quote ||
            (link.aiSummary?.quotes && link.aiSummary.quotes.length > 0) ||
            link.aiSummary?.quote) && (
            <div className="space-y-3">
              <h4 className="font-newsreader font-medium text-base text-slate-900 dark:text-[#f7f6f3] flex items-center gap-2">
                <Quote className="w-4 h-4 text-[#d97757] dark:text-[#e08264]" />
                <span>Community Highlights & Discussion Quotes</span>
              </h4>
              <div className="space-y-2.5">
                {(link.summary?.quotes || (link.summary?.quote ? [link.summary.quote] : []) || link.aiSummary?.quotes || (link.aiSummary?.quote ? [link.aiSummary.quote] : []) || []).map((quote, idx) => (
                  <blockquote
                    key={idx}
                    className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 text-xs italic text-slate-700 dark:text-slate-300 leading-relaxed font-newsreader text-sm"
                  >
                    "{quote}"
                  </blockquote>
                ))}
              </div>
            </div>
          )}

          {/* Status & Categorization Controls */}
          <div className="p-5 rounded-[20px] bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 space-y-4">
            <h4 className="font-newsreader font-medium text-base text-slate-900 dark:text-[#f7f6f3]">
              Repository Meta & Organization
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 font-semibold">
                  Reading Status
                </label>
                <select
                  value={readStatus}
                  onChange={(e) => setReadStatus(e.target.value as ReadStatus)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 rounded-full font-mono focus:outline-none text-slate-900 dark:text-[#f7f6f3]"
                >
                  <option value="unread">Unread</option>
                  <option value="reading">Currently Reading</option>
                  <option value="read">Reviewed / Completed</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 font-semibold">
                  Category
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 rounded-full focus:outline-none text-slate-900 dark:text-[#f7f6f3]"
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                  Tags
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const res = analyzeAndSuggestTags({
                      url: link.url,
                      title: link.title,
                      description: link.description || link.summary?.tldr,
                      notes,
                    });
                    const newTags = res.suggestedTags
                      .map((s) => s.tag.toLowerCase())
                      .filter((t) => !tags.includes(t));
                    if (newTags.length > 0) {
                      setTags([...tags, ...newTags]);
                    }
                  }}
                  className="font-mono text-[10px] text-[#d97757] dark:text-[#e08264] hover:underline font-bold flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Auto-Suggest Missing Tags</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="font-mono text-xs px-2.5 py-1 rounded-full bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
                  >
                    <span>#{t}</span>
                    <button
                      onClick={() => handleRemoveTag(t)}
                      className="hover:text-rose-500 text-slate-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add a new tag and press Enter"
                  className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 rounded-full focus:outline-none font-mono text-slate-900 dark:text-[#f7f6f3]"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-1.5 bg-black/5 dark:bg-white/10 rounded-full font-mono text-xs font-semibold hover:bg-black/10 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Personal Notes */}
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 font-semibold">
                Personal Reflection & Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add custom learnings, code notes, or next steps..."
                className="w-full px-4 py-3 text-xs bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 rounded-2xl focus:outline-none text-slate-900 dark:text-[#f7f6f3]"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 bg-[#d97757] hover:bg-[#c46243] text-white text-xs font-semibold rounded-full shadow-xs transition-colors disabled:opacity-50 active:scale-[0.99]"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Meta Changes'}</span>
              </button>
            </div>
          </div>

          {/* Deep AI Q&A for this Link */}
          <div className="p-5 rounded-[20px] bg-[#d97757]/10 border border-[#d97757]/20 space-y-3">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#d97757] dark:text-[#e08264] uppercase tracking-wider">
              <MessageSquare className="w-4 h-4" />
              <span>Ask AI About This Specific Source</span>
            </div>
            <form onSubmit={handleAskAIAboutLink} className="flex gap-2">
              <input
                type="text"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                placeholder="Ask specific question about this repo, post, or article..."
                className="flex-1 px-4 py-2.5 text-xs bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 rounded-full focus:outline-none text-slate-900 dark:text-[#f7f6f3]"
              />
              <button
                type="submit"
                disabled={aiLoading || !aiQuestion.trim()}
                className="px-4 py-2.5 bg-[#d97757] hover:bg-[#c46243] text-white text-xs font-semibold rounded-full disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              >
                {aiLoading ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    <span>Ask</span>
                  </>
                )}
              </button>
            </form>

            {aiAnswer && (
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1f1e1c] border border-black/5 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {aiAnswer}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Offline Reader Mode */}
      {activeTab === 'reader' && (
        <div className="space-y-6">
          {link.readerSnapshot ? (
            <div className="space-y-6">
              {/* Reader Meta Toolbar */}
              <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[#d97757] dark:text-[#e08264] font-semibold">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Offline Snapshot</span>
                  </span>
                  <span>•</span>
                  <span>{link.readerSnapshot.wordCount} words</span>
                  <span>•</span>
                  <span>{link.readerSnapshot.readingTimeMinutes} min read</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyReaderMarkdown}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 text-slate-700 dark:text-slate-300 font-mono text-[11px] transition-colors"
                  >
                    {copiedReaderMd ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedReaderMd ? 'Copied Markdown' : 'Copy Article .md'}</span>
                  </button>
                  <button
                    onClick={handleCaptureReaderSnapshot}
                    disabled={readerLoading}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 text-slate-700 dark:text-slate-300 font-mono text-[11px] transition-colors disabled:opacity-50"
                  >
                    {readerLoading ? (
                      <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-[#d97757]" />
                        <span>Re-Snapshot</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Distraction-Free Article Body */}
              <article className="prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 font-newsreader text-base sm:text-lg leading-relaxed whitespace-pre-wrap selection:bg-[#d97757]/20 p-2">
                {link.readerSnapshot.contentMarkdown}
              </article>
            </div>
          ) : (
            <div className="py-12 px-6 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-dashed border-black/15 dark:border-white/15 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#d97757]/10 text-[#d97757] flex items-center justify-center mx-auto border border-[#d97757]/20">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="font-newsreader font-medium text-lg text-slate-900 dark:text-[#f7f6f3]">
                  No Offline Article Snapshot Yet
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-mono">
                  Capture a sanitized, distraction-free Markdown copy of this article to read offline even if the original website goes down or moves behind a paywall.
                </p>
              </div>
              <button
                onClick={handleCaptureReaderSnapshot}
                disabled={readerLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#d97757] hover:bg-[#c46243] text-white text-xs font-semibold rounded-full shadow-xs disabled:opacity-50 transition-all font-mono cursor-pointer"
              >
                {readerLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sanitizing & Snapshotting Article...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Capture Offline Reader Snapshot</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
</div>
  );
};
