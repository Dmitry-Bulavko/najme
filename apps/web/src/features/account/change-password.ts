/**
 * Change-password API call that holds the auth refresh lock (extra AC from #52 / #54).
 *
 * While the lock is held, concurrent `refreshSession` / cross-tab refresh waits instead of racing
 * with the cookie rotation that password change performs. Uses a direct fetch (no nested
 * `apiRequest` 401 refresh) to avoid re-entering the same non-reentrant lock; on 401 it calls
 * `refreshSessionUnlocked` once and retries the POST once (#147).
 */
import {
  apiErrorResponseSchema,
  authSessionSchema,
  type AuthSession,
  type ChangePasswordRequest,
} from '@najme/contracts';

import {
  ApiError,
  getAccessToken,
  refreshSessionUnlocked,
  setAccessToken,
  withAuthRefreshLock,
} from '@/lib/api/client';

async function postChangePassword(
  body: ChangePasswordRequest,
  token: string | null,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch('/api/v1/me/password', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function parseChangePasswordResponse(response: Response): Promise<AuthSession> {
  if (response.ok) {
    const data: unknown = await response.json();
    const parsed = authSessionSchema.safeParse(data);
    if (!parsed.success) {
      throw new ApiError('HTTP_ERROR', 'Invalid password-change response', response.status);
    }
    setAccessToken(parsed.data.accessToken);
    return parsed.data;
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

export async function changePasswordWithLock(body: ChangePasswordRequest): Promise<AuthSession> {
  return withAuthRefreshLock(async () => {
    const requestToken = getAccessToken();
    let response = await postChangePassword(body, requestToken);

    // Expired access token: refresh without re-acquiring the lock, then retry once.
    if (response.status === 401 && requestToken) {
      const newToken = await refreshSessionUnlocked();
      if (newToken) {
        response = await postChangePassword(body, newToken);
      }
    }

    return parseChangePasswordResponse(response);
  });
}
