import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  Unlock,
  Download,
  Upload,
  FileJson,
  FileText,
  AlertCircle,
  CheckCircle2,
  Key,
} from 'lucide-react';
import { decryptBackup, encryptBackup } from '../services/crypto';
import { LinkItem } from '../types';
import { ApiService } from '../services/api';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  links: LinkItem[];
  onLinksRestored: (restoredLinks: LinkItem[]) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  links,
  onLinksRestored,
}) => {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [encrypting, setEncrypting] = useState(false);
  const [decryptPassphrase, setDecryptPassphrase] = useState('');
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle AES-GCM Encrypted Export
  const handleExportEncrypted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase || passphrase.length < 6) {
      setError('Passphrase must be at least 6 characters long.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match.');
      return;
    }

    setEncrypting(true);
    setError(null);
    try {
      const encryptedData = await encryptBackup(links, passphrase);
      const jsonStr = JSON.stringify(encryptedData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omnilink-encrypted-vault-${new Date().toISOString().slice(0, 10)}.enc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(`Successfully exported ${links.length} links with AES-256-GCM encryption!`);
      setPassphrase('');
      setConfirmPassphrase('');
    } catch (err: any) {
      setError(err.message || 'Encryption failed');
    } finally {
      setEncrypting(false);
    }
  };

  // Handle Restore from Encrypted or Plain JSON File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // Check if it's an encrypted backup
        if (parsed.ciphertext && parsed.iv && parsed.salt) {
          if (!decryptPassphrase) {
            setError('Please enter your decrypt passphrase above, then upload the file.');
            return;
          }
          setDecrypting(true);
          const decryptedLinks = await decryptBackup(parsed, decryptPassphrase);
          await ApiService.importLinks(decryptedLinks, 'merge');
          onLinksRestored(decryptedLinks);
          setSuccess(`Decrypted and restored ${decryptedLinks.length} links into your repository!`);
        } else if (Array.isArray(parsed) || Array.isArray(parsed.links)) {
          // Plain JSON
          const linksToImport = Array.isArray(parsed) ? parsed : parsed.links;
          await ApiService.importLinks(linksToImport, 'merge');
          onLinksRestored(linksToImport);
          setSuccess(`Imported ${linksToImport.length} links successfully!`);
        } else {
          throw new Error('Unrecognized backup format.');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to parse or decrypt backup file.');
      } finally {
        setDecrypting(false);
      }
    };
    reader.readAsText(file);
  };

  // Export Plain JSON
  const handleExportPlainJson = () => {
    const jsonStr = JSON.stringify(links, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omnilink-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export Markdown Digest
  const handleExportMarkdown = () => {
    let md = `# OmniLink AI - Knowledge Repository Digest\nExported: ${new Date().toLocaleString()}\nTotal Bookmarks: ${links.length}\n\n---\n\n`;

    for (const link of links) {
      md += `### [${link.title}](${link.url})\n`;
      md += `- **Platform:** ${link.platform}\n`;
      md += `- **Category:** ${link.category}\n`;
      md += `- **Tags:** ${link.tags.map((t) => `#${t}`).join(' ')}\n`;
      md += `- **Status:** ${link.readStatus}\n\n`;

      if (link.summary?.tldr) {
        md += `> **TL;DR:** ${link.summary.tldr}\n\n`;
      }
      if (link.summary?.keyTakeaways?.length) {
        md += `**Takeaways:**\n`;
        link.summary.keyTakeaways.forEach((k) => (md += `- ${k}\n`));
        md += '\n';
      }
      if (link.notes) {
        md += `**Notes:** ${link.notes}\n\n`;
      }
      md += `---\n\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omnilink-knowledge-digest-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="backup-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="backup-modal-card"
        className="w-full max-w-2xl max-h-[90vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-[#f7f6f3] transition-all"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-newsreader text-xl font-medium tracking-tight">
                AES-256 Vault Encryption & Backup
              </h3>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Zero-knowledge encrypted exports, offline portability, and Markdown digests
              </p>
            </div>
          </div>
          <button
            id="btn-close-backup-modal"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 font-mono text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 font-mono text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Encrypted Export Form */}
          <div className="p-5 rounded-xl bg-[#d97757]/5 dark:bg-[#e08264]/10 border border-[#d97757]/20 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#d97757] dark:text-[#e08264]" />
              <h4 className="font-semibold text-sm text-slate-900 dark:text-[#f7f6f3]">
                Create Encrypted AES-256 Backup (.enc)
              </h4>
            </div>
            <p className="font-mono text-xs text-slate-600 dark:text-slate-400">
              Derives keys using PBKDF2 with 100,000 SHA-256 iterations and encrypts repository data using AES-GCM.
            </p>

            <form onSubmit={handleExportEncrypted} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="password"
                  required
                  placeholder="Master Passphrase (min 6 chars)"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="px-4 py-2 text-xs bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#d97757] dark:focus:border-[#e08264]"
                />
                <input
                  type="password"
                  required
                  placeholder="Confirm Master Passphrase"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  className="px-4 py-2 text-xs bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#d97757] dark:focus:border-[#e08264]"
                />
              </div>

              <button
                type="submit"
                disabled={encrypting}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#d97757] hover:bg-[#c46243] text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 active:scale-[0.99]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{encrypting ? 'Encrypting Vault...' : `Export Encrypted Vault (${links.length} Links)`}</span>
              </button>
            </form>
          </div>

          {/* Decrypt & Restore Vault */}
          <div className="p-5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 space-y-4">
            <div className="flex items-center gap-2">
              <Unlock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="font-semibold text-sm text-slate-900 dark:text-[#f7f6f3]">
                Restore from Encrypted / Plain Backup
              </h4>
            </div>

            <div className="space-y-3">
              <input
                type="password"
                placeholder="Passphrase (Required if uploading .enc file)"
                value={decryptPassphrase}
                onChange={(e) => setDecryptPassphrase(e.target.value)}
                className="w-full px-4 py-2 text-xs bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#d97757] dark:focus:border-[#e08264]"
              />

              <label className="flex items-center justify-center gap-2 w-full py-2.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 rounded-xl font-mono text-xs font-semibold cursor-pointer transition-colors border border-black/10 dark:border-white/10">
                <Upload className="w-3.5 h-3.5" />
                <span>Select .enc or .json Backup File</span>
                <input
                  type="file"
                  accept=".json,.enc"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Unencrypted & Portable Digests */}
          <div className="space-y-3">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Portable Plain Text Digests
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleExportPlainJson}
                className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 hover:border-[#d97757] dark:hover:border-[#e08264] text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 transition-all shadow-2xs"
              >
                <FileJson className="w-4 h-4 text-[#d97757] dark:text-[#e08264]" />
                <span>Export Standard JSON</span>
              </button>
              <button
                onClick={handleExportMarkdown}
                className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-white dark:bg-[#1f1e1c] border border-black/10 dark:border-white/10 hover:border-[#d97757] dark:hover:border-[#e08264] text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 transition-all shadow-2xs"
              >
                <FileText className="w-4 h-4 text-amber-500" />
                <span>Export Markdown Notes</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
