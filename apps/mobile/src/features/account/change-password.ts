/**
 * Change-password API call that holds the auth refresh mutex (#56 extra AC).
 *
 * While the lock is held, concurrent `refreshSession` waits instead of racing with the refresh
 * token rotation that password change performs. Uses a direct fetch (no nested 401 refresh) to
 * avoid re-entering the same non-reentrant mutex.
 */
import {
  apiErrorResponseSchema,
  authSessionSchema,
  type AuthSession,
  type ChangePasswordRequest,
} from '@najme/contracts';

import { ApiError, getAccessToken, persistAuthSession, withAuthMutex } from '@/lib/api/client';

function apiBaseUrl(): string {
  const base = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!base) {
    throw new ApiError('HTTP_ERROR', 'EXPO_PUBLIC_API_URL is not set', 0);
  }
  return base.replace(/\/$/, '');
}

export async function changePasswordWithLock(body: ChangePasswordRequest): Promise<AuthSession> {
  return withAuthMutex(async () => {
    const token = getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Client': 'mobile',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${apiBaseUrl()}/me/password`, {
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
      // Persist the rotated refresh token + swap access before releasing the mutex.
      await persistAuthSession(parsed.data);
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
