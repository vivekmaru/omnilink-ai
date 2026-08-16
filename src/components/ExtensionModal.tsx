import React, { useState } from 'react';
import {
  X,
  Chrome,
  FolderDown,
  Copy,
  Check,
} from 'lucide-react';
import { generateBookmarkletCode, generateExtensionZip } from '../services/extensionGenerator';

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExtensionModal: React.FC<ExtensionModalProps> = ({ isOpen, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const bookmarkletCode = generateBookmarkletCode(currentOrigin);

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      const zipBlob = await generateExtensionZip({ appUrl: currentOrigin });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'OmniLink-AI-Chrome-Extension.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Extension zip generation failed:', e);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopiedBookmarklet(true);
    setTimeout(() => setCopiedBookmarklet(false), 2000);
  };

  return (
    <div
      id="extension-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="extension-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extension-modal-title"
        className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col text-slate-900 dark:text-[#f7f6f3] transition-all"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] border border-[#d97757]/20 flex items-center justify-center shrink-0">
              <Chrome className="w-5 h-5" />
            </div>
            <div>
              <h3 id="extension-modal-title" className="font-newsreader text-xl font-medium tracking-tight">
                Chrome Extension & Web Companion
              </h3>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                1-click save from Reddit, Instagram, GitHub & the web into OmniLink
              </p>
            </div>
          </div>
          <button
            id="btn-close-extension-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Main Download Card */}
          <div className="p-5 rounded-xl bg-[#d97757]/5 dark:bg-[#e08264]/10 border border-[#d97757]/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-[#f7f6f3]">
                  Official Manifest V3 Chrome Extension
                </h4>
                <span className="font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[#d97757]/15 text-[#d97757] dark:text-[#e08264]">
                  V3 Ready
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-md">
                Package pre-configured with active tab reader, right-click context menu, and auto-sync to{' '}
                <code className="px-2 py-0.5 rounded bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 font-mono text-[11px] text-[#d97757] dark:text-[#e08264] font-medium break-all inline-block my-0.5">
                  {currentOrigin}
                </code>
                .
              </p>
            </div>

            <button
              id="btn-download-extension-zip"
              onClick={handleDownloadZip}
              disabled={downloading}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#d97757] hover:bg-[#c46243] text-white text-xs font-semibold rounded-xl shadow-xs transition-all shrink-0 disabled:opacity-50 active:scale-[0.98]"
            >
              <FolderDown className="w-4 h-4" />
              <span>{downloading ? 'Bundling Extension...' : 'Download Extension (.ZIP)'}</span>
            </button>
          </div>

          {/* Step-by-Step Install Guide */}
          <div className="space-y-3 pt-1">
            <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              HOW TO INSTALL IN CHROME, BRAVE, OR EDGE (30 SECONDS)
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.06]">
                <span className="w-6 h-6 rounded-full bg-[#d97757]/10 border border-[#d97757]/30 text-[#d97757] dark:text-[#e08264] flex items-center justify-center font-mono text-xs font-bold shrink-0">
                  1
                </span>
                <div className="text-slate-700 dark:text-slate-300">
                  <strong className="text-slate-900 dark:text-slate-100 font-semibold">Unzip the downloaded archive</strong> into a folder on your computer.
                </div>
              </div>

              <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.06]">
                <span className="w-6 h-6 rounded-full bg-[#d97757]/10 border border-[#d97757]/30 text-[#d97757] dark:text-[#e08264] flex items-center justify-center font-mono text-xs font-bold shrink-0">
                  2
                </span>
                <div className="text-slate-700 dark:text-slate-300">
                  Open Chrome and navigate to <code className="px-2 py-0.5 rounded bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 font-mono text-slate-800 dark:text-slate-200 text-[11px]">chrome://extensions</code>
                </div>
              </div>

              <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.06]">
                <span className="w-6 h-6 rounded-full bg-[#d97757]/10 border border-[#d97757]/30 text-[#d97757] dark:text-[#e08264] flex items-center justify-center font-mono text-xs font-bold shrink-0">
                  3
                </span>
                <div className="text-slate-700 dark:text-slate-300">
                  In the top-right corner, toggle <strong className="text-slate-900 dark:text-slate-100 font-semibold">"Developer mode" ON</strong>.
                </div>
              </div>

              <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.06]">
                <span className="w-6 h-6 rounded-full bg-[#d97757]/10 border border-[#d97757]/30 text-[#d97757] dark:text-[#e08264] flex items-center justify-center font-mono text-xs font-bold shrink-0">
                  4
                </span>
                <div className="text-slate-700 dark:text-slate-300">
                  Click <strong className="text-slate-900 dark:text-slate-100 font-semibold">"Load unpacked"</strong> and select the unzipped folder. You're ready to save links instantly!
                </div>
              </div>
            </div>
          </div>

          {/* Zero-Install Bookmarklet Card */}
          <div className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 flex items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                Alternative: Zero-Install Bookmarklet
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Drag to your browser bookmarks bar or copy code to trigger 1-click saves anywhere.
              </p>
            </div>
            <button
              id="btn-copy-bookmarklet"
              onClick={handleCopyBookmarklet}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 border border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors shrink-0"
            >
              {copiedBookmarklet ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy JavaScript</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

