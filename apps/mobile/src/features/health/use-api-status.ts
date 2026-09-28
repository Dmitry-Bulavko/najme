import { healthResponseSchema } from '@najme/contracts';
import { useEffect, useState } from 'react';

const FETCH_TIMEOUT_MS = 2000;

export type ApiStatus = 'checking' | 'online' | 'unavailable';

/**
 * Checks `${EXPO_PUBLIC_API_URL}/health` once on mount. Never throws into the UI: a missing env
 * var, network error, timeout, non-2xx response or unexpected body all resolve to `'unavailable'`
 * (mirrors `apps/web`'s `src/lib/health.ts`, adapted for a client-side hook since the mobile app has
 * no server runtime to fetch from before render).
 */
export function useApiStatus(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    const baseUrl = process.env.EXPO_PUBLIC_API_URL;

    if (!baseUrl) {
      // Deferred (not called synchronously in the effect body) so this follows the same
      // "external state changes via a callback" shape as the fetch branch below.
      Promise.resolve().then(() => {
        if (!cancelled) {
          setStatus('unavailable');
        }
      });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    fetch(`${baseUrl}/health`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          return false;
        }
        const body: unknown = await response.json();
        return healthResponseSchema.safeParse(body).success;
      })
      .then((healthy) => {
        if (!cancelled) {
          setStatus(healthy ? 'online' : 'unavailable');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('unavailable');
        }
      })
      .finally(() => {
        clearTimeout(timeout);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  return status;
}
