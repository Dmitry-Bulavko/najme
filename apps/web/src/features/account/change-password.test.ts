import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthSession } from '@najme/contracts';

import { getAccessToken, refreshSession, setAccessToken } from '@/lib/api/client';

import { changePasswordWithLock } from './change-password';

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const sessionUser = {
  id: 'u1',
  email: 'alice@example.com',
  emailVerified: true,
  displayName: 'Alice',
  avatarUrl: null,
  locale: 'en' as const,
  hasPassword: true,
};

const authSession: AuthSession = {
  accessToken: 'new-access',
  accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
  user: sessionUser,
};

const refreshSessionBody = {
  accessToken: 'refreshed-access',
  accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
  user: sessionUser,
};

describe('changePasswordWithLock', () => {
  beforeEach(() => {
    setAccessToken('old-access');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setAccessToken(null);
  });

  it('holds the refresh lock and replaces the access token on success', async () => {
    const request = vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn());
    vi.stubGlobal('navigator', { locks: { request } });

    vi.mocked(fetch).mockResolvedValueOnce(makeJsonResponse(authSession));

    const result = await changePasswordWithLock({
      currentPassword: 'oldpassword',
      newPassword: 'newpassword1',
    });

    expect(request).toHaveBeenCalledWith('najme-auth-refresh', expect.any(Function));
    expect(result.accessToken).toBe('new-access');
    expect(getAccessToken()).toBe('new-access');
  });

  it('refreshes once and retries when the access token has expired', async () => {
    const request = vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn());
    vi.stubGlobal('navigator', { locks: { request } });

    const passwordSuccess: AuthSession = {
      ...authSession,
      accessToken: 'after-password-change',
    };

    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/me/password')) {
        const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
        if (auth === 'Bearer old-access') {
          return Promise.resolve(
            makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'expired' } }, 401),
          );
        }
        if (auth === 'Bearer refreshed-access') {
          return Promise.resolve(makeJsonResponse(passwordSuccess));
        }
        return Promise.resolve(
          makeJsonResponse({ error: { code: 'HTTP_ERROR', message: 'unexpected token' } }, 500),
        );
      }
      if (url.includes('/auth/refresh')) {
        return Promise.resolve(makeJsonResponse(refreshSessionBody));
      }
      return Promise.resolve(
        makeJsonResponse({ error: { code: 'HTTP_ERROR', message: 'x' } }, 500),
      );
    });

    const result = await changePasswordWithLock({
      currentPassword: 'oldpassword',
      newPassword: 'newpassword1',
    });

    expect(result.accessToken).toBe('after-password-change');
    expect(getAccessToken()).toBe('after-password-change');
    const urls = vi.mocked(fetch).mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.includes('/auth/refresh'))).toHaveLength(1);
    expect(urls.filter((u) => u.includes('/me/password'))).toHaveLength(2);
  });

  it('surfaces a second 401 after refresh without looping', async () => {
    vi.stubGlobal('navigator', {
      locks: { request: async (_n: string, fn: () => Promise<unknown>) => fn() },
    });

    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/me/password')) {
        return Promise.resolve(
          makeJsonResponse({ error: { code: 'INVALID_CREDENTIALS', message: 'bad' } }, 401),
        );
      }
      if (url.includes('/auth/refresh')) {
        return Promise.resolve(makeJsonResponse(refreshSessionBody));
      }
      return Promise.resolve(
        makeJsonResponse({ error: { code: 'HTTP_ERROR', message: 'x' } }, 500),
      );
    });

    await expect(
      changePasswordWithLock({
        currentPassword: 'wrong',
        newPassword: 'newpassword1',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401 });

    const urls = vi.mocked(fetch).mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.includes('/auth/refresh'))).toHaveLength(1);
    expect(urls.filter((u) => u.includes('/me/password'))).toHaveLength(2);
  });

  it('makes a concurrent refresh wait until the password change releases the lock', async () => {
    let locked = false;
    const waiters: Array<() => void> = [];
    const request = vi.fn(async (_name: string, fn: () => Promise<unknown>) => {
      if (locked) {
        await new Promise<void>((resolve) => {
          waiters.push(resolve);
        });
      }
      locked = true;
      try {
        return await fn();
      } finally {
        locked = false;
        waiters.shift()?.();
      }
    });
    vi.stubGlobal('navigator', { locks: { request } });

    let resolvePassword!: (value: Response) => void;
    const passwordResponse = new Promise<Response>((resolve) => {
      resolvePassword = resolve;
    });

    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/me/password')) {
        return passwordResponse;
      }
      if (url.includes('/auth/refresh')) {
        return Promise.resolve(
          makeJsonResponse({
            ...authSession,
            accessToken: 'from-refresh',
          }),
        );
      }
      return Promise.resolve(
        makeJsonResponse({ error: { code: 'HTTP_ERROR', message: 'x' } }, 500),
      );
    });

    const passwordPromise = changePasswordWithLock({
      currentPassword: 'oldpassword',
      newPassword: 'newpassword1',
    });

    // Let the password change acquire the lock and stall on fetch.
    await Promise.resolve();
    await Promise.resolve();

    const refreshPromise = refreshSession();
    await Promise.resolve();
    await Promise.resolve();

    // Only the password request should have started while the lock is held.
    expect(vi.mocked(fetch).mock.calls.map((c) => String(c[0]))).toEqual(['/api/v1/me/password']);

    resolvePassword(makeJsonResponse(authSession));
    await expect(passwordPromise).resolves.toMatchObject({ accessToken: 'new-access' });
    await expect(refreshPromise).resolves.toBe('from-refresh');
    expect(vi.mocked(fetch).mock.calls.map((c) => String(c[0]))).toEqual([
      '/api/v1/me/password',
      '/api/v1/auth/refresh',
    ]);
  });
});
