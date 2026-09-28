import { healthResponseSchema } from '@najme/contracts';

const FETCH_TIMEOUT_MS = 2000;

/**
 * Checks API health for the status badge. Resolves the base URL the same way production traffic
 * would reach the API (ADR-0007): the internal Docker network URL first (`API_INTERNAL_URL`, set by
 * `infra/compose.prod.yml`), then the public origin (`PUBLIC_URL` + `/api/v1`) so the badge still
 * works when only the public URL is configured. Returns `false` (never throws) on any error,
 * timeout, non-2xx response or unexpected body — the page must render regardless of API state.
 */
export async function isApiHealthy(): Promise<boolean> {
  const baseUrl = resolveHealthBaseUrl();
  if (!baseUrl) {
    return false;
  }

  try {
    const response = await fetch(`${baseUrl}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return false;
    }
    const body: unknown = await response.json();
    return healthResponseSchema.safeParse(body).success;
  } catch {
    return false;
  }
}

function resolveHealthBaseUrl(): string | undefined {
  const internalUrl = process.env.API_INTERNAL_URL;
  if (internalUrl) {
    return internalUrl;
  }
  const publicUrl = process.env.PUBLIC_URL;
  if (publicUrl) {
    return `${publicUrl}/api/v1`;
  }
  return undefined;
}
