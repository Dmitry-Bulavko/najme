import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiRequest, refreshSession, setAccessToken } from './client';

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
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
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
      },
    });

    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        refreshCount++;
        return Promise.resolve(refreshResponse.clone());
      }
      // All other calls: return 401 first time, then 200
      return Promise.resolve(makeJsonResponse({ ok: true }));
    });

    // Fire two concurrent requests that both 401 on the first try.
    // Override: first call to /api/v1/endpoint always 401, retry succeeds.
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
});

// ---------------------------------------------------------------------------
// refreshSession tests
// ---------------------------------------------------------------------------

describe('refreshSession', () => {
  it('returns null and clears token when refresh returns non-2xx', async () => {
    setAccessToken('stale');
    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
    );

    const token = await refreshSession();
    expect(token).toBeNull();
  });
});
