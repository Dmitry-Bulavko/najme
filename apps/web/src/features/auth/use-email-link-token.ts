'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Reads `?token=` once from the query (with a window.location fallback for the first
 * client paint), then strips it from the address bar via `history.replaceState` so the
 * secret does not linger in history or leak through Referer (ADR-0011).
 * Callers must use the returned value — Next.js `useSearchParams` may clear after scrub.
 */
export function useEmailLinkToken(): string | null {
  const searchParams = useSearchParams();
  const [token] = useState(() => {
    const fromParams = searchParams.get('token');
    if (fromParams) {
      return fromParams;
    }
    if (typeof window !== 'undefined') {
      return new URL(window.location.href).searchParams.get('token');
    }
    return null;
  });

  useEffect(() => {
    if (!token || typeof window === 'undefined') {
      return;
    }
    // Defer scrubbing to the next task so the verify/reset effect can schedule its
    // fetch before Next reacts to the URL change.
    const handle = window.setTimeout(() => {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('token')) {
        return;
      }
      url.searchParams.delete('token');
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(window.history.state, '', next);
    }, 0);
    return () => {
      window.clearTimeout(handle);
    };
  }, [token]);

  return token;
}
