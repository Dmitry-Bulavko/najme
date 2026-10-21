import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  apiRequest,
  getAccessToken,
  refreshSession,
  refreshSessionUnlocked,
  setAccessToken,
  setRefreshTokenReusedHandler,
  withAuthRefreshLock,
} from './client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  setAccessToken(null);
  setRefreshTokenReusedHandler(null);
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  setRefreshTokenReusedHandler(null);
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Basic request tests
// ---------------------------------------------------------------------------

describe('apiRequest', () => {
  it('sends the access token as a Bearer header', async () => {
    setAccessToken('tok-123');
    vi.mocked(fetch).mockResolvedValueOnce(makeJsonResponse({ ok: true }));

    await apiRequest('/foo');

    expect(fetch).toHaveBeenCalledOnce();
    const call = vi.mocked(fetch).mock.calls[0];
    // call is defined because we asserted toHaveBeenCalledOnce above
    const init = call![1] as RequestInit; // non-null: call exists per the assertion
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-123');
  });

  it('throws ApiError with the code from the error envelope on non-2xx', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404),
    );

    await expect(apiRequest('/missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('throws ApiError HTTP_ERROR when the body is not a valid error envelope', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Internal error', { status: 500 }));

    await expect(apiRequest('/boom')).rejects.toMatchObject({ code: 'HTTP_ERROR' });
  });

  it('returns undefined for an empty 202 Accepted body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 202 }));

    await expect(apiRequest('/auth/forgot-password', { method: 'POST', body: {} })).resolves.toBe(
      undefined,
    );
  });
});

// ---------------------------------------------------------------------------
// 401 + refresh single-flight tests
// ---------------------------------------------------------------------------

describe('401 retry with single-flight refresh', () => {
  it('retries the original request once after a successful refresh on 401', async () => {
    setAccessToken('old-token');

    vi.mocked(fetch)
      // First request: 401
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      )
      // Refresh
      .mockResolvedValueOnce(
        makeJsonResponse({
          accessToken: 'new-token',
          accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
          user: {
            id: 'u1',
            email: 'a@b.com',
            emailVerified: false,
            displayName: null,
            avatarUrl: null,
            locale: 'en',
            hasPassword: true,
            isPlatformAdmin: false,
          },
        }),
      )
      // Retry succeeds
      .mockResolvedValueOnce(makeJsonResponse({ data: 'ok' }));

    const result = await apiRequest<{ data: string }>('/protected');

    expect(result).toEqual({ data: 'ok' });
    expect(fetch).toHaveBeenCalledTimes(3);
    const retryCall = vi.mocked(fetch).mock.calls[2];
    const retryInit = retryCall![1] as RequestInit; // non-null: call[2] exists per toHaveBeenCalledTimes(3)
    expect((retryInit.headers as Record<string, string>)['Authorization']).toBe('Bearer new-token');
  });

  it('only fires one refresh when multiple 401 responses arrive concurrently (single-flight)', async () => {
    setAccessToken('old-tok');

    let refreshCount = 0;
    const refreshResponse = makeJsonResponse({
      accessToken: 'fresh-tok',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      user: {
        id: 'u1',
        email: 'a@b.com',
        emailVerified: false,
        displayName: null,
        avatarUrl: null,
        locale: 'en',
        hasPassword: true,
        isPlatformAdmin: false,
      },
    });

    // Fire two concurrent requests that both 401 on the first try.
    vi.mocked(fetch).mockReset();
    let callCount = 0;
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        refreshCount++;
        return Promise.resolve(refreshResponse.clone());
      }
      callCount++;
      if (callCount <= 2) {
        // First two original calls: 401
        return Promise.resolve(
          makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
        );
      }
      return Promise.resolve(makeJsonResponse({ ok: true }));
    });

    await Promise.all([apiRequest('/endpoint-a'), apiRequest('/endpoint-b')]);

    expect(refreshCount).toBe(1);
  });

  it('throws ApiError after failed refresh (does not retry)', async () => {
    setAccessToken('bad-tok');

    vi.mocked(fetch)
      // Original request: 401
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      )
      // Refresh fails (e.g. expired cookie)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      );

    await expect(apiRequest('/protected')).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not call /auth/refresh on a 401 from /auth/login even with a stale access token', async () => {
    setAccessToken('stale-access');

    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({ error: { code: 'INVALID_CREDENTIALS', message: 'bad' } }, 401),
    );

    await expect(
      apiRequest('/auth/login', { method: 'POST', body: { email: 'a@b.com', password: 'x' } }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0]![0])).toContain('/auth/login');
  });

  it('does not refresh on 401 when the request had no bearer token', async () => {
    setAccessToken(null);

    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
    );

    await expect(apiRequest('/me')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// refreshSession / lock / reuse tests
// ---------------------------------------------------------------------------

describe('withAuthRefreshLock', () => {
  it('uses navigator.locks.request when available', async () => {
    const request = vi.fn(async (_name: string, fn: () => Promise<string>) => fn());
    vi.stubGlobal('navigator', { locks: { request } });

    const result = await withAuthRefreshLock(async () => 'ok');

    expect(result).toBe('ok');
    expect(request).toHaveBeenCalledWith('najme-auth-refresh', expect.any(Function));
  });

  it('runs the callback directly when locks are unavailable', async () => {
    vi.stubGlobal('navigator', {});

    await expect(withAuthRefreshLock(async () => 42)).resolves.toBe(42);
  });
});

describe('refreshSession', () => {
  it('returns null and clears token when refresh returns 401', async () => {
    setAccessToken('stale');
    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
    );

    const token = await refreshSession();
    expect(token).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('returns null and keeps the access token when refresh returns 503', async () => {
    setAccessToken('still-valid');
    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'down' } }, 503),
    );

    const token = await refreshSession();
    expect(token).toBeNull();
    expect(getAccessToken()).toBe('still-valid');
  });

  it('returns null and keeps the access token on a network error', async () => {
    setAccessToken('still-valid');
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const token = await refreshSession();
    expect(token).toBeNull();
    expect(getAccessToken()).toBe('still-valid');
  });

  it('invokes the reuse handler and throws ApiError on REFRESH_TOKEN_REUSED', async () => {
    setAccessToken('stale');
    const onReuse = vi.fn();
    setRefreshTokenReusedHandler(onReuse);

    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({ error: { code: 'REFRESH_TOKEN_REUSED', message: 'Token reused' } }, 401),
    );

    await expect(refreshSession()).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_REUSED',
      status: 401,
    });
    expect(onReuse).toHaveBeenCalledOnce();
  });

  it('wraps doRefresh with the auth refresh lock', async () => {
    const request = vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn());
    vi.stubGlobal('navigator', { locks: { request } });

    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({
        accessToken: 'fresh',
        accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
        user: {
          id: 'u1',
          email: 'a@b.com',
          emailVerified: false,
          displayName: null,
          avatarUrl: null,
          locale: 'en',
          hasPassword: true,
          isPlatformAdmin: false,
        },
      }),
    );

    await expect(refreshSession()).resolves.toBe('fresh');
    expect(request).toHaveBeenCalledWith('najme-auth-refresh', expect.any(Function));
  });
});

describe('refreshSessionUnlocked', () => {
  it('refreshes without acquiring the auth refresh lock', async () => {
    const request = vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn());
    vi.stubGlobal('navigator', { locks: { request } });
    setAccessToken('stale');

    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({
        accessToken: 'unlocked-fresh',
        accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
        user: {
          id: 'u1',
          email: 'a@b.com',
          emailVerified: false,
          displayName: null,
          avatarUrl: null,
          locale: 'en',
          hasPassword: true,
          isPlatformAdmin: false,
        },
      }),
    );

    await expect(refreshSessionUnlocked()).resolves.toBe('unlocked-fresh');
    expect(request).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe('unlocked-fresh');
  });

  it('does not await a lock-bound refreshingPromise while the lock is held', async () => {
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
    setAccessToken('stale');

    vi.mocked(fetch).mockImplementation((input) => {
      if (String(input).includes('/auth/refresh')) {
        return Promise.resolve(
          makeJsonResponse({
            accessToken: 'unlocked-while-queued',
            accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
            user: {
              id: 'u1',
              email: 'a@b.com',
              emailVerified: false,
              displayName: null,
              avatarUrl: null,
              locale: 'en',
              hasPassword: true,
              isPlatformAdmin: false,
            },
          }),
        );
      }
      return Promise.resolve(
        makeJsonResponse({ error: { code: 'HTTP_ERROR', message: 'x' } }, 500),
      );
    });

    // Hold the lock the way password change does, then queue a lock-bound refreshSession.
    const unlockedWhileHolding = withAuthRefreshLock(async () => {
      const queued = refreshSession();
      await Promise.resolve();
      await Promise.resolve();
      // Must not hang on the queued lock-bound promise.
      const token = await refreshSessionUnlocked();
      return { token, queued };
    });

    const { token, queued } = await unlockedWhileHolding;
    expect(token).toBe('unlocked-while-queued');
    await expect(queued).resolves.toBe('unlocked-while-queued');
  });
});
