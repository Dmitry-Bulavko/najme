'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Reads `?token=` once, then strips it from the address bar via `history.replaceState`
 * so the secret does not linger in history or leak through Referer (ADR-0011).
 * Scrub runs synchronously in the effect (no cancellable timer). Callers must use the
 * returned value — Next.js `useSearchParams` may clear after scrub.
 */
export function useEmailLinkToken(): string | null {
  const searchParams = useSearchParams();
  const [token] = useState(() => searchParams.get('token'));

  useEffect(() => {
    if (!token || typeof window === 'undefined') {
      return;
    }
    const url = new URL(window.location.href);
    if (!url.searchParams.has('token')) {
      return;
    }
    url.searchParams.delete('token');
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, '', next);
  }, [token]);

  return token;
}
