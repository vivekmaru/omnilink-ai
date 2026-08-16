import React, { useState } from 'react';
import {
  CheckCircle2,
  Star,
  ArrowRight,
  Circle,
  GripVertical,
  Inbox,
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
  emptyHint: string;
  nextStatus?: ReadStatus;
  nextLabel?: string;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  links,
  onOpenDetail,
  onUpdateStatus,
  onToggleFavorite,
}) => {
  const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null);
  const [activeDropColumn, setActiveDropColumn] = useState<ReadStatus | null>(null);

  const statusColumns: ColumnConfig[] = [
    {
      id: 'unread',
      title: 'Unread Queue',
      icon: <Circle className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />,
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      emptyHint: 'Inbox clear — all new items triaged',
      nextStatus: 'reading',
      nextLabel: 'Start Reading',
    },
    {
      id: 'reading',
      title: 'In Progress',
      icon: <Circle className="w-2.5 h-2.5 fill-cyan-500 text-cyan-500" />,
      badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
      emptyHint: 'No active reading sessions in progress',
      nextStatus: 'read',
      nextLabel: 'Mark Reviewed',
    },
    {
      id: 'read',
      title: 'Reviewed Vault',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      emptyHint: 'Completed readings will archive here',
    },
  ];

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedLinkId(id);
  };

  const handleDragEnd = () => {
    setDraggedLinkId(null);
    setActiveDropColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: ReadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropColumn !== columnId) {
      setActiveDropColumn(columnId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, columnId: ReadStatus) => {
    // Only reset if leaving the column element itself
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (activeDropColumn === columnId) {
      setActiveDropColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: ReadStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedLinkId;
    if (id) {
      const link = links.find((l) => l.id === id);
      if (link && link.readStatus !== targetStatus) {
        onUpdateStatus(id, targetStatus);
      }
    }
    setDraggedLinkId(null);
    setActiveDropColumn(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Switcher Info */}
      <div className="flex items-center justify-between font-mono text-xs">
        <div className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px] flex items-center gap-2">
          <span>Pipeline Board ({links.length} total)</span>
          <span className="opacity-60 text-[10px] hidden sm:inline font-normal">
            • Drag and drop cards between lanes to triage
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statusColumns.map((col) => {
          const colLinks = links.filter((l) => l.readStatus === col.id);
          const isDropTarget = activeDropColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`border rounded-2xl p-4 flex flex-col min-h-[550px] transition-all duration-200 ${
                isDropTarget
                  ? 'ring-2 ring-[#d97757] dark:ring-[#e08264] border-[#d97757] dark:border-[#e08264] bg-[#d97757]/5 dark:bg-[#e08264]/5 shadow-md scale-[1.005]'
                  : ''
              }`}
              style={{
                backgroundColor: isDropTarget ? undefined : 'var(--card-bg)',
                borderColor: isDropTarget ? undefined : 'var(--card-border)',
              }}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 mb-3 select-none">
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
                {colLinks.length === 0 ? (
                  <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-black/10 dark:border-white/10 rounded-xl text-slate-400 dark:text-slate-500 space-y-1.5">
                    <Inbox className="w-5 h-5 opacity-40" />
                    <p className="text-[11px] font-medium">{col.emptyHint}</p>
                    <p className="text-[10px] font-mono opacity-60">Drop cards here</p>
                  </div>
                ) : (
                  colLinks.map((link) => {
                    const tldr = link.aiSummary?.tldr || link.summary?.tldr || link.description;
                    const isDragging = draggedLinkId === link.id;

                    return (
                      <div
                        key={link.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, link.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onOpenDetail(link)}
                        className={`group bg-white dark:bg-[#1b1b1f] border border-slate-200/80 dark:border-white/10 hover:border-[#d97757] dark:hover:border-[#e08264] rounded-xl p-3.5 shadow-2xs cursor-grab active:cursor-grabbing transition-all hover:-translate-y-0.5 space-y-2.5 animate-card-entrance ${
                          isDragging ? 'opacity-40 scale-95 border-dashed border-[#d97757]' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            <span className="font-mono text-[10px] uppercase font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded truncate">
                              {link.platform.replace('_', ' ')}
                            </span>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(link.id, !!link.isFavorite);
                            }}
                            className="text-slate-400 hover:text-amber-500 dark:text-slate-500 dark:hover:text-amber-400 transition-colors p-0.5"
                            title={link.isFavorite ? 'Remove star' : 'Star link'}
                            aria-label={link.isFavorite ? 'Remove star' : 'Star link'}
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
                            <span className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                              {link.category || 'General'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (col.nextStatus) onUpdateStatus(link.id, col.nextStatus);
                              }}
                              className="flex items-center gap-1 text-[10px] font-medium text-[#d97757] dark:text-[#e08264] hover:text-[#c46243] bg-[#d97757]/10 dark:bg-[#e08264]/10 hover:bg-[#d97757]/20 px-2 py-0.5 rounded transition-all active:scale-95"
                            >
                              <span>{col.nextLabel}</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

