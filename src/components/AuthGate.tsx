import React, { createContext, useContext, useEffect, useState } from 'react';
import { ApiService, AUTHENTICATION_REQUIRED_EVENT } from '../services/api';
import type { SessionContext } from '../types';

type AuthState = 'loading' | 'authenticated' | 'anonymous' | 'error';

type ProviderInfo =
  | { provider: 'local' | 'oidc' }
  | { provider: 'password'; signupOpen: boolean; needsSetup: boolean };

const SessionContextValue = createContext<SessionContext | null>(null);

/** The signed-in caller's identity, available to everything rendered inside AuthGate. */
export function useSession(): SessionContext | null {
  return useContext(SessionContextValue);
}

/** Service tokens can only be managed from an interactive owner session (see server/auth/http.ts). */
export function canManageServiceTokens(session: SessionContext | null): boolean {
  return session?.authMethod === 'session' && session.workspace.role === 'owner';
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>('loading');
  const [session, setSession] = useState<SessionContext | null>(null);
  // undefined while the provider lookup is in flight; null if it failed.
  const [provider, setProvider] = useState<ProviderInfo | null | undefined>(undefined);
  // Bumped after a password sign-in so the session is re-read.
  const [sessionVersion, setSessionVersion] = useState(0);

  useEffect(() => {
    let active = true;

    const clearAuthentication = () => {
      ApiService.clearWorkspaceNamespace();
      if (active) setState('anonymous');
    };

    const loadSession = async () => {
      try {
        const response = await fetch('/auth/session', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        if (!active) return;
        if (response.status === 401) {
          clearAuthentication();
          return;
        }
        if (!response.ok) {
          ApiService.clearWorkspaceNamespace();
          setState('error');
          return;
        }

        const payload = await response.json() as {
          authenticated?: boolean;
          context?: SessionContext;
        };
        const workspaceId = payload.context?.workspace?.id;
        if (!payload.authenticated || typeof workspaceId !== 'string' || workspaceId.trim().length === 0) {
          ApiService.clearWorkspaceNamespace();
          setState('error');
          return;
        }

        // This call must complete before authenticated children render. It
        // migrates only the local workspace cache and isolates all other
        // workspace data under a distinct browser-storage namespace.
        ApiService.setWorkspaceNamespace(workspaceId);
        setSession(payload.context!);
        setState('authenticated');
      } catch {
        if (!active) return;
        ApiService.clearWorkspaceNamespace();
        setState('error');
      }
    };

    const handleAuthenticationRequired = () => clearAuthentication();
    window.addEventListener(AUTHENTICATION_REQUIRED_EVENT, handleAuthenticationRequired);
    void loadSession();

    return () => {
      active = false;
      window.removeEventListener(AUTHENTICATION_REQUIRED_EVENT, handleAuthenticationRequired);
    };
  }, [sessionVersion]);

  useEffect(() => {
    if (state !== 'anonymous' && state !== 'error') return;
    let active = true;
    fetch('/auth/providers', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() as Promise<ProviderInfo> : null))
      .then((info) => { if (active) setProvider(info); })
      .catch(() => { if (active) setProvider(null); });
    return () => { active = false; };
  }, [state]);

  if (state === 'authenticated') {
    return <SessionContextValue.Provider value={session}>{children}</SessionContextValue.Provider>;
  }
  if (state === 'loading' || provider === undefined) {
    return <main className="min-h-screen grid place-items-center bg-[var(--bg)] text-[var(--ink-muted)]">Loading OmniLink…</main>;
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-[var(--bg)] text-[var(--ink)]">
      <section className="w-full max-w-md rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8 shadow-xl">
        <p className="text-sm font-semibold text-[var(--accent)]">OmniLink AI</p>
        {provider?.provider === 'password' ? (
          <PasswordForm
            signupOpen={provider.signupOpen}
            needsSetup={provider.needsSetup}
            unavailable={state === 'error'}
            onAuthenticated={() => { setState('loading'); setSessionVersion((version) => version + 1); }}
          />
        ) : (
          <>
            <h1 className="mt-2 text-2xl font-semibold">Your workspace is protected</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-muted)]">
              Sign in through the configured identity provider to open your personal repository.
            </p>
            {state === 'error' && <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">The authentication service is unavailable. Try again shortly.</p>}
            <a
              href="/auth/login"
              className="mt-7 inline-flex w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-[var(--accent-hover)]"
            >
              Sign in
            </a>
          </>
        )}
      </section>
    </main>
  );
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)] focus:outline-none';

function PasswordForm({ signupOpen, needsSetup, unavailable, onAuthenticated }: {
  signupOpen: boolean;
  needsSetup: boolean;
  unavailable: boolean;
  onAuthenticated: () => void;
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>(needsSetup && signupOpen ? 'signup' : 'signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isSignup = mode === 'signup';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(isSignup ? '/auth/password/signup' : '/auth/password/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(isSignup ? { name, email, password } : { email, password }),
      });
      if (response.ok) {
        onAuthenticated();
        return;
      }
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      setError(payload?.error || 'Sign-in failed. Try again.');
    } catch {
      setError('The server could not be reached. Try again shortly.');
    } finally {
      setSubmitting(false);
    }
  };

  const heading = isSignup ? (needsSetup ? 'Create the owner account' : 'Create your account') : 'Sign in';
  const intro = isSignup
    ? (needsSetup ? 'This server has no accounts yet. The first account owns this install.' : 'Your links are kept in a private workspace.')
    : 'Sign in with your email and password to open your repository.';

  return (
    <form onSubmit={submit} className="mt-2">
      <h1 className="text-2xl font-semibold">{heading}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-muted)]">{intro}</p>
      {unavailable && <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">The authentication service is unavailable. Try again shortly.</p>}
      <div className="mt-6 space-y-4">
        {isSignup && (
          <label className="block text-sm text-[var(--ink)]">
            Name <span className="text-[var(--ink-faint)]">(optional)</span>
            <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={120} />
          </label>
        )}
        <label className="block text-sm text-[var(--ink)]">
          Email
          <input className={inputClass} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" autoFocus />
        </label>
        <label className="block text-sm text-[var(--ink)]">
          Password
          <input
            className={inputClass}
            type="password"
            required
            minLength={isSignup ? 10 : undefined}
            maxLength={256}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />
          {isSignup && <span className="mt-1.5 block text-xs text-[var(--ink-faint)]">At least 10 characters.</span>}
        </label>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-7 inline-flex w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60"
      >
        {submitting ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
      </button>
      {signupOpen && !needsSetup && (
        <p className="mt-5 text-center text-sm text-[var(--ink-muted)]">
          {isSignup ? 'Already have an account?' : 'New here?'}{' '}
          <button type="button" className="font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]" onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError(null); }}>
            {isSignup ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      )}
    </form>
  );
}
