import React, { useState, useEffect, useId, useRef } from 'react';
import {
  X,
  Plus,
  Sparkles,
  Layers,
  Link as LinkIcon,
  Check,
  AlertCircle,
  AlertTriangle,
  Tag,
  Folder,
  CheckCircle2,
  Wand2,
  RefreshCw,
  FileText,
  Lightbulb,
  GitMerge,
  ExternalLink,
  Eye,
  Calendar,
  Bookmark,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { AutoTaggingResult, LinkItem, DuplicateCheckResult } from '../types';
import { analyzeAndSuggestTags } from '../services/autoTagging';
import { checkDuplicateInLinks, normalizeUrl } from '../utils/url';

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinkAdded: (newLink: LinkItem) => void;
  onLinkUpdated?: (updatedLink: LinkItem) => void;
  onOpenDetail?: (link: LinkItem) => void;
  existingLinks?: LinkItem[];
  initialUrl?: string;
  initialTitle?: string;
  initialNotes?: string;
}

export const AddLinkModal: React.FC<AddLinkModalProps> = ({
  isOpen,
  onClose,
  onLinkAdded,
  onLinkUpdated,
  onOpenDetail,
  existingLinks = [],
  initialUrl = '',
  initialTitle = '',
  initialNotes = '',
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Dev & Tech');
  const [isCategoryManuallySet, setIsCategoryManuallySet] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState(initialNotes);
  const [autoAiExtract, setAutoAiExtract] = useState(true);
  const [autoApplySuggestedTags, setAutoApplySuggestedTags] = useState(true);
  const [bulkUrls, setBulkUrls] = useState('');

  const [loading, setLoading] = useState(false);
  const [mergingLoading, setMergingLoading] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AutoTaggingResult | null>(null);

  // Background duplicate validation state
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [allowDuplicateOverride, setAllowDuplicateOverride] = useState(false);

  const checkDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync initial props
  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
    if (initialTitle) setTitle(initialTitle);
    if (initialNotes) setNotes(initialNotes);
    setDuplicateResult(null);
    setAllowDuplicateOverride(false);
  }, [initialUrl, initialTitle, initialNotes, isOpen]);

  // Real-time background duplicate check as user types or pastes URL
  useEffect(() => {
    const trimmed = url.trim();

    if (!trimmed || trimmed.length < 5) {
      setDuplicateResult(null);
      setCheckingDuplicate(false);
      setAllowDuplicateOverride(false);
      return;
    }

    if (checkDebounceRef.current) {
      clearTimeout(checkDebounceRef.current);
    }

    // 1. Instant synchronous client-side check
    const localMatch = checkDuplicateInLinks(trimmed, existingLinks);
    if (localMatch.isDuplicate && localMatch.existingLink) {
      setDuplicateResult(localMatch);
      setCheckingDuplicate(false);
    } else {
      setCheckingDuplicate(true);
      // 2. Debounced server check to account for normalized variations & full db
      checkDebounceRef.current = setTimeout(async () => {
        try {
          const res = await ApiService.checkDuplicate(trimmed, existingLinks);
          setDuplicateResult(res.isDuplicate ? res : null);
        } catch (e) {
          console.warn('Duplicate check error:', e);
        } finally {
          setCheckingDuplicate(false);
        }
      }, 250);
    }

    return () => {
      if (checkDebounceRef.current) {
        clearTimeout(checkDebounceRef.current);
      }
    };
  }, [url, existingLinks]);

  // Compute keyword-based auto-tagging & category suggestions dynamically as user types
  useEffect(() => {
    if (!url.trim() && !title.trim() && !description.trim() && !notes.trim()) {
      setSuggestions(null);
      return;
    }

    const result = analyzeAndSuggestTags({
      url: url.trim(),
      title: title.trim(),
      description: description.trim(),
      notes: notes.trim(),
    });

    setSuggestions(result);

    // Auto-update category if user hasn't explicitly selected one
    if (!isCategoryManuallySet && result.suggestedCategory?.category) {
      setCategory(result.suggestedCategory.category);
    }
  }, [url, title, description, notes, isCategoryManuallySet]);

  // When a valid URL is pasted/entered, attempt auto-fetching page title & description for instant tagging
  const handleUrlBlur = async () => {
    const trimmed = url.trim();
    if (!trimmed || !trimmed.startsWith('http')) return;

    if (!title.trim() || !description.trim()) {
      await fetchUrlMetadata(trimmed);
    }
  };

  const fetchUrlMetadata = async (targetUrl: string) => {
    if (!targetUrl.startsWith('http')) return;
    setFetchingMeta(true);
    try {
      const meta = await ApiService.previewMetadata(targetUrl);
      if (meta.title && !title.trim()) {
        setTitle(meta.title);
      }
      if (meta.description && !description.trim()) {
        setDescription(meta.description);
      }
      // Re-run suggestion engine with new meta
      const nextSug = analyzeAndSuggestTags({
        url: targetUrl,
        title: meta.title || title,
        description: meta.description || description,
        notes,
      });
      setSuggestions(nextSug);
      if (!isCategoryManuallySet && nextSug.suggestedCategory?.category) {
        setCategory(nextSug.suggestedCategory.category);
      }
    } catch (e) {
      console.warn('Metadata preview fetch skipped:', e);
    } finally {
      setFetchingMeta(false);
    }
  };

  if (!isOpen) return null;

  // Active tags parsed from tagsInput
  const currentTags = tagsInput
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const isTagSelected = (tag: string) => currentTags.includes(tag.toLowerCase());

  const handleToggleTag = (tag: string) => {
    const cleanTag = tag.trim().toLowerCase();
    if (isTagSelected(cleanTag)) {
      // Remove tag
      const next = currentTags.filter((t) => t !== cleanTag);
      setTagsInput(next.join(', '));
    } else {
      // Add tag
      const next = [...currentTags, cleanTag];
      setTagsInput(next.join(', '));
    }
  };

  const handleAcceptAllSuggestions = () => {
    if (!suggestions?.suggestedTags) return;
    const all = Array.from(
      new Set([...currentTags, ...suggestions.suggestedTags.map((s) => s.tag.toLowerCase())])
    );
    setTagsInput(all.join(', '));
  };

  const getFinalCombinedData = () => {
    let finalTags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    // If auto-apply tags is on, merge top keyword-matched suggested tags automatically
    if (autoApplySuggestedTags && suggestions?.suggestedTags) {
      const topAutoTags = suggestions.suggestedTags
        .filter((t) => t.confidence >= 75)
        .map((t) => t.tag.toLowerCase());
      finalTags = Array.from(new Set([...finalTags, ...topAutoTags]));
    }

    const combinedNotes = description.trim()
      ? notes.trim()
        ? `${notes.trim()}\n\n[Extracted Description]: ${description.trim()}`
        : description.trim()
      : notes.trim() || undefined;

    return { finalTags, combinedNotes };
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please provide a valid URL.');
      return;
    }

    // If duplicate detected and override not enabled, prevent accidental double-entry
    if (duplicateResult?.isDuplicate && duplicateResult.existingLink && !allowDuplicateOverride) {
      setError('This URL already exists in your vault. Use "Merge Content" or "Update Existing" below.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { finalTags, combinedNotes } = getFinalCombinedData();

      const newLink = await ApiService.createLink({
        url: url.trim(),
        title: title.trim() || undefined,
        category,
        tags: finalTags.length > 0 ? finalTags : undefined,
        notes: combinedNotes,
        autoAiExtract,
      });

      onLinkAdded(newLink);
      onClose();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save link.');
    } finally {
      setLoading(false);
    }
  };

  // Smart Merge Handler: combines tags, notes, category with existing bookmark
  const handleSmartMerge = async () => {
    if (!duplicateResult?.existingLink) return;
    const existing = duplicateResult.existingLink;

    setMergingLoading(true);
    setError(null);

    try {
      const { finalTags, combinedNotes } = getFinalCombinedData();

      const merged = await ApiService.mergeLink(existing.id, {
        title: title.trim() || existing.title,
        category: category !== 'Dev & Tech' ? category : existing.category,
        tags: finalTags,
        notes: combinedNotes,
        mode: 'smart_merge',
        autoAiExtract,
      });

      if (onLinkUpdated) {
        onLinkUpdated(merged);
      } else {
        onLinkAdded(merged);
      }
      onClose();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to merge bookmark.');
    } finally {
      setMergingLoading(false);
    }
  };

  // Overwrite/Update Handler: replaces existing bookmark fields with form inputs
  const handleUpdateOverwrite = async () => {
    if (!duplicateResult?.existingLink) return;
    const existing = duplicateResult.existingLink;

    setMergingLoading(true);
    setError(null);

    try {
      const { finalTags, combinedNotes } = getFinalCombinedData();

      const updated = await ApiService.mergeLink(existing.id, {
        title: title.trim() || undefined,
        category,
        tags: finalTags,
        notes: combinedNotes || '',
        mode: 'overwrite',
        autoAiExtract,
      });

      if (onLinkUpdated) {
        onLinkUpdated(updated);
      } else {
        onLinkAdded(updated);
      }
      onClose();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to update bookmark.');
    } finally {
      setMergingLoading(false);
    }
  };

  // View Existing bookmark in detail modal
  const handleViewExisting = () => {
    if (duplicateResult?.existingLink) {
      const existing = duplicateResult.existingLink;
      onClose();
      if (onOpenDetail) {
        onOpenDetail(existing);
      }
    }
  };

  const resetForm = () => {
    setUrl('');
    setTitle('');
    setDescription('');
    setNotes('');
    setTagsInput('');
    setSuggestions(null);
    setIsCategoryManuallySet(false);
    setDuplicateResult(null);
    setAllowDuplicateOverride(false);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = bulkUrls
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http://') || u.startsWith('https://'));

    if (urls.length === 0) {
      setError('Please paste at least one valid http/https URL.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      for (const u of urls) {
        const link = await ApiService.createLink({
          url: u,
          autoAiExtract: true,
        });
        onLinkAdded(link);
      }
      onClose();
      setBulkUrls('');
    } catch (err: any) {
      setError('Some links could not be processed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const existing = duplicateResult?.existingLink;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
      <div
        id="add-link-modal-card"
        className="w-full max-w-xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-black/10 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] flex items-center justify-center border border-[#d97757]/20">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-newsreader text-xl font-medium text-slate-900 dark:text-[#f7f6f3]">
                Add to Knowledge Vault
              </h3>
              <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                Instagram reels, Reddit threads, GitHub repos, articles & papers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-black/10 dark:border-white/10 px-6 pt-3 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('single')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'single'
                ? 'border-[#d97757] dark:border-[#e08264] text-[#d97757] dark:text-[#e08264]'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Single Link & Auto-Tagging
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'bulk'
                ? 'border-[#d97757] dark:border-[#e08264] text-[#d97757] dark:text-[#e08264]'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Bulk Import (Multi-URL)</span>
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 font-mono text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'single' ? (
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              {/* Source URL with background check status */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 font-semibold">
                      Source URL <span className="text-rose-500">*</span>
                    </label>
                    {checkingDuplicate && (
                      <span className="font-mono text-[10px] text-[#d97757] dark:text-[#e08264] flex items-center gap-1 animate-pulse">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        Checking duplicates...
                      </span>
                    )}
                  </div>

                  {url.startsWith('http') && (
                    <button
                      type="button"
                      onClick={() => fetchUrlMetadata(url.trim())}
                      disabled={fetchingMeta}
                      className="flex items-center gap-1 font-mono text-[10px] text-[#d97757] dark:text-[#e08264] hover:underline font-semibold"
                    >
                      <RefreshCw className={`w-3 h-3 ${fetchingMeta ? 'animate-spin' : ''}`} />
                      <span>{fetchingMeta ? 'Inspecting URL...' : 'Inspect & Auto-Fill'}</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <LinkIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    required
                    value={url}
                    onBlur={handleUrlBlur}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (allowDuplicateOverride) setAllowDuplicateOverride(false);
                    }}
                    placeholder="https://github.com/..., https://reddit.com/r/..., https://instagram.com/reel/..."
                    className={`w-full pl-10 pr-10 py-2.5 text-xs bg-black/5 dark:bg-white/5 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#d97757] text-slate-900 dark:text-[#f7f6f3] transition-colors ${
                      duplicateResult?.isDuplicate && !allowDuplicateOverride
                        ? 'border-amber-500/60 dark:border-amber-500/60 bg-amber-500/[0.04]'
                        : 'border-black/10 dark:border-white/10'
                    }`}
                  />
                  {duplicateResult?.isDuplicate && !allowDuplicateOverride && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 dark:text-amber-400" title="Existing bookmark detected">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>

              {/* ========================================================= */}
              {/* DUPLICATE WARNING & SMART MERGE CARD                      */}
              {/* ========================================================= */}
              {duplicateResult?.isDuplicate && existing && !allowDuplicateOverride && (
                <div
                  id="duplicate-warning-banner"
                  className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/[0.05] dark:bg-amber-500/[0.08] space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  {/* Warning Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-newsreader text-base font-semibold text-slate-900 dark:text-[#f7f6f3]">
                          Existing Bookmark Detected
                        </div>
                        <div className="font-mono text-[10px] text-amber-700 dark:text-amber-300">
                          {duplicateResult.matchType === 'exact'
                            ? 'Exact URL already saved in your repository'
                            : 'Normalized canonical URL match found in repository'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        {existing.category}
                      </span>
                    </div>
                  </div>

                  {/* Existing Link Card Summary */}
                  <div className="p-3 rounded-lg bg-white/80 dark:bg-[#191816]/90 border border-amber-500/20 text-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-slate-900 dark:text-slate-100 line-clamp-1">
                        {existing.title || existing.url}
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 shrink-0 capitalize px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5">
                        {existing.readStatus}
                      </span>
                    </div>

                    {existing.summary?.tldr && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {existing.summary.tldr}
                      </p>
                    )}

                    {/* Metadata & Tag chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {new Date(existing.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      {existing.tags.length > 0 && (
                        <>
                          <span className="opacity-40">•</span>
                          <span className="text-slate-400">Tags:</span>
                          {existing.tags.slice(0, 4).map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300"
                            >
                              #{t}
                            </span>
                          ))}
                          {existing.tags.length > 4 && (
                            <span className="text-slate-400">+{existing.tags.length - 4} more</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Merge & Update Action Buttons */}
                  <div className="space-y-2 pt-0.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Smart Merge Button */}
                      <button
                        type="button"
                        onClick={handleSmartMerge}
                        disabled={mergingLoading}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-[#d97757] hover:bg-[#c66a4d] text-white text-xs font-medium rounded-lg shadow-2xs transition-colors"
                        title="Unions tags, appends notes, and updates category"
                      >
                        {mergingLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <GitMerge className="w-3.5 h-3.5" />
                        )}
                        <span>Smart Merge Content</span>
                      </button>

                      {/* Overwrite / Update Button */}
                      <button
                        type="button"
                        onClick={handleUpdateOverwrite}
                        disabled={mergingLoading}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-[#272522] hover:bg-slate-100 dark:hover:bg-[#312e2b] text-slate-800 dark:text-slate-200 border border-black/10 dark:border-white/10 text-xs font-medium rounded-lg shadow-2xs transition-colors"
                        title="Replaces title, category, tags and notes with form inputs"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />
                        <span>Update Existing Entry</span>
                      </button>
                    </div>

                    {/* Secondary Inspection & Override Controls */}
                    <div className="flex items-center justify-between pt-1 font-mono text-[10px]">
                      <button
                        type="button"
                        onClick={handleViewExisting}
                        className="flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-[#d97757] dark:hover:text-[#e08264] hover:underline"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect Existing Bookmark in Detail View</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAllowDuplicateOverride(true)}
                        className="text-amber-700 dark:text-amber-400 hover:underline"
                      >
                        Create separate copy anyway &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Page Title */}
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-semibold">
                  Page Title (Keywords trigger real-time auto-tagging)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. SQLite WAL Concurrency & High Performance Microservices"
                  className="w-full px-3.5 py-2.5 text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#d97757] text-slate-900 dark:text-[#f7f6f3]"
                />
              </div>

              {/* Page Description / Excerpt for keyword discovery */}
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-semibold">
                  Page Description / Key Excerpt
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Paste or type brief description, article thesis, or key concepts for tag discovery..."
                  className="w-full px-3.5 py-2.5 text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#d97757] text-slate-900 dark:text-[#f7f6f3]"
                />
              </div>

              {/* Real-Time Keyword Auto-Tagging & Category Suggestion Panel */}
              {suggestions && (suggestions.suggestedTags.length > 0 || suggestions.suggestedCategory) && (
                <div className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-[#d97757]/30 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />
                      <span className="font-newsreader text-sm font-medium text-slate-900 dark:text-[#f7f6f3]">
                        Auto-Tag & Category Suggestions
                      </span>
                    </div>

                    {suggestions.suggestedTags.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAcceptAllSuggestions}
                        className="font-mono text-[11px] font-medium text-[#d97757] dark:text-[#e08264] hover:underline flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Accept All ({suggestions.suggestedTags.length})</span>
                      </button>
                    )}
                  </div>

                  {/* Category Suggestion Chip */}
                  {suggestions.suggestedCategory && (
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono bg-white dark:bg-[#1f1e1c] p-2.5 rounded-lg border border-black/5 dark:border-white/10">
                      <span className="text-slate-500 dark:text-slate-400">Recommended Category:</span>
                      <span className="font-semibold text-[#d97757] dark:text-[#e08264] px-2 py-0.5 rounded bg-[#d97757]/10">
                        {suggestions.suggestedCategory.category}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        ({suggestions.suggestedCategory.confidence}% match)
                      </span>
                      {category !== suggestions.suggestedCategory.category && (
                        <button
                          type="button"
                          onClick={() => {
                            setCategory(suggestions.suggestedCategory.category);
                            setIsCategoryManuallySet(true);
                          }}
                          className="ml-auto px-2 py-0.5 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-medium"
                        >
                          Apply Category
                        </button>
                      )}
                    </div>
                  )}

                  {/* Suggested Tag Pills */}
                  {suggestions.suggestedTags.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                        Click tags to add/remove:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.suggestedTags.map((sug) => {
                          const isSelected = isTagSelected(sug.tag);
                          return (
                            <button
                              key={sug.tag}
                              type="button"
                              onClick={() => handleToggleTag(sug.tag)}
                              title={`${sug.reason} (${sug.confidence}% confidence)`}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono transition-all ${
                                isSelected
                                  ? 'bg-[#d97757] text-white dark:bg-[#e08264] dark:text-slate-950 font-medium shadow-2xs'
                                  : 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-[#d97757]/20 hover:text-[#d97757] dark:hover:text-[#e08264]'
                              }`}
                            >
                              {isSelected ? (
                                <Check className="w-3 h-3 shrink-0" />
                              ) : (
                                <Plus className="w-3 h-3 text-[#d97757] dark:text-[#e08264] shrink-0" />
                              )}
                              <span>#{sug.tag}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Extracted Keyword Tokens */}
                  {suggestions.extractedKeywords.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1 overflow-x-auto text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      <span className="shrink-0 font-semibold">Keywords:</span>
                      {suggestions.extractedKeywords.map((kw) => (
                        <span key={kw} className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 shrink-0">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Category & Tags Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-semibold">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setIsCategoryManuallySet(true);
                    }}
                    className="w-full px-3 py-2.5 text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#d97757] text-slate-900 dark:text-[#f7f6f3]"
                  >
                    <option value="Dev & Tech">Dev & Tech</option>
                    <option value="AI & Machine Learning">AI & Machine Learning</option>
                    <option value="Design & UI">Design & UI</option>
                    <option value="Reddit Discussions">Reddit Discussions</option>
                    <option value="Instagram & Social">Instagram & Social</option>
                    <option value="Tutorials & Guides">Tutorials & Guides</option>
                    <option value="Research & Papers">Research & Papers</option>
                    <option value="Productivity">Productivity</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-semibold">
                    Tags (Comma Separated)
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="react, agent, sqlite"
                    className="w-full px-3.5 py-2.5 text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#d97757] text-slate-900 dark:text-[#f7f6f3]"
                  />
                </div>
              </div>

              {/* Personal Notes */}
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-semibold">
                  Personal Notes / Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Why are you saving this? Key quotes or remarks..."
                  className="w-full px-3.5 py-2.5 text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#d97757] text-slate-900 dark:text-[#f7f6f3]"
                />
              </div>

              {/* Auto-Apply Suggested Tags Toggle & Gemini Extraction */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />
                    <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                      Auto-merge high confidence keyword tags on save
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoApplySuggestedTags}
                    onChange={(e) => setAutoApplySuggestedTags(e.target.checked)}
                    className="w-4 h-4 text-[#d97757] rounded cursor-pointer accent-[#d97757]"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[#d97757]/10 border border-[#d97757]/20">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-[#d97757] dark:text-[#e08264]" />
                    <div>
                      <div className="text-xs font-newsreader font-medium text-slate-900 dark:text-[#f7f6f3]">
                        Deep AI Ingestion (Gemini 3.7 Flash)
                      </div>
                      <div className="font-mono text-[10px] opacity-70">
                        Extracts TL;DR, takeaways, code snippets & quotes
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoAiExtract}
                    onChange={(e) => setAutoAiExtract(e.target.checked)}
                    className="w-4 h-4 text-[#d97757] rounded cursor-pointer accent-[#d97757]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-mono text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || (duplicateResult?.isDuplicate && !allowDuplicateOverride)}
                  className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium rounded-lg shadow-2xs transition-colors ${
                    duplicateResult?.isDuplicate && !allowDuplicateOverride
                      ? 'bg-black/10 dark:bg-white/10 text-slate-400 cursor-not-allowed'
                      : 'bg-[#d97757] text-white hover:bg-[#c66a4d]'
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Extracting with AI...</span>
                    </>
                  ) : duplicateResult?.isDuplicate && !allowDuplicateOverride ? (
                    <span>Duplicate Detected</span>
                  ) : (
                    <span>Save to Repository</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-semibold">
                  Paste Multiple Links (1 URL per line)
                </label>
                <textarea
                  rows={6}
                  required
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  placeholder="https://github.com/shadcn-ui/ui&#10;https://www.reddit.com/r/LocalLLaMA/...&#10;https://www.instagram.com/reel/..."
                  className="w-full px-3.5 py-3 text-xs font-mono bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#d97757] text-slate-900 dark:text-[#f7f6f3]"
                />
              </div>

              <div className="p-3.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 font-mono text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <div className="font-semibold text-slate-900 dark:text-[#f7f6f3]">Bulk Ingestion Pipeline:</div>
                <div>• Auto-detects GitHub, Reddit, Instagram, YouTube & research papers</div>
                <div>• Skips redundant duplicate URLs and deduplicates against vault</div>
                <div>• Concurrently runs auto-tagging and Gemini 3.7 Flash structured summaries</div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-mono text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#d97757] hover:bg-[#c66a4d] text-white text-xs font-medium rounded-lg shadow-2xs transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processing Ingestion...</span>
                    </>
                  ) : (
                    <span>Import All Links</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

