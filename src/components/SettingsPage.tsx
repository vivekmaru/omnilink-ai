import React from 'react';
import { ArrowLeft, Cpu, Chrome, Share2, FileDown, ShieldCheck, KeyRound } from 'lucide-react';
import { LinkItem } from '../types';
import { SettingsSection } from '../utils/route';

const ModelOrchestratorModal = React.lazy(() => import('./ModelOrchestratorModal').then((m) => ({ default: m.ModelOrchestratorModal })));
const ExtensionModal = React.lazy(() => import('./ExtensionModal').then((m) => ({ default: m.ExtensionModal })));
const MobileShareModal = React.lazy(() => import('./MobileShareModal').then((m) => ({ default: m.MobileShareModal })));
const ExportModal = React.lazy(() => import('./ExportModal').then((m) => ({ default: m.ExportModal })));
const BackupModal = React.lazy(() => import('./BackupModal').then((m) => ({ default: m.BackupModal })));
const ServiceTokensModal = React.lazy(() => import('./ServiceTokensModal').then((m) => ({ default: m.ServiceTokensModal })));

const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: 'ai-models', label: 'AI models', icon: <Cpu className="w-4 h-4" /> },
  { id: 'extension', label: 'Chrome extension', icon: <Chrome className="w-4 h-4" /> },
  { id: 'mobile', label: 'Mobile sharing', icon: <Share2 className="w-4 h-4" /> },
  { id: 'export', label: 'Export to Markdown', icon: <FileDown className="w-4 h-4" /> },
  { id: 'backup', label: 'Backup and restore', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'tokens', label: 'Service tokens', icon: <KeyRound className="w-4 h-4" /> },
];

interface SettingsPageProps {
  section: SettingsSection | null;
  onSelectSection: (section: SettingsSection) => void;
  onBack: () => void;
  canManageTokens: boolean;
  links: LinkItem[];
  filteredLinks: LinkItem[];
  selectedIds: string[];
  onLinksRestored: (restored: LinkItem[]) => void;
  onSimulateShare: (url: string, title: string) => void;
  onToast: (type: 'success' | 'info' | 'error' | 'ai', message: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  section,
  onSelectSection,
  onBack,
  canManageTokens,
  links,
  filteredLinks,
  selectedIds,
  onLinksRestored,
  onSimulateShare,
  onToast,
}) => {
  const sections = SECTIONS.filter((s) => s.id !== 'tokens' || canManageTokens);
  const active = sections.find((s) => s.id === section)?.id ?? sections[0].id;

  const renderPanel = () => {
    const common = { isOpen: true, onClose: onBack, variant: 'page' as const };
    switch (active) {
      case 'ai-models':
        return <ModelOrchestratorModal {...common} />;
      case 'extension':
        return <ExtensionModal {...common} />;
      case 'mobile':
        return <MobileShareModal {...common} onSimulateShare={onSimulateShare} />;
      case 'export':
        return (
          <ExportModal
            {...common}
            allLinks={links}
            filteredLinks={filteredLinks}
            selectedIds={selectedIds}
            onToast={onToast}
          />
        );
      case 'backup':
        return <BackupModal {...common} links={links} onLinksRestored={onLinksRestored} />;
      case 'tokens':
        return <ServiceTokensModal {...common} />;
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--card-bg)' }}>
      <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5 border-b border-black/10 dark:border-white/10 shrink-0 text-sm">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 -ml-2 mr-1 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Back to links"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <h1 className="font-medium text-slate-900 dark:text-[#f7f6f3]">Settings</h1>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        <nav
          aria-label="Settings sections"
          className="shrink-0 md:w-56 border-b md:border-b-0 md:border-r border-black/10 dark:border-white/10 p-2 md:p-3 flex md:flex-col gap-0.5 overflow-x-auto"
        >
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectSection(s.id)}
              aria-current={active === s.id ? 'page' : undefined}
              className={`shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors cursor-pointer ${
                active === s.id
                  ? 'bg-black/5 dark:bg-white/10 text-slate-900 dark:text-white font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <span className="text-slate-500 dark:text-slate-400">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0 min-h-0">
          <React.Suspense
            fallback={
              <div className="p-16">
                <div className="w-6 h-6 border-2 border-[#d97757] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            }
          >
            <div key={active} className="h-full">
              {renderPanel()}
            </div>
          </React.Suspense>
        </div>
      </div>
    </div>
  );
};
