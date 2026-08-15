import React, { useState } from 'react';
import {
  X,
  Share2,
  Smartphone,
  QrCode,
  Check,
  Copy,
  ArrowRight,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

interface MobileShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateShare: (url: string, title: string) => void;
}

export const MobileShareModal: React.FC<MobileShareModalProps> = ({
  isOpen,
  onClose,
  onSimulateShare,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [testUrl, setTestUrl] = useState('https://www.instagram.com/reel/C8k9xL2pQ1M/');

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    currentUrl
  )}&bgcolor=18-24-38&color=255-255-255`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1500);
  };

  const handleTestShare = () => {
    onSimulateShare(testUrl, 'Sample Shared Mobile Reel');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="mobile-share-modal-card"
        className="w-full max-w-2xl bg-white dark:bg-[#1f1e1d] border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden transition-all text-slate-900 dark:text-[#f7f6f3]"
        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] border border-[#d97757]/20 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-newsreader font-medium text-lg text-slate-900 dark:text-[#f7f6f3]">
                Cross-Platform Mobile Quick Share
              </h3>
              <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                Share directly from Instagram, Reddit, YouTube, or X apps on your phone
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

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* QR Code & Mobile Connection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center p-5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-xl">
            <div className="text-center sm:text-left space-y-2.5">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#d97757]/15 text-[#d97757] dark:text-[#e08264] border border-[#d97757]/30">
                Scan with Phone Camera
              </span>
              <h4 className="font-newsreader font-medium text-lg text-slate-900 dark:text-[#f7f6f3]">
                Open OmniLink on Mobile
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Scan this QR code to access your repository instantly on iOS or Android.
              </p>
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center sm:justify-start gap-1.5 font-mono text-xs text-[#d97757] dark:text-[#e08264] hover:underline font-medium pt-1"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'App URL Copied' : 'Copy App URL'}</span>
              </button>
            </div>

            <div className="flex justify-center">
              <div className="p-2.5 bg-white dark:bg-[#272522] rounded-xl shadow-2xs border border-black/10 dark:border-white/10">
                <img
                  src={qrCodeUrl}
                  alt="QR Code"
                  className="w-32 h-32 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* How Mobile Web Share Target Works */}
          <div className="space-y-2.5">
            <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              How to enable Native "Share To OmniLink" on Mobile
            </h4>

            <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <div className="p-3.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10">
                <strong>Step 1 (Add to Home Screen):</strong> On Safari (iOS) tap <em>Share &rarr; Add to Home Screen</em>. On Chrome (Android) tap <em>Menu &rarr; Install App</em>.
              </div>
              <div className="p-3.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10">
                <strong>Step 2 (Native Share Sheet):</strong> When browsing Reddit, Instagram Reels, or GitHub on your phone, tap your OS <em>Share</em> button and choose <strong>OmniLink AI</strong> from your apps!
              </div>
              <div className="p-3.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10">
                <strong>Step 3 (Automatic AI Extraction):</strong> OmniLink automatically opens the quick-save dialog, runs Gemini Flash extraction, and syncs across all devices.
              </div>
            </div>
          </div>

          {/* Simulate Share Target Test */}
          <div className="border-t border-black/10 dark:border-white/10 pt-4 space-y-2">
            <div className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
              Test Mobile Share Target Ingestion:
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-black/5 dark:bg-white/[0.04] border border-black/10 dark:border-white/10 rounded-lg text-slate-900 dark:text-[#f7f6f3] outline-none focus:border-[#d97757]"
              />
              <button
                onClick={handleTestShare}
                className="px-4 py-2 bg-[#d97757] hover:bg-[#c66a4d] text-white font-medium text-xs rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <span>Simulate</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
