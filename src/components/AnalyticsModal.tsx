import React, { useState, useMemo } from 'react';
import {
  X,
  Clock,
  Star,
  Archive,
  Sparkles,
  Github,
  MessageSquare,
  Instagram,
  Youtube,
  Twitter,
  FileText,
  Tag,
  ArrowRight,
  Layers,
  PieChart,
} from 'lucide-react';
import { LinkItem, PlatformType, ReadStatus, SystemStats } from '../types';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: SystemStats | null;
  links: LinkItem[];
  onFilterByPlatform?: (platform: PlatformType) => void;
  onFilterByCategory?: (category: string) => void;
  onFilterByTag?: (tag: string) => void;
  onFilterByStatus?: (status: ReadStatus) => void;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  isOpen,
  onClose,
  stats,
  links,
  onFilterByPlatform,
  onFilterByCategory,
  onFilterByTag,
  onFilterByStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'platforms' | 'tags' | 'reading'>('overview');

  // Compute detailed analytics from links and stats
  const analyticsData = useMemo(() => {
    const total = links.length || stats?.totalLinks || 0;
    const unread = links.filter((l) => l.readStatus === 'unread').length;
    const reading = links.filter((l) => l.readStatus === 'reading').length;
    const read = links.filter((l) => l.readStatus === 'read').length;
    const favorites = links.filter((l) => l.isFavorite).length;
    const archived = links.filter((l) => l.isArchived).length;
    const rssItems = links.filter((l) => l.isRssFeedItem).length;

    // Platform distribution
    const platformMap: Record<string, number> = {};
    const categoryMap: Record<string, number> = {};
    const tagMap: Record<string, number> = {};
    let totalReadingTime = 0;
    let totalAiScore = 0;
    let scoredItemsCount = 0;

    // Reading time buckets
    let quickReads = 0; // < 3 min
    let mediumReads = 0; // 3-10 min
    let deepDives = 0; // 10-30 min
    let longForm = 0; // > 30 min

    for (const item of links) {
      // Platform
      platformMap[item.platform] = (platformMap[item.platform] || 0) + 1;
      
      // Category
      if (item.category) {
        categoryMap[item.category] = (categoryMap[item.category] || 0) + 1;
      }

      // Tags
      for (const t of item.tags) {
        if (t && t.trim()) {
          const clean = t.trim().toLowerCase();
          tagMap[clean] = (tagMap[clean] || 0) + 1;
        }
      }

      // Reading time
      const readMin = item.readingTimeMinutes || 3;
      totalReadingTime += readMin;
      if (readMin < 3) quickReads++;
      else if (readMin <= 10) mediumReads++;
      else if (readMin <= 30) deepDives++;
      else longForm++;

      // AI Score
      if (item.aiScore) {
        totalAiScore += item.aiScore;
        scoredItemsCount++;
      }
    }

    // Merge with server stats if available
    if (stats?.platformCounts) {
      for (const [p, c] of Object.entries(stats.platformCounts)) {
        if (!platformMap[p]) platformMap[p] = Number(c) || 0;
      }
    }
    if (stats?.categoriesBreakdown) {
      for (const [cat, c] of Object.entries(stats.categoriesBreakdown)) {
        if (!categoryMap[cat]) categoryMap[cat] = Number(c) || 0;
      }
    }

    // Sort platforms by count
    const platformsSorted = Object.entries(platformMap)
      .map(([platform, count]) => ({
        platform: platform as PlatformType,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Sort categories by count
    const categoriesSorted = Object.entries(categoryMap)
      .map(([category, count]) => ({
        category,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Sort tags by count
    const tagsSorted = Object.entries(tagMap)
      .map(([tag, count]) => ({
        tag,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const avgAiScore = scoredItemsCount > 0 ? Math.round(totalAiScore / scoredItemsCount) : 86;
    const totalHours = Math.floor(totalReadingTime / 60);
    const remainingMins = totalReadingTime % 60;
    const completionRate = total > 0 ? Math.round((read / total) * 100) : 0;
    const unreadRate = total > 0 ? Math.round((unread / total) * 100) : 0;
    const readingRate = total > 0 ? Math.round((reading / total) * 100) : 0;

    return {
      total,
      unread,
      reading,
      read,
      favorites,
      archived,
      rssItems,
      platformsSorted,
      categoriesSorted,
      tagsSorted,
      totalReadingTime,
      totalHours,
      remainingMins,
      avgAiScore,
      completionRate,
      unreadRate,
      readingRate,
      quickReads,
      mediumReads,
      deepDives,
      longForm,
      topTag: tagsSorted[0]?.tag || 'None',
      topPlatform: platformsSorted[0]?.platform || 'None',
      topCategory: categoriesSorted[0]?.category || 'None',
    };
  }, [links, stats]);

  if (!isOpen) return null;

  const iconClass = 'w-4 h-4 text-slate-500 dark:text-slate-400';

  const getPlatformMeta = (platform: string) => {
    switch (platform) {
      case 'github':
        return { label: 'GitHub', icon: <Github className={iconClass} /> };
      case 'reddit_post':
        return { label: 'Reddit posts', icon: <MessageSquare className={iconClass} /> };
      case 'reddit_comment':
        return { label: 'Reddit comments', icon: <MessageSquare className={iconClass} /> };
      case 'instagram_short':
        return { label: 'Instagram', icon: <Instagram className={iconClass} /> };
      case 'youtube':
        return { label: 'YouTube', icon: <Youtube className={iconClass} /> };
      case 'twitter_x':
        return { label: 'X / Twitter', icon: <Twitter className={iconClass} /> };
      case 'article':
        return { label: 'Articles', icon: <FileText className={iconClass} /> };
      case 'paper':
        return { label: 'Papers', icon: <FileText className={iconClass} /> };
      default:
        return { label: 'Other', icon: <Layers className={iconClass} /> };
    }
  };

  const handleSelectPlatform = (p: PlatformType) => {
    if (onFilterByPlatform) {
      onFilterByPlatform(p);
      onClose();
    }
  };

  const handleSelectCategory = (c: string) => {
    if (onFilterByCategory) {
      onFilterByCategory(c);
      onClose();
    }
  };

  const handleSelectTag = (t: string) => {
    if (onFilterByTag) {
      onFilterByTag(t);
      onClose();
    }
  };

  const handleSelectStatus = (s: ReadStatus) => {
    if (onFilterByStatus) {
      onFilterByStatus(s);
      onClose();
    }
  };

  const panel = 'rounded-lg border border-black/[0.08] dark:border-white/[0.08]';
  const sectionLabel = 'text-xs font-medium text-slate-500 dark:text-slate-400';
  const barTrack = 'w-full h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden';
  const tabClass = (tab: typeof activeTab) =>
    `px-3 py-2 text-sm border-b-2 -mb-px transition-colors flex items-center gap-2 whitespace-nowrap ${
      activeTab === tab
        ? 'border-accent text-slate-900 dark:text-ink font-medium'
        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
    }`;
  const tabIcon = 'w-3.5 h-3.5 text-slate-400';

  const statusRows: { status: ReadStatus; label: string; count: number; rate: number; swatch: string }[] = [
    { status: 'unread', label: 'To read', count: analyticsData.unread, rate: analyticsData.unreadRate, swatch: 'bg-slate-300 dark:bg-slate-600' },
    { status: 'reading', label: 'Reading', count: analyticsData.reading, rate: analyticsData.readingRate, swatch: 'bg-accent/50' },
    { status: 'read', label: 'Read', count: analyticsData.read, rate: analyticsData.completionRate, swatch: 'bg-accent' },
  ];

  const depthBuckets = [
    { label: 'Under 3 min', count: analyticsData.quickReads, hint: 'Short posts and tips' },
    { label: '3–10 min', count: analyticsData.mediumReads, hint: 'Articles and tutorials' },
    { label: '10–30 min', count: analyticsData.deepDives, hint: 'Longer guides' },
    { label: '30 min or more', count: analyticsData.longForm, hint: 'Papers and videos' },
  ];

  return (
    <div
      id="analytics-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="analytics-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-modal-title"
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border shadow-xl overflow-hidden text-slate-900 dark:text-ink"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.08] dark:border-white/[0.08] shrink-0">
          <div>
            <h2 id="analytics-modal-title" className="text-base font-semibold text-slate-900 dark:text-ink">
              Analytics
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              How your links break down by status, platform, tag and reading time.
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 border-b border-black/[0.08] dark:border-white/[0.08] shrink-0 overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('overview')} className={tabClass('overview')}>
            <PieChart className={tabIcon} />
            <span>Overview</span>
          </button>
          <button onClick={() => setActiveTab('platforms')} className={tabClass('platforms')}>
            <Layers className={tabIcon} />
            <span>Platforms</span>
          </button>
          <button onClick={() => setActiveTab('tags')} className={tabClass('tags')}>
            <Tag className={tabIcon} />
            <span>Tags</span>
          </button>
          <button onClick={() => setActiveTab('reading')} className={tabClass('reading')}>
            <Clock className={tabIcon} />
            <span>Reading</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6">

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-4 ${panel} space-y-1`}>
                  <div className={sectionLabel}>Links</div>
                  <div className="tabular-nums text-2xl font-semibold text-slate-900 dark:text-ink">
                    {analyticsData.total}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {analyticsData.favorites} starred · {analyticsData.archived} archived
                  </div>
                </div>

                <div className={`p-4 ${panel} space-y-1`}>
                  <div className={sectionLabel}>Read</div>
                  <div className="tabular-nums text-2xl font-semibold text-slate-900 dark:text-ink">
                    {analyticsData.completionRate}%
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {analyticsData.read} of {analyticsData.total} links
                  </div>
                </div>

                <div className={`p-4 ${panel} space-y-1`}>
                  <div className={sectionLabel}>Reading time</div>
                  <div className="tabular-nums text-2xl font-semibold text-slate-900 dark:text-ink">
                    {analyticsData.totalHours > 0 ? `${analyticsData.totalHours}h ` : ''}{analyticsData.remainingMins}m
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Estimated, all links
                  </div>
                </div>

                <div className={`p-4 ${panel} space-y-1`}>
                  <div className={sectionLabel}>Average AI score</div>
                  <div className="tabular-nums text-2xl font-semibold text-slate-900 dark:text-ink">
                    {analyticsData.avgAiScore}<span className="text-sm font-normal text-slate-400">/100</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Across scored links
                  </div>
                </div>
              </div>

              {/* Status breakdown */}
              <div className={`p-5 ${panel} space-y-4`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Reading status</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {analyticsData.read} of {analyticsData.total} read
                  </span>
                </div>

                <div className="w-full h-3 rounded-md overflow-hidden flex gap-0.5 bg-black/[0.06] dark:bg-white/[0.08]">
                  {statusRows.map((s) =>
                    s.count > 0 ? (
                      <div
                        key={s.status}
                        style={{ width: `${s.rate}%` }}
                        className={`h-full ${s.swatch} cursor-pointer`}
                        title={`${s.label}: ${s.count} links (${s.rate}%)`}
                        onClick={() => handleSelectStatus(s.status)}
                      />
                    ) : null
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {statusRows.map((s) => (
                    <button
                      key={s.status}
                      onClick={() => handleSelectStatus(s.status)}
                      className="p-3 rounded-lg border border-black/[0.08] dark:border-white/[0.08] hover:bg-black/5 dark:hover:bg-white/5 text-left transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                          <span className={`w-2 h-2 rounded-full ${s.swatch}`} />
                          <span>{s.label}</span>
                        </div>
                        <div className="tabular-nums text-lg font-semibold text-slate-900 dark:text-ink mt-0.5">
                          {s.count} <span className="text-xs font-normal text-slate-400">({s.rate}%)</span>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Top platforms */}
                <div className={`p-5 ${panel} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Top platforms</h3>
                    <button
                      onClick={() => setActiveTab('platforms')}
                      className="text-xs text-accent hover:underline"
                    >
                      View all ({analyticsData.platformsSorted.length})
                    </button>
                  </div>

                  <div className="space-y-1">
                    {analyticsData.platformsSorted.slice(0, 4).map((p) => {
                      const meta = getPlatformMeta(p.platform);
                      return (
                        <div
                          key={p.platform}
                          onClick={() => handleSelectPlatform(p.platform)}
                          className="cursor-pointer p-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center justify-between text-sm mb-1.5">
                            <div className="flex items-center gap-2">
                              {meta.icon}
                              <span>{meta.label}</span>
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                              {p.count} ({p.percentage}%)
                            </span>
                          </div>
                          <div className={barTrack}>
                            <div
                              style={{ width: `${Math.max(p.percentage, 4)}%` }}
                              className="h-full bg-accent rounded-full"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top categories */}
                <div className={`p-5 ${panel} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Categories</h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {analyticsData.categoriesSorted.length} total
                    </span>
                  </div>

                  <div className="space-y-1">
                    {analyticsData.categoriesSorted.slice(0, 4).map((c) => (
                      <div
                        key={c.category}
                        onClick={() => handleSelectCategory(c.category)}
                        className="cursor-pointer p-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="truncate">{c.category}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {c.count} ({c.percentage}%)
                          </span>
                        </div>
                        <div className={barTrack}>
                          <div
                            style={{ width: `${Math.max(c.percentage, 4)}%` }}
                            className="h-full bg-accent rounded-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Platforms */}
          {activeTab === 'platforms' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Click a platform to show only its links.
                </p>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {analyticsData.total} links
                </span>
              </div>

              <div className="space-y-2">
                {analyticsData.platformsSorted.map((item) => {
                  const meta = getPlatformMeta(item.platform);
                  return (
                    <div
                      key={item.platform}
                      onClick={() => handleSelectPlatform(item.platform)}
                      className={`p-3.5 ${panel} hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors cursor-pointer group`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {meta.icon}
                          <span className="text-sm font-medium">{meta.label}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm text-slate-900 dark:text-ink tabular-nums">
                            {item.count} <span className="text-xs text-slate-400">({item.percentage}%)</span>
                          </span>
                          <span className="text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            Filter <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>

                      <div className={barTrack}>
                        <div
                          style={{ width: `${Math.max(item.percentage, 2)}%` }}
                          className="h-full bg-accent rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags */}
          {activeTab === 'tags' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Your most used tags. Click one to filter.
                </p>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {analyticsData.tagsSorted.length} tags
                </span>
              </div>

              <div className={`p-5 ${panel} space-y-3`}>
                <div className={sectionLabel}>All tags</div>
                <div className="flex flex-wrap gap-2">
                  {analyticsData.tagsSorted.map((t, idx) => (
                    <button
                      key={t.tag}
                      onClick={() => handleSelectTag(t.tag)}
                      className={`px-2.5 py-1 rounded-md text-xs border transition-colors flex items-center gap-1.5 ${
                        idx < 3
                          ? 'border-accent/30 bg-accent/10 text-accent font-medium'
                          : 'border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <span>#{t.tag}</span>
                      <span className="text-slate-400 tabular-nums">{t.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className={sectionLabel}>By number of links</div>
                {analyticsData.tagsSorted.map((t, idx) => (
                  <div
                    key={t.tag}
                    onClick={() => handleSelectTag(t.tag)}
                    className={`p-3 ${panel} hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors cursor-pointer`}
                  >
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-5 tabular-nums">{idx + 1}</span>
                        <span className="text-slate-800 dark:text-slate-200">{t.tag}</span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {t.count} links ({t.percentage}%)
                      </span>
                    </div>
                    <div className={barTrack}>
                      <div
                        style={{ width: `${Math.max(t.percentage * 1.5, 4)}%` }}
                        className="h-full bg-accent rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reading */}
          {activeTab === 'reading' && (
            <div className="space-y-6">

              <div className={`p-5 ${panel} space-y-4`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Reading time</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    Total {analyticsData.totalHours}h {analyticsData.remainingMins}m
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {depthBuckets.map((b) => (
                    <div key={b.label} className={`p-3.5 ${panel} space-y-1`}>
                      <div className={sectionLabel}>{b.label}</div>
                      <div className="tabular-nums text-xl font-semibold text-slate-900 dark:text-ink">
                        {b.count}
                      </div>
                      <div className="text-xs text-slate-400">{b.hint}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`p-5 ${panel} space-y-3`}>
                <h3 className="text-sm font-medium">Other</h3>

                <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                  <div className="flex items-center justify-between py-3 text-sm">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className={iconClass} />
                      <div>
                        <div>AI summaries</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Links get a short summary when saved</div>
                      </div>
                    </div>
                    <span className="font-medium text-accent">On</span>
                  </div>

                  <div className="flex items-center justify-between py-3 text-sm">
                    <div className="flex items-center gap-2.5">
                      <Star className={iconClass} />
                      <div>
                        <div>Starred</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Links you marked as important</div>
                      </div>
                    </div>
                    <span className="font-medium text-slate-900 dark:text-ink tabular-nums">
                      {analyticsData.favorites} ({analyticsData.total > 0 ? Math.round((analyticsData.favorites / analyticsData.total) * 100) : 0}%)
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 text-sm">
                    <div className="flex items-center gap-2.5">
                      <Archive className={iconClass} />
                      <div>
                        <div>Archived</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Links moved out of the main list</div>
                      </div>
                    </div>
                    <span className="font-medium text-slate-900 dark:text-ink tabular-nums">
                      {analyticsData.archived}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-black/[0.08] dark:border-white/[0.08] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium border border-black/10 dark:border-white/10 rounded-md text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
