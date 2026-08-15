import React from 'react';
import {
  CheckCircle2,
  Star,
  ArrowRight,
  Circle,
} from 'lucide-react';
import { LinkItem, ReadStatus } from '../types';

interface KanbanViewProps {
  links: LinkItem[];
  onOpenDetail: (link: LinkItem) => void;
  onUpdateStatus: (id: string, newStatus: ReadStatus) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
}

interface ColumnConfig {
  id: ReadStatus;
  title: string;
  icon: React.ReactNode;
  badgeClass: string;
  nextStatus?: ReadStatus;
  nextLabel?: string;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  links,
  onOpenDetail,
  onUpdateStatus,
  onToggleFavorite,
}) => {
  const statusColumns: ColumnConfig[] = [
    {
      id: 'unread',
      title: 'Unread Queue',
      icon: <Circle className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />,
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      nextStatus: 'reading',
      nextLabel: 'Start Reading',
    },
    {
      id: 'reading',
      title: 'In Progress',
      icon: <Circle className="w-2.5 h-2.5 fill-cyan-500 text-cyan-500" />,
      badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
      nextStatus: 'read',
      nextLabel: 'Mark Reviewed',
    },
    {
      id: 'read',
      title: 'Reviewed Vault',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Switcher */}
      <div className="flex items-center justify-between font-mono text-xs">
        <div className="text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
          Pipeline Board ({links.length} total links)
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statusColumns.map((col) => {
          const colLinks = links.filter((l) => l.readStatus === col.id);
          return (
            <div
              key={col.id}
              className="border rounded-2xl p-4 flex flex-col min-h-[550px]"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
              }}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 mb-4">
                <div className="flex items-center gap-2">
                  {col.icon}
                  <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                    {col.title}
                  </span>
                </div>
                <span
                  className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md border ${col.badgeClass}`}
                >
                  {colLinks.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 space-y-3 overflow-y-auto">
                {colLinks.map((link) => {
                  const tldr = link.aiSummary?.tldr || link.summary?.tldr || link.description;
                  return (
                    <div
                      key={link.id}
                      onClick={() => onOpenDetail(link)}
                      className="group bg-white dark:bg-[#1b1b1f] border border-slate-200 dark:border-white/10 hover:border-[#d97757] dark:hover:border-[#e08264] rounded-xl p-3.5 shadow-xs cursor-pointer transition-all hover:-translate-y-0.5 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded">
                          {link.platform.replace('_', ' ')}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(link.id, !!link.isFavorite);
                          }}
                          className="text-slate-400 hover:text-amber-500 dark:text-slate-500 dark:hover:text-amber-400 transition-colors"
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              link.isFavorite ? 'fill-amber-400 text-amber-400' : ''
                            }`}
                          />
                        </button>
                      </div>

                      <h4 className="font-newsreader text-base font-medium text-slate-900 dark:text-slate-100 line-clamp-2 group-hover:text-[#d97757] dark:group-hover:text-[#e08264] transition-colors leading-snug">
                        {link.title || link.url}
                      </h4>

                      {tldr && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {tldr}
                        </p>
                      )}

                      {/* Quick Move to Next Column */}
                      {col.nextStatus && (
                        <div className="pt-2 border-t border-black/5 dark:border-white/[0.04] flex items-center justify-between">
                          <span className="font-mono text-[10px] text-slate-400">
                            {link.category}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (col.nextStatus) onUpdateStatus(link.id, col.nextStatus);
                            }}
                            className="flex items-center gap-1 text-[10px] font-medium text-[#d97757] dark:text-[#e08264] hover:text-[#c46243] bg-[#d97757]/10 dark:bg-[#e08264]/10 px-2 py-0.5 rounded transition-colors"
                          >
                            <span>{col.nextLabel}</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
