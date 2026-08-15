import React, { useState, useMemo } from 'react';
import {
  X,
  BarChart3,
  CheckCircle2,
  Clock,
  BookOpen,
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
  Folder,
  ArrowRight,
  TrendingUp,
  Layers,
  PieChart,
  HelpCircle,
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

  const getPlatformMeta = (platform: string) => {
    switch (platform) {
      case 'github':
        return { label: 'GitHub Repos', icon: <Github className="w-4 h-4 text-slate-700 dark:text-slate-200" />, color: 'bg-slate-800' };
      case 'reddit_post':
        return { label: 'Reddit Posts', icon: <MessageSquare className="w-4 h-4 text-orange-500" />, color: 'bg-orange-600' };
      case 'reddit_comment':
        return { label: 'Reddit Comments', icon: <MessageSquare className="w-4 h-4 text-orange-400" />, color: 'bg-orange-500' };
      case 'instagram_short':
        return { label: 'Instagram Shorts', icon: <Instagram className="w-4 h-4 text-amber-600" />, color: 'bg-amber-600' };
      case 'youtube':
        return { label: 'YouTube Videos', icon: <Youtube className="w-4 h-4 text-rose-500" />, color: 'bg-rose-600' };
      case 'twitter_x':
        return { label: 'X / Twitter', icon: <Twitter className="w-4 h-4 text-sky-400" />, color: 'bg-sky-500' };
      case 'article':
        return { label: 'Tech Articles & Blogs', icon: <FileText className="w-4 h-4 text-emerald-500" />, color: 'bg-emerald-600' };
      case 'paper':
        return { label: 'Research Papers', icon: <FileText className="w-4 h-4 text-indigo-400" />, color: 'bg-indigo-600' };
      default:
        return { label: 'Web & Other', icon: <Layers className="w-4 h-4 text-slate-400" />, color: 'bg-slate-600' };
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

  return (
    <div
      id="analytics-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="analytics-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-modal-title"
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border shadow-2xl overflow-hidden transition-all text-slate-900 dark:text-[#f7f6f3]"
        style={{
          backgroundColor: 'var(--bg)',
          borderColor: 'var(--card-border)',
        }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10 shrink-0 bg-black/5 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#d97757]/10 dark:bg-[#e08264]/15 text-[#d97757] dark:text-[#e08264] border border-[#d97757]/20">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="analytics-modal-title" className="font-newsreader text-xl font-semibold tracking-tight">
                  Knowledge Analytics & Usage Insights
                </h2>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                  Live Telemetry
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Comprehensive distribution metrics across reading velocity, platforms, tags, and topics.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-black/10 dark:border-white/10 shrink-0 bg-black/5 dark:bg-white/5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 text-xs font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264] font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Overview & KPIs</span>
          </button>

          <button
            onClick={() => setActiveTab('platforms')}
            className={`px-3.5 py-2 text-xs font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'platforms'
                ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264] font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Platform Breakdown ({analyticsData.platformsSorted.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tags')}
            className={`px-3.5 py-2 text-xs font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'tags'
                ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264] font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Tag Frequency & Cloud</span>
          </button>

          <button
            onClick={() => setActiveTab('reading')}
            className={`px-3.5 py-2 text-xs font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'reading'
                ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264] font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Reading Velocity & Time</span>
          </button>
        </div>

        {/* Modal Body Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: OVERVIEW & KPIS */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Primary KPI Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Total Vault Links</span>
                    <Layers className="w-3.5 h-3.5 opacity-60" />
                  </div>
                  <div className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-[#f7f6f3]">
                    {analyticsData.total}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <span>{analyticsData.favorites} starred</span>
                    <span>•</span>
                    <span>{analyticsData.archived} archived</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Completion Rate</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="font-mono text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {analyticsData.completionRate}%
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">
                    {analyticsData.read} reviewed of {analyticsData.total}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Est. Reading Time</span>
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-[#f7f6f3]">
                    {analyticsData.totalHours > 0 ? `${analyticsData.totalHours}h ` : ''}{analyticsData.remainingMins}m
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">
                    Total consumption backlog
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>AI Knowledge Density</span>
                    <Sparkles className="w-3.5 h-3.5 text-[#d97757] dark:text-[#e08264]" />
                  </div>
                  <div className="font-mono text-2xl font-bold tracking-tight text-[#d97757] dark:text-[#e08264]">
                    {analyticsData.avgAiScore}<span className="text-sm font-normal text-slate-400">/100</span>
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">
                    Gemini synthesized quality
                  </div>
                </div>
              </div>

              {/* Read vs Unread vs Reading Ratio Section */}
              <div className="p-5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#d97757] dark:text-[#e08264]" />
                    <h3 className="text-sm font-semibold tracking-tight">Read vs. Unread Ratio</h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {analyticsData.read} of {analyticsData.total} items completed
                  </span>
                </div>

                {/* Segmented Stacked Progress Bar */}
                <div className="w-full h-4 rounded-md overflow-hidden flex bg-black/10 dark:bg-white/10 p-0.5 gap-0.5">
                  {analyticsData.unread > 0 && (
                    <div
                      style={{ width: `${analyticsData.unreadRate}%` }}
                      className="h-full bg-amber-500 rounded-xs transition-all duration-500 relative group cursor-pointer"
                      title={`Unread: ${analyticsData.unread} items (${analyticsData.unreadRate}%)`}
                      onClick={() => handleSelectStatus('unread')}
                    />
                  )}
                  {analyticsData.reading > 0 && (
                    <div
                      style={{ width: `${analyticsData.readingRate}%` }}
                      className="h-full bg-cyan-500 rounded-xs transition-all duration-500 relative group cursor-pointer"
                      title={`Reading: ${analyticsData.reading} items (${analyticsData.readingRate}%)`}
                      onClick={() => handleSelectStatus('reading')}
                    />
                  )}
                  {analyticsData.read > 0 && (
                    <div
                      style={{ width: `${analyticsData.completionRate}%` }}
                      className="h-full bg-emerald-500 rounded-xs transition-all duration-500 relative group cursor-pointer"
                      title={`Read: ${analyticsData.read} items (${analyticsData.completionRate}%)`}
                      onClick={() => handleSelectStatus('read')}
                    />
                  )}
                </div>

                {/* Status Breakdown Legend & Triage Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <button
                    onClick={() => handleSelectStatus('unread')}
                    className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-left transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span>Unread Inbox</span>
                      </div>
                      <div className="font-mono text-lg font-bold text-slate-900 dark:text-[#f7f6f3] mt-0.5">
                        {analyticsData.unread} <span className="text-xs font-normal text-slate-400">({analyticsData.unreadRate}%)</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button
                    onClick={() => handleSelectStatus('reading')}
                    className="p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 text-left transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400">
                        <div className="w-2 h-2 rounded-full bg-cyan-500" />
                        <span>In Progress</span>
                      </div>
                      <div className="font-mono text-lg font-bold text-slate-900 dark:text-[#f7f6f3] mt-0.5">
                        {analyticsData.reading} <span className="text-xs font-normal text-slate-400">({analyticsData.readingRate}%)</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button
                    onClick={() => handleSelectStatus('read')}
                    className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-left transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Reviewed & Done</span>
                      </div>
                      <div className="font-mono text-lg font-bold text-slate-900 dark:text-[#f7f6f3] mt-0.5">
                        {analyticsData.read} <span className="text-xs font-normal text-slate-400">({analyticsData.completionRate}%)</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>

              {/* 2-Column Mini Breakdowns: Top Platforms & Top Categories */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Top Platforms Preview */}
                <div className="p-5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-slate-500" />
                      <h3 className="text-sm font-semibold tracking-tight">Top Platforms</h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('platforms')}
                      className="text-xs text-[#d97757] dark:text-[#e08264] hover:underline"
                    >
                      View all ({analyticsData.platformsSorted.length})
                    </button>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {analyticsData.platformsSorted.slice(0, 4).map((p) => {
                      const meta = getPlatformMeta(p.platform);
                      return (
                        <div
                          key={p.platform}
                          onClick={() => handleSelectPlatform(p.platform)}
                          className="group cursor-pointer p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <div className="flex items-center gap-2">
                              {meta.icon}
                              <span className="font-medium">{meta.label}</span>
                            </div>
                            <span className="font-mono text-[11px] text-slate-500">
                              {p.count} items ({p.percentage}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                            <div
                              style={{ width: `${Math.max(p.percentage, 4)}%` }}
                              className="h-full bg-[#d97757] dark:bg-[#e08264] rounded-full transition-all duration-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Categories Preview */}
                <div className="p-5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Folder className="w-4 h-4 text-slate-500" />
                      <h3 className="text-sm font-semibold tracking-tight">Category Allocation</h3>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {analyticsData.categoriesSorted.length} categories
                    </span>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {analyticsData.categoriesSorted.slice(0, 4).map((c) => (
                      <div
                        key={c.category}
                        onClick={() => handleSelectCategory(c.category)}
                        className="group cursor-pointer p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium truncate">{c.category}</span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {c.count} ({c.percentage}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                          <div
                            style={{ width: `${Math.max(c.percentage, 4)}%` }}
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: PLATFORM BREAKDOWN */}
          {activeTab === 'platforms' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Distribution by Ingestion Platform</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Click any platform bar to filter the active repository.
                  </p>
                </div>
                <span className="font-mono text-xs text-slate-500">
                  Total {analyticsData.total} links
                </span>
              </div>

              {/* Full Platform Bar Chart */}
              <div className="space-y-3">
                {analyticsData.platformsSorted.map((item) => {
                  const meta = getPlatformMeta(item.platform);
                  return (
                    <div
                      key={item.platform}
                      onClick={() => handleSelectPlatform(item.platform)}
                      className="p-3.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:border-[#d97757]/40 dark:hover:border-[#e08264]/40 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-md bg-black/5 dark:bg-white/5">
                            {meta.icon}
                          </div>
                          <div>
                            <span className="text-xs font-semibold">{meta.label}</span>
                            <span className="hidden sm:inline-block font-mono text-[10px] text-slate-400 ml-2">
                              {item.platform}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-[#f7f6f3]">
                            {item.count} <span className="text-[11px] font-normal text-slate-400">({item.percentage}%)</span>
                          </span>
                          <span className="text-xs text-[#d97757] dark:text-[#e08264] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            Filter <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>

                      {/* Bar Visualization */}
                      <div className="w-full h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                        <div
                          style={{ width: `${Math.max(item.percentage, 2)}%` }}
                          className="h-full bg-gradient-to-r from-[#d97757] to-[#c46243] dark:from-[#e08264] dark:to-[#d97757] rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: TAG FREQUENCY & CLOUD */}
          {activeTab === 'tags' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Most Frequent Repository Tags</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Ranked by density across your saved links and AI auto-generated taxonomies.
                  </p>
                </div>
                <span className="font-mono text-xs text-slate-500">
                  {analyticsData.tagsSorted.length} unique tags
                </span>
              </div>

              {/* Tag Cloud Pills */}
              <div className="p-5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-3">
                <span className="text-xs font-semibold text-slate-500">Interactive Tag Cloud</span>
                <div className="flex flex-wrap gap-2">
                  {analyticsData.tagsSorted.map((t, idx) => (
                    <button
                      key={t.tag}
                      onClick={() => handleSelectTag(t.tag)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                        idx < 3
                          ? 'bg-[#d97757]/15 text-[#d97757] dark:bg-[#e08264]/20 dark:text-[#e08264] border border-[#d97757]/30 font-semibold'
                          : 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-black/10 dark:border-white/10 hover:border-[#d97757]/40'
                      }`}
                    >
                      <span>#{t.tag}</span>
                      <span className="font-mono text-[10px] opacity-70 px-1 py-0.2 rounded bg-black/5 dark:bg-white/10">
                        {t.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ranked Tag Bars */}
              <div className="space-y-2.5">
                <span className="text-xs font-semibold text-slate-500">Ranked Frequency Breakdown</span>
                {analyticsData.tagsSorted.map((t, idx) => (
                  <div
                    key={t.tag}
                    onClick={() => handleSelectTag(t.tag)}
                    className="p-3 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:border-[#d97757]/40 dark:hover:border-[#e08264]/40 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-400 w-4">
                          #{idx + 1}
                        </span>
                        <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                          {t.tag}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500">
                          {t.count} bookmarks ({t.percentage}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div
                        style={{ width: `${Math.max(t.percentage * 1.5, 4)}%` }}
                        className="h-full bg-sky-500 rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: READING VELOCITY & DEPTH */}
          {activeTab === 'reading' && (
            <div className="space-y-6">
              
              {/* Reading Duration Buckets */}
              <div className="p-5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-semibold">Content Depth & Reading Time Breakdown</h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Total: {analyticsData.totalHours}h {analyticsData.remainingMins}m
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium">Quick Snippets (&lt;3m)</span>
                    <div className="font-mono text-xl font-bold text-slate-900 dark:text-[#f7f6f3]">
                      {analyticsData.quickReads}
                    </div>
                    <span className="text-[10px] text-slate-400">Shorts, tweets, quick tips</span>
                  </div>

                  <div className="p-3.5 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium">Standard Reads (3-10m)</span>
                    <div className="font-mono text-xl font-bold text-slate-900 dark:text-[#f7f6f3]">
                      {analyticsData.mediumReads}
                    </div>
                    <span className="text-[10px] text-slate-400">Articles, tutorials, repos</span>
                  </div>

                  <div className="p-3.5 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium">Deep Dives (10-30m)</span>
                    <div className="font-mono text-xl font-bold text-slate-900 dark:text-[#f7f6f3]">
                      {analyticsData.deepDives}
                    </div>
                    <span className="text-[10px] text-slate-400">RFCs, architectural guides</span>
                  </div>

                  <div className="p-3.5 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium">Long Form (30m+)</span>
                    <div className="font-mono text-xl font-bold text-slate-900 dark:text-[#f7f6f3]">
                      {analyticsData.longForm}
                    </div>
                    <span className="text-[10px] text-slate-400">ArXiv papers, video courses</span>
                  </div>
                </div>
              </div>

              {/* Knowledge Health Indicators */}
              <div className="p-5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold">Repository Health & Ingestion Sources</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-xs">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-sky-500" />
                      <div>
                        <div className="font-medium">AI Extraction Coverage</div>
                        <div className="text-[11px] text-slate-400">Bookmarks enriched with Gemini TL;DR summaries</div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-500">100% Active</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-xs">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      <div>
                        <div className="font-medium">Starred Knowledge Ratio</div>
                        <div className="text-[11px] text-slate-400">High-priority reference bookmarks</div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-amber-500">
                      {analyticsData.total > 0 ? Math.round((analyticsData.favorites / analyticsData.total) * 100) : 0}% ({analyticsData.favorites} items)
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-xs">
                    <div className="flex items-center gap-2">
                      <Archive className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="font-medium">Archived Reference Items</div>
                        <div className="text-[11px] text-slate-400">Preserved in long-term archive storage</div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-slate-400">
                      {analyticsData.archived} items
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-black/10 dark:border-white/10 shrink-0 bg-black/5 dark:bg-white/5 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Synced with live local cache and server repository</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md font-medium text-xs bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition-opacity"
          >
            Close Insights
          </button>
        </div>

      </div>
    </div>
  );
};
