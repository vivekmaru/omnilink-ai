import React, { useState, useEffect, useId, useRef } from 'react';
import {
  X,
  Plus,
  Link as LinkIcon,
  Check,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  GitMerge,
  Eye,
  Calendar,
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
      setError('Enter a URL.');
      return;
    }

    // If duplicate detected and override not enabled, prevent accidental double-entry
    if (duplicateResult?.isDuplicate && duplicateResult.existingLink && !allowDuplicateOverride) {
      setError('This link is already saved. Merge into it or replace its details below.');
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
      setError(err.message || 'Could not merge the link.');
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
      setError(err.message || 'Could not update the link.');
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
      setError('Paste at least one link starting with http:// or https://.');
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
      setError('Some links could not be saved: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const existing = duplicateResult?.existingLink;
  const isBlockedDuplicate = Boolean(duplicateResult?.isDuplicate && !allowDuplicateOverride);

  const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5';
  const inputClass =
    'w-full rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-surface px-3 py-2 text-sm text-slate-900 dark:text-ink placeholder:text-slate-400 focus:outline-none focus:border-accent';
  const primaryButtonClass =
    'flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-on-accent rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const secondaryButtonClass =
    'flex items-center justify-center gap-2 border border-black/10 dark:border-white/10 rounded-md px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50';
  const panelClass = 'rounded-lg border border-black/[0.08] dark:border-white/[0.08]';
  const spinner = <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />;

  const tabClass = (tab: 'single' | 'bulk') =>
    `-mb-px pb-2.5 text-sm border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-accent text-slate-900 dark:text-ink font-medium'
        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        id="add-link-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-link-modal-title"
        className="w-full max-w-xl rounded-xl border shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.08] dark:border-white/[0.08] shrink-0">
          <div>
            <h3 id="add-link-modal-title" className="text-base font-semibold text-slate-900 dark:text-ink">
              Add link
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Articles, threads, repos, videos and papers
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-black/[0.08] dark:border-white/[0.08] px-6 pt-3 gap-5 shrink-0">
          <button onClick={() => setActiveTab('single')} className={tabClass('single')}>
            One link
          </button>
          <button onClick={() => setActiveTab('bulk')} className={tabClass('bulk')}>
            Several links
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-3 py-2 rounded-md border border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'single' ? (
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              {/* URL with background check status */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">URL</label>
                    {checkingDuplicate && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Checking if it's already saved…
                      </span>
                    )}
                  </div>

                  {url.startsWith('http') && (
                    <button
                      type="button"
                      onClick={() => fetchUrlMetadata(url.trim())}
                      disabled={fetchingMeta}
                      className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      <RefreshCw className={`w-3 h-3 ${fetchingMeta ? 'animate-spin' : ''}`} />
                      <span>{fetchingMeta ? 'Fetching…' : 'Fill in title and description'}</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    required
                    value={url}
                    onBlur={handleUrlBlur}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (allowDuplicateOverride) setAllowDuplicateOverride(false);
                    }}
                    placeholder="https://"
                    className={`${inputClass} pl-9 pr-9`}
                  />
                  {isBlockedDuplicate && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" title="Already saved">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>

              {/* Already-saved notice with merge / update options */}
              {duplicateResult?.isDuplicate && existing && !allowDuplicateOverride && (
                <div id="duplicate-warning-banner" className={`${panelClass} p-4 space-y-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-ink">
                          You've already saved this link
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {duplicateResult.matchType === 'exact'
                            ? 'Same URL as a saved link'
                            : 'Same page as a saved link (URL differs slightly)'}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{existing.category}</span>
                  </div>

                  {/* Saved link summary */}
                  <div className={`${panelClass} p-3 text-xs space-y-1.5`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-1">
                        {existing.title || existing.url}
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 capitalize">
                        {existing.readStatus}
                      </span>
                    </div>

                    {existing.summary?.tldr && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {existing.summary.tldr}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
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
                          <span className="opacity-40">·</span>
                          {existing.tags.slice(0, 4).map((t) => (
                            <span key={t} className="text-slate-600 dark:text-slate-300">
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

                  {/* Merge & update actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleSmartMerge}
                      disabled={mergingLoading}
                      className={primaryButtonClass}
                      title="Adds your tags and notes to the saved link"
                    >
                      {mergingLoading ? spinner : <GitMerge className="w-3.5 h-3.5" />}
                      <span>Merge into saved link</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleUpdateOverwrite}
                      disabled={mergingLoading}
                      className={secondaryButtonClass}
                      title="Replaces the saved title, category, tags and notes with what you entered here"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                      <span>Replace saved details</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={handleViewExisting}
                      className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Open saved link</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAllowDuplicateOverride(true)}
                      className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      Save a copy anyway
                    </button>
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label className={labelClass}>Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Page title"
                  className={inputClass}
                />
              </div>

              {/* Description */}
              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A line or two about the page"
                  className={inputClass}
                />
              </div>

              {/* Tag & category suggestions */}
              {suggestions && (suggestions.suggestedTags.length > 0 || suggestions.suggestedCategory) && (
                <div className={`${panelClass} p-4 space-y-3`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Suggestions</span>

                    {suggestions.suggestedTags.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAcceptAllSuggestions}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Add all tags ({suggestions.suggestedTags.length})</span>
                      </button>
                    )}
                  </div>

                  {suggestions.suggestedCategory && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Category:</span>
                      <span className="font-medium text-slate-900 dark:text-ink">
                        {suggestions.suggestedCategory.category}
                      </span>
                      <span className="text-xs text-slate-400">
                        {suggestions.suggestedCategory.confidence}% match
                      </span>
                      {category !== suggestions.suggestedCategory.category && (
                        <button
                          type="button"
                          onClick={() => {
                            setCategory(suggestions.suggestedCategory.category);
                            setIsCategoryManuallySet(true);
                          }}
                          className="ml-auto px-2.5 py-1 rounded-md border border-black/10 dark:border-white/10 text-xs text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          Use this
                        </button>
                      )}
                    </div>
                  )}

                  {suggestions.suggestedTags.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Click a tag to add or remove it</div>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.suggestedTags.map((sug) => {
                          const isSelected = isTagSelected(sug.tag);
                          return (
                            <button
                              key={sug.tag}
                              type="button"
                              onClick={() => handleToggleTag(sug.tag)}
                              title={`${sug.reason} (${sug.confidence}% confidence)`}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border transition-colors ${
                                isSelected
                                  ? 'bg-accent border-accent text-on-accent'
                                  : 'border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                              }`}
                            >
                              {isSelected ? (
                                <Check className="w-3 h-3 shrink-0" />
                              ) : (
                                <Plus className="w-3 h-3 text-slate-400 shrink-0" />
                              )}
                              <span>#{sug.tag}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {suggestions.extractedKeywords.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto text-xs text-slate-400 dark:text-slate-500">
                      <span className="shrink-0">Keywords:</span>
                      {suggestions.extractedKeywords.map((kw) => (
                        <span key={kw} className="shrink-0">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Category & Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Category</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setIsCategoryManuallySet(true);
                    }}
                    className={inputClass}
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
                  <label className={labelClass}>Tags</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="Separate with commas"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={labelClass}>Notes (optional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Why you're saving it"
                  className={inputClass}
                />
              </div>

              {/* Options */}
              <div className={`${panelClass} divide-y divide-black/[0.08] dark:divide-white/[0.08]`}>
                <label className="flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer">
                  <div>
                    <div className="text-sm text-slate-700 dark:text-slate-200">Add suggested tags when saving</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Only the closest matches</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoApplySuggestedTags}
                    onChange={(e) => setAutoApplySuggestedTags(e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer accent-accent"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer">
                  <div>
                    <div className="text-sm text-slate-700 dark:text-slate-200">Summarize with AI</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Writes a short summary, key points and quotes
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoAiExtract}
                    onChange={(e) => setAutoAiExtract(e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer accent-accent"
                  />
                </label>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button type="button" onClick={onClose} className={secondaryButtonClass}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || isBlockedDuplicate}
                  className={primaryButtonClass}
                >
                  {loading ? (
                    <>
                      {spinner}
                      <span>Saving…</span>
                    </>
                  ) : isBlockedDuplicate ? (
                    <span>Already saved</span>
                  ) : (
                    <span>Save link</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Links, one per line</label>
                <textarea
                  rows={6}
                  required
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  placeholder="https://&#10;https://"
                  className={inputClass}
                />
              </div>

              <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc pl-4">
                <li>Only lines starting with http:// or https:// are saved.</li>
                <li>Links you've already saved are skipped.</li>
                <li>Each link is summarized with AI as it's saved.</li>
              </ul>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button type="button" onClick={onClose} className={secondaryButtonClass}>
                  Cancel
                </button>
                <button type="submit" disabled={loading} className={primaryButtonClass}>
                  {loading ? (
                    <>
                      {spinner}
                      <span>Saving links…</span>
                    </>
                  ) : (
                    <span>Save links</span>
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
