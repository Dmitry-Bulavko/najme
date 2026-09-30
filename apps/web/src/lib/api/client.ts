/**
 * Typed fetch client for the Najme API (ADR-0003, ADR-0010).
 *
 * - Base path: `/api/v1` (same-origin; dev rewrite in next.config.ts, Caddy in prod).
 * - Attaches `Authorization: Bearer <accessToken>` from the in-memory store.
 * - On 401 for a bearer-authenticated, non-`/auth/` request: single-flight POST /auth/refresh
 *   then retries the original request once.
 * - Cross-tab refresh is serialized via `navigator.locks` when available.
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

/** Called when refresh fails with REFRESH_TOKEN_REUSED (all sessions revoked). */
let refreshTokenReusedHandler: (() => void) | null = null;

/** Registers a handler for refresh-token reuse; pass `null` to clear. */
export function setRefreshTokenReusedHandler(handler: (() => void) | null): void {
  refreshTokenReusedHandler = handler;
}

/**
 * Serializes auth refresh across tabs via Web Locks when available; falls back to running
 * `fn` directly (in-tab single-flight still applies via `refreshingPromise`).
 */
export async function withAuthRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { locks?: LockManager }).locks
      : undefined;
  if (locks?.request) {
    return locks.request('najme-auth-refresh', () => fn());
  }
  return fn();
}

/** Definitive refresh rejections that mean the current access token is unusable. */
function shouldClearAccessTokenOnRefreshFailure(status: number): boolean {
  return status === 400 || status === 401 || status === 403;
}

/** Executes POST /auth/refresh, returning the new access token or null on failure. */
async function doRefresh(): Promise<string | null> {
  try {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      if (shouldClearAccessTokenOnRefreshFailure(res.status)) {
        accessToken = null;
      }
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        return null;
      }
      const parsed = apiErrorResponseSchema.safeParse(errorBody);
      if (parsed.success && parsed.data.error.code === 'REFRESH_TOKEN_REUSED') {
        refreshTokenReusedHandler?.();
        throw new ApiError(
          'REFRESH_TOKEN_REUSED',
          parsed.data.error.message,
          res.status,
          parsed.data.error.details,
        );
      }
      return null;
    }
    const data = (await res.json()) as AuthSession;
    accessToken = data.accessToken;
    return data.accessToken;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Network / unexpected failure: leave the current access token alone.
    return null;
  }
}

/**
 * Single-flight refresh: concurrent 401 responses all await the same in-flight refresh rather
 * than firing multiple POST /auth/refresh requests (ADR-0010). Cross-tab callers are serialized
 * with `withAuthRefreshLock`.
 */
export async function refreshSession(): Promise<string | null> {
  if (refreshingPromise) {
    return refreshingPromise;
  }
  refreshingPromise = withAuthRefreshLock(doRefresh).finally(() => {
    refreshingPromise = null;
  });
  return refreshingPromise;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/**
 * Makes a JSON request to `/api/v1/<path>`. On 401 for a bearer-authenticated non-auth path it
 * attempts a token refresh then retries once. Public `/auth/*` calls never refresh (a wrong
 * password must not trigger cookie refresh / reuse handling mid sign-in).
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

  const requestToken = accessToken;
  let response = await doFetch(requestToken);

  const mayRefresh = Boolean(requestToken) && !path.startsWith('/auth/');
  if (response.status === 401 && mayRefresh) {
    const newToken = await refreshSession();
    // If refresh succeeded, retry once; otherwise fall through to throw ApiError.
    if (newToken) {
      response = await doFetch(newToken);
    }
  }

  if (response.ok) {
    // 204/205 and empty 202 (forgot-password, verify resend) have no JSON body.
    if (response.status === 204 || response.status === 205) {
      return undefined as T;
    }
    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
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
