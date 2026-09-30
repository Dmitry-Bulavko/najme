/**
 * Typed fetch client for the Najme API (ADR-0003, ADR-0010).
 *
 * - Base path: `/api/v1` (same-origin; dev rewrite in next.config.ts, Caddy in prod).
 * - Attaches `Authorization: Bearer <accessToken>` from the in-memory store.
 * - On 401: performs a single-flight POST /auth/refresh then retries the original request once.
 * - Throws ApiError on any non-2xx response.
 */
import { apiErrorResponseSchema, type AuthSession } from '@najme/contracts';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: string, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** In-memory access token (never persisted to storage — ADR-0010). */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Pending refresh promise for single-flight deduplication (ADR-0010). */
let refreshingPromise: Promise<string | null> | null = null;

/** Executes POST /auth/refresh, returning the new access token or null on failure. */
async function doRefresh(): Promise<string | null> {
  try {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      accessToken = null;
      return null;
    }
    const data = (await res.json()) as AuthSession;
    accessToken = data.accessToken;
    return data.accessToken;
  } catch {
    accessToken = null;
    return null;
  }
}

/**
 * Single-flight refresh: concurrent 401 responses all await the same in-flight refresh rather
 * than firing multiple POST /auth/refresh requests (ADR-0010).
 */
export async function refreshSession(): Promise<string | null> {
  if (refreshingPromise) {
    return refreshingPromise;
  }
  refreshingPromise = doRefresh().finally(() => {
    refreshingPromise = null;
  });
  return refreshingPromise;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/**
 * Makes a JSON request to `/api/v1/<path>`. On 401 it attempts a token refresh then retries once.
 */
export async function apiRequest<T>(
  path: string,
  { body, headers: extraHeaders, ...rest }: RequestOptions = {},
): Promise<T> {
  const doFetch = async (token: string | null) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(extraHeaders as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return fetch(`/api/v1${path}`, {
      ...rest,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response = await doFetch(accessToken);

  if (response.status === 401) {
    const newToken = await refreshSession();
    // If refresh succeeded, retry once; otherwise fall through to throw ApiError.
    if (newToken) {
      response = await doFetch(newToken);
    }
  }

  if (response.ok) {
    // 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }
    return response.json() as Promise<T>;
  }

  let errorBody: unknown;
  try {
    errorBody = await response.json();
  } catch {
    throw new ApiError('HTTP_ERROR', response.statusText, response.status);
  }

  const parsed = apiErrorResponseSchema.safeParse(errorBody);
  if (parsed.success) {
    throw new ApiError(
      parsed.data.error.code,
      parsed.data.error.message,
      response.status,
      parsed.data.error.details,
    );
  }

  throw new ApiError('HTTP_ERROR', `HTTP ${response.status}`, response.status);
}
