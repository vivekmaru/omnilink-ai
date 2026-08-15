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
  Zap,
  Terminal,
  Layers,
  Send,
  Download,
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
  const [activeTab, setActiveTab] = useState<'pwa' | 'shortcuts' | 'webhook'>('pwa');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [testUrl, setTestUrl] = useState('https://www.instagram.com/reel/C8k9xL2pQ1M/');
  const [testNotes, setTestNotes] = useState('Found this great design breakdown on mobile');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const quickShareUrl = `${currentOrigin}/api/share/quick`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    currentOrigin
  )}&bgcolor=24-23-22&color=240-136-102`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentOrigin);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1500);
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(quickShareUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 1500);
  };

  const curlSnippet = `curl -X POST "${quickShareUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://github.com/astral-sh/uv", "notes": "Saved from mobile terminal"}'`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlSnippet);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 1500);
  };

  const handleTestShare = () => {
    onSimulateShare(testUrl, 'Sample Shared Mobile Reel');
    onClose();
  };

  const handleTestQuickIngress = async () => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      const res = await fetch('/api/share/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: testUrl, notes: testNotes }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestStatus(`✅ Success: ${data.message || 'Bookmark captured & AI indexed!'}`);
      } else {
        setTestStatus(`❌ Error: ${data.error || 'Failed to capture'}`);
      }
    } catch (e: any) {
      setTestStatus(`❌ Network error: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="mobile-share-modal-card"
        className="w-full max-w-2xl bg-white dark:bg-[#1f1e1d] border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden transition-all text-slate-900 dark:text-[#f7f6f3]"
        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#d97757]/10 text-[#d97757] dark:text-[#e08264] border border-[#d97757]/20 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-newsreader font-medium text-lg text-slate-900 dark:text-[#f7f6f3]">
                Mobile Quick Share & Ingress Hub
              </h3>
              <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                Capture links seamlessly from iOS, Android, Apple Shortcuts, and webhooks
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

        {/* Surface Tabs */}
        <div className="flex border-b border-black/10 dark:border-white/10 px-6 bg-black/[0.02] dark:bg-white/[0.01]">
          <button
            onClick={() => setActiveTab('pwa')}
            className={`flex items-center gap-1.5 py-3 px-3 font-mono text-xs font-medium border-b-2 transition-all ${
              activeTab === 'pwa'
                ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264]'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Native Share Sheet (PWA)</span>
          </button>

          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`flex items-center gap-1.5 py-3 px-3 font-mono text-xs font-medium border-b-2 transition-all ${
              activeTab === 'shortcuts'
                ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264]'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Apple Shortcuts (iOS)</span>
          </button>

          <button
            onClick={() => setActiveTab('webhook')}
            className={`flex items-center gap-1.5 py-3 px-3 font-mono text-xs font-medium border-b-2 transition-all ${
              activeTab === 'webhook'
                ? 'border-[#d97757] text-[#d97757] dark:text-[#e08264]'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Webhook & Automations</span>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* TAB 1: PWA Web Share Target */}
          {activeTab === 'pwa' && (
            <div className="space-y-5">
              {/* QR Code Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center p-5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-xl">
                <div className="space-y-2.5 text-center sm:text-left">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#d97757]/15 text-[#d97757] dark:text-[#e08264] border border-[#d97757]/30">
                    Live Mobile Connection
                  </span>
                  <h4 className="font-newsreader font-medium text-lg text-slate-900 dark:text-[#f7f6f3]">
                    Scan with Phone Camera
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Open your camera app to launch OmniLink on iOS or Android directly.
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

              {/* Step-by-Step Native Share Instructions */}
              <div className="space-y-2.5">
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  How to Enable "Share To OmniLink" in Native Share Sheet
                </h4>

                <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  <div className="p-3.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#d97757]/15 text-[#d97757] font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <div>
                      <strong>Add to Home Screen (PWA):</strong> On Safari (iOS) tap <em>Share &rarr; Add to Home Screen</em>. On Chrome (Android) tap <em>Menu &rarr; Install App</em>.
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#d97757]/15 text-[#d97757] font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <div>
                      <strong>Native Share Sheet Integration:</strong> When browsing Reddit, Instagram, X/Twitter, or YouTube on your phone, tap your OS <em>Share</em> button and choose <strong>OmniLink AI</strong>.
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#d97757]/15 text-[#d97757] font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <div>
                      <strong>Background Extraction:</strong> The Web Share Target extracts the URL, runs Gemini Flash categorization, and syncs to your repository instantly.
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Share Target Simulation */}
              <div className="border-t border-black/10 dark:border-white/10 pt-4 space-y-2">
                <div className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Simulate Native Share Target Ingestion:
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
          )}

          {/* TAB 2: Apple Shortcuts Integration */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#d97757] dark:text-[#e08264] uppercase tracking-wider">
                    Apple Shortcuts Webhook URL
                  </span>
                  <button
                    onClick={handleCopyWebhook}
                    className="flex items-center gap-1 text-[11px] font-mono text-slate-600 dark:text-slate-300 hover:text-[#d97757] transition-colors"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWebhook ? 'Copied URL' : 'Copy Endpoint'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-black/5 dark:bg-black/40 rounded-lg font-mono text-xs text-slate-800 dark:text-slate-200 break-all select-all">
                  {quickShareUrl}
                </div>
              </div>

              <div className="space-y-2.5">
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Create a 3-Step Shortcut on iPhone, iPad, or Mac
                </h4>

                <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  <div className="p-3.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10">
                    <strong>1. Receive Input:</strong> Open the Apple <em>Shortcuts</em> app &rarr; New Shortcut &rarr; Set <em>"Receive URLs from Share Sheet"</em>.
                  </div>
                  <div className="p-3.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10">
                    <strong>2. Post to OmniLink:</strong> Add action <em>"Get Contents of URL"</em> &rarr; URL: <code className="text-[#d97757]">{quickShareUrl}</code> &rarr; Method: <strong>POST</strong> &rarr; Request Body: <strong>JSON</strong> &rarr; Key <code>url</code> = <em>Shortcut Input</em>.
                  </div>
                  <div className="p-3.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10">
                    <strong>3. Notification (Optional):</strong> Add action <em>"Show Notification"</em> with text: <em>"Saved to OmniLink & AI Extracted"</em>.
                  </div>
                </div>
              </div>

              {/* Shortcut Test Runner */}
              <div className="p-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.01] space-y-3">
                <div className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Test Apple Shortcut API Payload:
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={testUrl}
                    onChange={(e) => setTestUrl(e.target.value)}
                    placeholder="URL to share..."
                    className="w-full px-3 py-2 text-xs bg-black/5 dark:bg-white/[0.04] border border-black/10 dark:border-white/10 rounded-lg text-slate-900 dark:text-[#f7f6f3] outline-none"
                  />
                  <input
                    type="text"
                    value={testNotes}
                    onChange={(e) => setTestNotes(e.target.value)}
                    placeholder="Optional notes or context..."
                    className="w-full px-3 py-2 text-xs bg-black/5 dark:bg-white/[0.04] border border-black/10 dark:border-white/10 rounded-lg text-slate-900 dark:text-[#f7f6f3] outline-none"
                  />
                  <button
                    onClick={handleTestQuickIngress}
                    disabled={isTesting}
                    className="px-4 py-2 bg-[#d97757] hover:bg-[#c66a4d] text-white font-medium text-xs rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isTesting ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Test Ingress Ingestion</span>
                  </button>
                  {testStatus && (
                    <div className="p-2.5 rounded-lg bg-black/5 dark:bg-black/30 font-mono text-xs text-slate-800 dark:text-slate-200">
                      {testStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Webhook Ingress & Automation */}
          {activeTab === 'webhook' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    cURL & Terminal Command Ingress
                  </h4>
                  <button
                    onClick={handleCopyCurl}
                    className="flex items-center gap-1 text-[11px] font-mono text-slate-600 dark:text-slate-300 hover:text-[#d97757] transition-colors"
                  >
                    {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCurl ? 'Copied cURL' : 'Copy cURL'}</span>
                  </button>
                </div>
                <div className="p-3.5 rounded-xl bg-[#151413] text-zinc-200 font-mono text-xs overflow-x-auto shadow-inner border border-white/10">
                  <pre>{curlSnippet}</pre>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Automation & Bot Integrations
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 space-y-1">
                    <strong className="text-slate-900 dark:text-[#f7f6f3]">Raycast / Alfred:</strong>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                      Create a quick script command passing the frontmost browser URL to <code className="text-[#d97757]">POST /api/share/quick</code>.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 space-y-1">
                    <strong className="text-slate-900 dark:text-[#f7f6f3]">Telegram / Discord:</strong>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                      Point your personal bot webhook handler to forward link messages into OmniLink.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
