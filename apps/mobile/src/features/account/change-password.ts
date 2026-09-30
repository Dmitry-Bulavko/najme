/**
 * Change-password API call that holds the auth refresh mutex (#56 extra AC, #148).
 *
 * While the lock is held, concurrent `refreshSession` waits instead of racing with the refresh
 * token rotation that password change performs. On a 401 (expired access token), the function
 * refreshes directly — without re-entering `withAuthMutex` — and retries once (#148).
 */
import {
  apiErrorResponseSchema,
  authSessionSchema,
  type AuthSession,
  type ChangePasswordRequest,
} from '@najme/contracts';

import {
  ApiError,
  apiBaseUrl,
  getAccessToken,
  parseErrorEnvelope,
  persistAuthSession,
  refreshWithoutMutex,
  withAuthMutex,
} from '@/lib/api/client';

async function doRequest(token: string | null, body: ChangePasswordRequest): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Client': 'mobile',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${apiBaseUrl()}/me/password`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function parseOkResponse(response: Response): Promise<AuthSession> {
  const data: unknown = await response.json();
  const parsed = authSessionSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError('HTTP_ERROR', 'Invalid password-change response', response.status);
  }
  // Persist the rotated refresh token + swap access before releasing the mutex.
  await persistAuthSession(parsed.data);
  return parsed.data;
}

async function throwFromErrorResponse(response: Response): Promise<never> {
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

export async function changePasswordWithLock(body: ChangePasswordRequest): Promise<AuthSession> {
  return withAuthMutex(async () => {
    let response = await doRequest(getAccessToken(), body);

    if (response.status === 401) {
      // Peek at the error body to distinguish an expired-token 401 (UNAUTHENTICATED) from a
      // business-logic 401 like INVALID_CREDENTIALS (wrong current password — should not refresh).
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
      const parsedError = apiErrorResponseSchema.safeParse(errorBody);
      const errorCode = parsedError.success ? parsedError.data.error.code : undefined;

      if (errorCode !== 'UNAUTHENTICATED') {
        // Business-logic 401 (e.g. INVALID_CREDENTIALS) — propagate without refreshing.
        throw parseErrorEnvelope(errorBody, response.status);
      }

      // Access token expired — refresh inside the held mutex (lock-free: no re-entry needed).
      const newToken = await refreshWithoutMutex();
      if (!newToken) {
        // Definitive rejection; session already cleared by doRefresh.
        throw new ApiError('UNAUTHENTICATED', 'Session expired', 401);
      }
      response = await doRequest(newToken, body);
    }

    if (response.ok) {
      return parseOkResponse(response);
    }
    return throwFromErrorResponse(response);
  });
}
