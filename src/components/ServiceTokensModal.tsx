import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, X } from 'lucide-react';
import { ApiService } from '../services/api';
import { SERVICE_TOKEN_SCOPES, type ServiceToken, type ServiceTokenScope } from '../types';

interface ServiceTokensModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 'page' renders inline in the Settings page instead of as a pop-up. */
  variant?: 'modal' | 'page';
}

const SCOPE_DESCRIPTIONS: Record<ServiceTokenScope, string> = {
  'repository:read': 'Read and search links',
  'repository:write': 'Save and edit links',
  'repository:delete': 'Delete links',
  'ai:execute': 'Run AI tagging and Ask',
  'repository:admin': 'Admin tasks such as reindexing',
};

const EXPIRY_OPTIONS = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
] as const;

type TokenStatus = 'active' | 'expired' | 'revoked';

export function tokenStatus(token: ServiceToken, now = Date.now()): TokenStatus {
  if (token.revokedAt) return 'revoked';
  if (token.expiresAt && Date.parse(token.expiresAt) <= now) return 'expired';
  return 'active';
}

function formatDate(value?: string): string {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

const inputClass =
  'w-full rounded-md border px-3 py-2 text-sm bg-[var(--input-bg)] border-black/10 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#d97757]/60';
const ghostButtonClass =
  'rounded-md border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50';
const primaryButtonClass =
  'rounded-md bg-[#d97757] hover:bg-[#c46243] px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50';

export const ServiceTokensModal: React.FC<ServiceTokensModalProps> = ({ isOpen, onClose, variant = 'modal' }) => {
  const [tokens, setTokens] = useState<ServiceToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ServiceTokenScope[]>(['repository:read']);
  const [expiryDays, setExpiryDays] = useState<number>(90);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // The plaintext token lives only in memory and only until the user dismisses it.
  const [newToken, setNewToken] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setTokens(await ApiService.listServiceTokens());
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load service tokens.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) void loadTokens();
  }, [isOpen, loadTokens]);

  if (!isOpen) return null;
  const isPage = variant === 'page';

  const toggleScope = (scope: ServiceTokenScope) => {
    setScopes((current) => (current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope]));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || scopes.length === 0) return;
    setCreating(true);
    setCreateError(null);
    try {
      const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
      const created = await ApiService.createServiceToken({ name: trimmed, scopes, expiresAt });
      setNewToken({ name: trimmed, token: created.token });
      setCopied(false);
      setName('');
      setScopes(['repository:read']);
      await loadTokens();
    } catch (err) {
      setCreateError(errorMessage(err, 'Could not create the token.'));
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken.token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    setRevokeError(null);
    try {
      await ApiService.revokeServiceToken(id);
      setConfirmRevokeId(null);
      await loadTokens();
    } catch (err) {
      setRevokeError(errorMessage(err, 'Could not revoke the token.'));
    } finally {
      setRevokingId(null);
    }
  };

  const handleClose = () => {
    setNewToken(null);
    onClose();
  };

  return (
    <div
      id="service-tokens-modal-backdrop"
      className={isPage ? 'h-full' : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'}
      onClick={isPage ? undefined : handleClose}
    >
      <div
        role={isPage ? 'region' : 'dialog'}
        aria-modal={isPage ? undefined : true}
        aria-labelledby="service-tokens-modal-title"
        className={isPage ? 'h-full flex flex-col overflow-hidden text-slate-900 dark:text-[#f7f6f3]' : 'w-full max-w-2xl rounded-xl border shadow-2xl overflow-hidden flex flex-col text-slate-900 dark:text-[#f9fafb]'}
        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-black/10 dark:border-white/10">
          <div className="flex items-start gap-3">
            <KeyRound className="w-5 h-5 mt-1 text-[#d97757] dark:text-[#e08264] shrink-0" />
            <div>
              <h3 id="service-tokens-modal-title" className="text-lg font-semibold tracking-tight text-slate-900 dark:text-[#f7f6f3]">
                Service tokens
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Tokens let the browser extension, mobile shortcuts and MCP clients reach this workspace.
              </p>
            </div>
          </div>
          {!isPage && (
            <button
              onClick={handleClose}
              aria-label="Close"
              className="flex items-center gap-1.5 p-1.5 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <span className="font-mono text-xs text-slate-400">ESC</span>
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className={`p-6 space-y-8 overflow-y-auto ${isPage ? 'flex-1' : 'max-h-[75vh]'}`}>
          {newToken ? (
            <section aria-live="polite" className="rounded-md border border-[#d97757]/30 bg-[#d97757]/5 p-4 space-y-3">
              <div>
                <h4 className="text-sm font-semibold">Copy “{newToken.name}” now</h4>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  This is the only time the full token is shown. Store it somewhere safe.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 break-all rounded-md border border-black/10 dark:border-white/10 bg-[var(--input-bg)] px-3 py-2 font-mono text-xs">
                  {newToken.token}
                </code>
                <button onClick={handleCopy} className={ghostButtonClass}>
                  <span className="flex items-center gap-1.5">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </span>
                </button>
              </div>
              <button onClick={() => setNewToken(null)} className={primaryButtonClass}>
                Done
              </button>
            </section>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                New token
              </h4>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Chrome extension on laptop"
                    maxLength={100}
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Expires in</span>
                  <select
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Number(e.target.value))}
                    className={inputClass}
                  >
                    {EXPIRY_OPTIONS.map((option) => (
                      <option key={option.days} value={option.days}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium mb-1.5">Access</legend>
                {SERVICE_TOKEN_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-center gap-3 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="accent-[#d97757]"
                    />
                    <span className="text-slate-800 dark:text-slate-200">{SCOPE_DESCRIPTIONS[scope]}</span>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{scope}</span>
                  </label>
                ))}
              </fieldset>

              {createError && <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>}

              <button
                type="submit"
                disabled={creating || !name.trim() || scopes.length === 0}
                className={primaryButtonClass}
              >
                {creating ? 'Creating…' : 'Create token'}
              </button>
            </form>
          )}

          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Your tokens
            </h4>

            {loading && tokens.length === 0 && <p className="text-sm text-slate-500">Loading…</p>}
            {loadError && (
              <div className="flex items-center gap-3">
                <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
                <button onClick={() => void loadTokens()} className={ghostButtonClass}>Retry</button>
              </div>
            )}
            {!loading && !loadError && tokens.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">No tokens yet.</p>
            )}
            {revokeError && <p className="text-sm text-red-600 dark:text-red-400">{revokeError}</p>}

            {tokens.length > 0 && (
            <ul className="divide-y divide-black/5 dark:divide-white/[0.06] rounded-md border border-black/10 dark:border-white/10">
              {tokens.map((token) => {
                const status = tokenStatus(token);
                const inactive = status !== 'active';
                return (
                  <li key={token.id} className={`p-4 space-y-2 ${inactive ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate">{token.name}</span>
                          {inactive && (
                            <span className="rounded-sm border border-black/10 dark:border-white/10 px-1.5 py-0.5 text-xs text-slate-500">
                              {status}
                            </span>
                          )}
                        </div>
                        <code className="font-mono text-xs text-slate-500 dark:text-slate-400">{token.tokenPrefix}…</code>
                      </div>
                      {status !== 'revoked' && (
                        confirmRevokeId === token.id ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => void handleRevoke(token.id)}
                              disabled={revokingId === token.id}
                              className="rounded-md bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                            >
                              {revokingId === token.id ? 'Revoking…' : 'Revoke'}
                            </button>
                            <button onClick={() => setConfirmRevokeId(null)} className={ghostButtonClass}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmRevokeId(token.id)} className={`${ghostButtonClass} shrink-0`}>
                            Revoke
                          </button>
                        )
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {token.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="rounded-sm bg-black/5 dark:bg-white/5 px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-300"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Created {formatDate(token.createdAt)}
                      {' · '}
                      {status === 'revoked'
                        ? `Revoked ${formatDate(token.revokedAt)}`
                        : `${status === 'expired' ? 'Expired' : 'Expires'} ${formatDate(token.expiresAt)}`}
                      {' · '}
                      Last used {token.lastUsedAt ? formatDate(token.lastUsedAt) : 'never'}
                    </p>
                  </li>
                );
              })}
            </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
