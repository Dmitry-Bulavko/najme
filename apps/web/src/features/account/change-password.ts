/**
 * Change-password API call that holds the auth refresh lock (extra AC from #52 / #54).
 *
 * While the lock is held, concurrent `refreshSession` / cross-tab refresh waits instead of racing
 * with the cookie rotation that password change performs. Uses a direct fetch (no nested 401
 * refresh) to avoid re-entering the same non-reentrant lock.
 */
import {
  apiErrorResponseSchema,
  authSessionSchema,
  type AuthSession,
  type ChangePasswordRequest,
} from '@najme/contracts';

import { ApiError, getAccessToken, setAccessToken, withAuthRefreshLock } from '@/lib/api/client';

export async function changePasswordWithLock(body: ChangePasswordRequest): Promise<AuthSession> {
  return withAuthRefreshLock(async () => {
    const token = getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/v1/me/password', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

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
  });
}
