/**
 * Typed fetch client for the Najme mobile API (ADR-0003, ADR-0010).
 *
 * - Base URL: `EXPO_PUBLIC_API_URL` (includes `/api/v1`).
 * - Always sends `X-Client: mobile` so refresh tokens travel in the JSON body.
 * - Access token stays in memory; refresh token in SecureStore (see `token-storage.ts`).
 * - On 401: single-flight refresh then one retry. Definitive refresh rejection clears the store;
 *   transient failures (network, 5xx, 429) keep the refresh token (#144).
 * - `withAuthMutex` serializes refresh with sign-out and other session mutations (#56).
 */
import { apiErrorResponseSchema, authSessionSchema, type AuthSession } from '@najme/contracts';

import { clearRefreshToken, getRefreshToken, setRefreshToken } from './token-storage';

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

/**
 * Refresh could not complete, but the stored refresh token is still believed valid (offline,
 * timeout, 5xx, 429). Callers must not wipe SecureStore.
 */
export class TransientAuthError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TransientAuthError';
  }
}

/** In-memory access token (never persisted — ADR-0010). */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Clears access + refresh tokens (local only). */
export async function clearSessionTokens(): Promise<void> {
  accessToken = null;
  await clearRefreshToken();
}

/**
 * Persists a successful auth session: access token in memory, refresh token in SecureStore.
 * Mobile responses always include `refreshToken` when `X-Client: mobile` was sent.
 */
export async function persistAuthSession(session: AuthSession): Promise<void> {
  if (!session.refreshToken) {
    throw new ApiError('UNAUTHENTICATED', 'Mobile auth session is missing a refresh token.', 401);
  }
  accessToken = session.accessToken;
  await setRefreshToken(session.refreshToken);
}

/** Tail of the auth mutex chain; other flows (#56) await this via `withAuthMutex`. */
let mutexTail: Promise<unknown> = Promise.resolve();

/** In-flight refresh shared by concurrent 401 retries (single-flight). */
let inflightRefresh: Promise<string | null> | null = null;

/**
 * Serializes session-mutating work with refresh. Password change (#56) and sign-out (#144) must
 * hold this lock so a concurrent refresh cannot race token rotation or resurrect a cleared session.
 */
export function withAuthMutex<T>(operation: () => Promise<T>): Promise<T> {
  const next = mutexTail.then(operation, operation);
  mutexTail = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** Returns the API base URL, throwing if the env var is unset. */
export function apiBaseUrl(): string {
  const base = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!base) {
    throw new ApiError('HTTP_ERROR', 'EXPO_PUBLIC_API_URL is not set', 0);
  }
  return base.replace(/\/$/, '');
}

/**
 * Parses an API error envelope and returns a typed `ApiError`. Falls back to a generic
 * `HTTP_ERROR` when the body does not match the error schema.
 */
export function parseErrorEnvelope(errorBody: unknown, status: number): ApiError {
  const parsed = apiErrorResponseSchema.safeParse(errorBody);
  if (parsed.success) {
    return new ApiError(
      parsed.data.error.code,
      parsed.data.error.message,
      status,
      parsed.data.error.details,
    );
  }
  return new ApiError('HTTP_ERROR', `HTTP ${status}`, status);
}

/** True when the refresh response proves the stored token must be discarded. */
function isDefinitiveRefreshRejection(status: number, code: string | undefined): boolean {
  if (status === 400 || status === 401 || status === 403) {
    return true;
  }
  if (code === 'UNAUTHENTICATED') {
    return true;
  }
  if (code !== undefined && code.startsWith('REFRESH_TOKEN_')) {
    return true;
  }
  return false;
}

/**
 * Performs a token refresh directly, without acquiring `withAuthMutex`. For use inside an
 * already-held mutex (e.g. `changePasswordWithLock`) where re-entering the mutex would deadlock.
 *
 * @returns New access token, or `null` on definitive rejection (tokens cleared).
 * @throws {TransientAuthError} When the network / server failure is temporary (tokens kept).
 */
export async function refreshWithoutMutex(): Promise<string | null> {
  return doRefresh();
}

async function doRefresh(): Promise<string | null> {
  const presented = await getRefreshToken();
  if (!presented) {
    accessToken = null;
    return null;
  }

  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Client': 'mobile',
      },
      body: JSON.stringify({ refreshToken: presented }),
    });
  } catch (error) {
    throw new TransientAuthError('Refresh failed due to a network error', { cause: error });
  }

  if (!res.ok) {
    let errorCode: string | undefined;
    try {
      const raw: unknown = await res.json();
      const parsed = apiErrorResponseSchema.safeParse(raw);
      if (parsed.success) {
        errorCode = parsed.data.error.code;
      }
    } catch {
      // Body may be empty or non-JSON; status alone can still be definitive.
    }

    if (isDefinitiveRefreshRejection(res.status, errorCode)) {
      await clearSessionTokens();
      return null;
    }

    throw new TransientAuthError(`Refresh failed transiently (HTTP ${res.status})`);
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    // 2xx without a parseable body is not a usable session — treat as definitive.
    await clearSessionTokens();
    return null;
  }

  const parsed = authSessionSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.refreshToken) {
    await clearSessionTokens();
    return null;
  }

  await persistAuthSession(parsed.data);
  return parsed.data.accessToken;
}

/**
 * Single-flight refresh: concurrent 401s share one POST /auth/refresh (ADR-0010). Serialized with
 * `withAuthMutex` so password-change, sign-out and similar flows can hold the lock.
 *
 * @returns New access token, or `null` on definitive rejection (tokens cleared).
 * @throws {TransientAuthError} When the network / server failure is temporary (tokens kept).
 */
export async function refreshSession(): Promise<string | null> {
  if (inflightRefresh) {
    return inflightRefresh;
  }
  inflightRefresh = withAuthMutex(() => doRefresh()).finally(() => {
    inflightRefresh = null;
  });
  return inflightRefresh;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip the 401 → refresh → retry path (used by refresh itself). */
  skipAuthRetry?: boolean;
}

/**
 * Makes a JSON request to `${EXPO_PUBLIC_API_URL}<path>`. On 401 it refreshes once then retries.
 */
export async function apiRequest<T>(
  path: string,
  { body, headers: extraHeaders, skipAuthRetry, ...rest }: RequestOptions = {},
): Promise<T> {
  const doFetch = async (token: string | null) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Client': 'mobile',
      ...(extraHeaders as Record<string, string> | undefined),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return fetch(`${apiBaseUrl()}${path}`, {
      ...rest,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response = await doFetch(accessToken);

  if (response.status === 401 && !skipAuthRetry) {
    try {
      const newToken = await refreshSession();
      if (newToken) {
        response = await doFetch(newToken);
      }
    } catch (error) {
      if (!(error instanceof TransientAuthError)) {
        throw error;
      }
      // Keep the original 401; SecureStore still holds the refresh token.
    }
  }

  if (response.ok) {
    if (response.status === 204 || response.status === 205) {
      return undefined as T;
    }
    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    // Wrap JSON.parse: a non-JSON 2xx body (e.g. a proxy HTML error page) raises a typed
    // ApiError instead of a raw SyntaxError.
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(
        'HTTP_ERROR',
        `HTTP ${response.status}: response is not JSON`,
        response.status,
      );
    }
  }

  let errorBody: unknown;
  try {
    errorBody = await response.json();
  } catch {
    throw new ApiError(
      'HTTP_ERROR',
      response.statusText || `HTTP ${response.status}`,
      response.status,
    );
  }

  throw parseErrorEnvelope(errorBody, response.status);
}
