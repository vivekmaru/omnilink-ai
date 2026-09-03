import React, { useEffect, useState } from 'react';
import { ApiService, AUTHENTICATION_REQUIRED_EVENT } from '../services/api';

type AuthState = 'loading' | 'authenticated' | 'anonymous' | 'error';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>('loading');

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
          context?: { workspace?: { id?: unknown } };
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
  }, []);

  if (state === 'authenticated') return <>{children}</>;
  if (state === 'loading') {
    return <main className="min-h-screen bg-[#11100f] text-stone-300 grid place-items-center">Loading OmniLink…</main>;
  }

  return (
    <main className="min-h-screen bg-[#11100f] text-stone-100 grid place-items-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1b1917] p-8 shadow-2xl">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-orange-300">OmniLink AI</p>
        <h1 className="mt-3 text-2xl font-semibold">Your workspace is protected</h1>
        <p className="mt-3 text-sm leading-6 text-stone-400">
          Sign in through the configured identity provider to open your personal repository.
        </p>
        {state === 'error' && <p className="mt-4 text-sm text-red-300">The authentication service is unavailable. Try again shortly.</p>}
        <a
          href="/auth/login"
          className="mt-7 inline-flex w-full items-center justify-center rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-400"
        >
          Sign in
        </a>
      </section>
    </main>
  );
}
