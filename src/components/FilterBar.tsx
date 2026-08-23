import React from 'react';
import {
  Star,
  Archive,
  ArrowUpDown,
  Tag,
  Folder,
  X,
  CheckCircle2,
} from 'lucide-react';
import { FilterState } from '../types';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  availableCategories: string[];
  availableTags: string[];
  activeCount?: number;
  totalCount?: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  availableCategories,
  availableTags,
  activeCount,
  totalCount,
}) => {
  const isFiltered =
    filters.readStatus !== 'all' ||
    filters.category !== 'all' ||
    filters.tag !== 'all' ||
    filters.platform !== 'all' ||
    filters.onlyFavorites ||
    filters.includeArchived ||
    filters.searchQuery.trim().length > 0;

  const handleClearFilters = () => {
    onFilterChange({
      readStatus: 'all',
      category: 'all',
      tag: 'all',
      platform: 'all',
      onlyFavorites: false,
      includeArchived: false,
      searchQuery: '',
    });
  };

  return (
    <div
      className="px-3 sm:px-8 py-2 border-b flex items-center justify-between gap-2.5 text-xs transition-colors overflow-x-auto no-scrollbar"
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      {/* Left: Consolidated Filter Controls with horizontal scroll on mobile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Status Segmented Pills */}
        <div className="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
          <button
            onClick={() => onFilterChange({ readStatus: 'all' })}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
              filters.readStatus === 'all'
                ? 'bg-white dark:bg-[#1b1b1f] shadow-xs text-slate-900 dark:text-slate-100 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => onFilterChange({ readStatus: 'unread' })}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 ${
              filters.readStatus === 'unread'
                ? 'bg-white dark:bg-[#1b1b1f] shadow-xs text-amber-700 dark:text-amber-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Unread</span>
          </button>
          <button
            onClick={() => onFilterChange({ readStatus: 'reading' })}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 ${
              filters.readStatus === 'reading'
                ? 'bg-white dark:bg-[#1b1b1f] shadow-xs text-cyan-700 dark:text-cyan-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            <span>Reading</span>
          </button>
          <button
            onClick={() => onFilterChange({ readStatus: 'read' })}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 ${
              filters.readStatus === 'read'
                ? 'bg-white dark:bg-[#1b1b1f] shadow-xs text-emerald-700 dark:text-emerald-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Reviewed</span>
          </button>
        </div>

        {/* Category Dropdown */}
        <div className="relative">
          <select
            value={filters.category}
            onChange={(e) => onFilterChange({ category: e.target.value })}
            className="pl-3 pr-7 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer text-slate-800 dark:text-slate-200 bg-white dark:bg-[#18181c] border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-[#d97757] appearance-none shadow-xs"
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <Folder className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Tag Dropdown */}
        {availableTags.length > 0 && (
          <div className="relative">
            <select
              value={filters.tag}
              onChange={(e) => onFilterChange({ tag: e.target.value })}
              className="pl-3 pr-7 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all cursor-pointer text-slate-800 dark:text-slate-200 bg-white dark:bg-[#18181c] border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-[#d97757] appearance-none shadow-xs"
              aria-label="Filter by tag"
            >
              <option value="all">All Tags</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>
            <Tag className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}

        {/* Starred Toggle */}
        <button
          onClick={() => onFilterChange({ onlyFavorites: !filters.onlyFavorites })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-xs ${
            filters.onlyFavorites
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 font-semibold'
              : 'bg-white dark:bg-[#18181c] border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
          }`}
          title="Filter by starred links"
          aria-label="Filter by starred links"
        >
          <Star
            className={`w-3.5 h-3.5 ${
              filters.onlyFavorites ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
            }`}
          />
          <span>Starred</span>
        </button>

        {/* Archived Toggle */}
        <button
          onClick={() => onFilterChange({ includeArchived: !filters.includeArchived })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-xs ${
            filters.includeArchived
              ? 'bg-black/10 dark:bg-white/10 border-black/20 dark:border-white/20 text-slate-900 dark:text-slate-100 font-semibold'
              : 'bg-white dark:bg-[#18181c] border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
          }`}
          title="View archived links"
          aria-label="View archived links"
        >
          <Archive className="w-3.5 h-3.5 text-slate-400" />
          <span>Archived</span>
        </button>

        {/* Active Filters Clear Button */}
        {isFiltered && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold text-rose-500 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
            aria-label="Clear active filters"
          >
            <X className="w-3 h-3" />
            <span>Clear filters</span>
          </button>
        )}
      </div>

      {/* Right: Sorters & Result Count */}
      <div className="flex items-center gap-3 shrink-0">
        {activeCount !== undefined && totalCount !== undefined && (
          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
            {activeCount} of {totalCount}
          </span>
        )}

        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
          <ArrowUpDown className="w-3 h-3 opacity-60" />
          <span className="opacity-70">Sort:</span>
          <select
            value={filters.sortBy}
            onChange={(e) =>
              onFilterChange({
                sortBy: e.target.value as FilterState['sortBy'],
              })
            }
            className="bg-transparent border-none text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer hover:text-[#d97757] dark:hover:text-[#e08264] transition-colors"
            aria-label="Sort bookmarks by"
          >
            <option value="newest" className="bg-white dark:bg-[#1f1e1c]">Newest</option>
            <option value="oldest" className="bg-white dark:bg-[#1f1e1c]">Oldest</option>
            <option value="title" className="bg-white dark:bg-[#1f1e1c]">Title (A-Z)</option>
            <option value="readingTime" className="bg-white dark:bg-[#1f1e1c]">Read Time</option>
            <option value="aiScore" className="bg-white dark:bg-[#1f1e1c]">AI Relevance</option>
          </select>
        </div>
      </div>
    </div>
  );
};
