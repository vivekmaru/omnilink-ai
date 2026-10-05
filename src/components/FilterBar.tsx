import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, SlidersHorizontal, X } from 'lucide-react';
import { FilterState } from '../types';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  availableCategories: string[];
  availableTags: string[];
  activeCount?: number;
  totalCount?: number;
}

const selectClass =
  'w-full px-2.5 py-1.5 rounded-md text-xs border cursor-pointer text-slate-800 dark:text-slate-200 bg-white dark:bg-surface border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-accent';

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  availableCategories,
  availableTags,
  activeCount,
  totalCount,
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the filter pop-over on an outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const isFiltered =
    filters.readStatus !== 'all' ||
    filters.category !== 'all' ||
    filters.tag !== 'all' ||
    filters.platform !== 'all' ||
    filters.onlyFavorites ||
    filters.includeArchived ||
    filters.searchQuery.trim().length > 0;

  const chips: { key: 'category' | 'tag'; label: string }[] = [];
  if (filters.category !== 'all') chips.push({ key: 'category', label: filters.category });
  if (filters.tag !== 'all') chips.push({ key: 'tag', label: `#${filters.tag}` });

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
      className="px-3 sm:px-8 py-2 border-b flex items-center justify-between gap-3 text-xs transition-colors"
      style={{
        backgroundColor: 'var(--bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      {/* Left: one Filter button, the active filters, and Clear */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors ${
              open || chips.length > 0
                ? 'border-black/20 dark:border-white/20 text-slate-900 dark:text-ink'
                : 'border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-black/20 dark:hover:border-white/20'
            }`}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filter</span>
            {chips.length > 0 && <span className="tabular-nums text-accent font-medium">{chips.length}</span>}
          </button>

          {open && (
            <div
              role="dialog"
              aria-label="Filter links"
              className="absolute left-0 top-full mt-1.5 z-30 w-60 p-3 space-y-3 rounded-lg bg-white dark:bg-surface border border-black/10 dark:border-white/10 shadow-lg"
            >
              <label className="block space-y-1">
                <span className="text-slate-500 dark:text-slate-400">Category</span>
                <select
                  value={filters.category}
                  onChange={(e) => onFilterChange({ category: e.target.value })}
                  className={selectClass}
                >
                  <option value="all">Any category</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
              {availableTags.length > 0 && (
                <label className="block space-y-1">
                  <span className="text-slate-500 dark:text-slate-400">Tag</span>
                  <select
                    value={filters.tag}
                    onChange={(e) => onFilterChange({ tag: e.target.value })}
                    className={selectClass}
                  >
                    <option value="all">Any tag</option>
                    {availableTags.map((tag) => (
                      <option key={tag} value={tag}>
                        #{tag}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
        </div>

        {chips.map((chip) => (
          <span
            key={chip.key}
            className="hidden sm:inline-flex items-center gap-1 max-w-[12rem] pl-2 pr-1 py-1 rounded-md bg-black/[0.05] dark:bg-white/[0.08] text-slate-700 dark:text-slate-200"
          >
            <span className="truncate">{chip.label}</span>
            <button
              type="button"
              onClick={() => onFilterChange({ [chip.key]: 'all' })}
              className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-100"
              aria-label={`Remove ${chip.label} filter`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {isFiltered && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="shrink-0 px-1.5 py-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline-offset-2 hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Right: result count and sort */}
      <div className="flex items-center gap-3 shrink-0 text-slate-500 dark:text-slate-400">
        {activeCount !== undefined && totalCount !== undefined && (
          <span className="hidden sm:inline tabular-nums">
            {activeCount === totalCount ? `${totalCount} links` : `${activeCount} of ${totalCount}`}
          </span>
        )}

        <label className="flex items-center gap-1.5">
          <ArrowUpDown className="w-3 h-3" />
          <span className="sr-only">Sort by</span>
          <select
            value={filters.sortBy}
            onChange={(e) =>
              onFilterChange({
                sortBy: e.target.value as FilterState['sortBy'],
              })
            }
            className="bg-transparent border-none text-xs font-medium text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="newest" className="bg-white dark:bg-surface">Newest</option>
            <option value="oldest" className="bg-white dark:bg-surface">Oldest</option>
            <option value="title" className="bg-white dark:bg-surface">Title</option>
            <option value="readingTime" className="bg-white dark:bg-surface">Reading time</option>
            <option value="aiScore" className="bg-white dark:bg-surface">Relevance</option>
          </select>
        </label>
      </div>
    </div>
  );
};
