/**
 * Typed fetch client for the Najme mobile API (ADR-0003, ADR-0010).
 *
 * - Base URL: `EXPO_PUBLIC_API_URL` (includes `/api/v1`).
 * - Always sends `X-Client: mobile` so refresh tokens travel in the JSON body.
 * - Access token stays in memory; refresh token in SecureStore (see `token-storage.ts`).
 * - On 401: single-flight refresh then one retry; refresh failure clears the session store.
 * - `withAuthMutex` serializes refresh with other session mutations (#56 password change).
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
 * Serializes session-mutating work with refresh. Password change (#56) must hold this lock so a
 * concurrent 401 refresh cannot present the pre-change refresh token (ADR-0010).
 */
export function withAuthMutex<T>(operation: () => Promise<T>): Promise<T> {
  const next = mutexTail.then(operation, operation);
  mutexTail = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function apiBaseUrl(): string {
  const base = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!base) {
    throw new ApiError('HTTP_ERROR', 'EXPO_PUBLIC_API_URL is not set', 0);
  }
  return base.replace(/\/$/, '');
}

async function doRefresh(): Promise<string | null> {
  const presented = await getRefreshToken();
  if (!presented) {
    accessToken = null;
    return null;
  }

  try {
    const res = await fetch(`${apiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Client': 'mobile',
      },
      body: JSON.stringify({ refreshToken: presented }),
    });

    if (!res.ok) {
      await clearSessionTokens();
      return null;
    }

    const raw: unknown = await res.json();
    const parsed = authSessionSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.refreshToken) {
      await clearSessionTokens();
      return null;
    }

    await persistAuthSession(parsed.data);
    return parsed.data.accessToken;
  } catch {
    await clearSessionTokens();
    return null;
  }
}

/**
 * Single-flight refresh: concurrent 401s share one POST /auth/refresh (ADR-0010). Serialized with
 * `withAuthMutex` so password-change and similar flows can hold the lock.
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
    const newToken = await refreshSession();
    if (newToken) {
      response = await doFetch(newToken);
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
    return JSON.parse(text) as T;
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
