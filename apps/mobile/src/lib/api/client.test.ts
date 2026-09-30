import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  ApiError,
  apiRequest,
  clearSessionTokens,
  getAccessToken,
  persistAuthSession,
  refreshSession,
  setAccessToken,
  TransientAuthError,
  withAuthMutex,
} from './client';
import { clearRefreshToken, getRefreshToken, setRefreshToken } from './token-storage';

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const me = {
  id: 'u1',
  email: 'a@b.com',
  emailVerified: false,
  displayName: null,
  avatarUrl: null,
  locale: 'en' as const,
  hasPassword: true,
};

function sessionBody(accessToken: string, refreshToken?: string) {
  return {
    accessToken,
    accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    ...(refreshToken ? { refreshToken } : {}),
    user: me,
  };
}

beforeEach(async () => {
  await clearSessionTokens();
  setAccessToken(null);
  jest.spyOn(globalThis, 'fetch').mockImplementation(jest.fn<typeof fetch>());
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('apiRequest', () => {
  it('sends X-Client: mobile and the Bearer access token', async () => {
    setAccessToken('tok-123');
    jest.mocked(fetch).mockResolvedValueOnce(makeJsonResponse({ ok: true }));

    await apiRequest('/foo');

    expect(fetch).toHaveBeenCalledTimes(1);
    const init = jest.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Client']).toBe('mobile');
    expect(headers.Authorization).toBe('Bearer tok-123');
  });

  it('throws ApiError with the envelope code on non-2xx', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404),
      );

    await expect(apiRequest('/missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(ApiError).toBeDefined();
  });
});

describe('401 retry with single-flight refresh', () => {
  it('retries once after a successful refresh on 401', async () => {
    setAccessToken('old-token');
    await setRefreshToken('rt-1');

    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      )
      .mockResolvedValueOnce(makeJsonResponse(sessionBody('new-token', 'rt-2')))
      .mockResolvedValueOnce(makeJsonResponse({ ok: true }));

    await expect(apiRequest('/secure')).resolves.toEqual({ ok: true });
    expect(getAccessToken()).toBe('new-token');
    expect(await getRefreshToken()).toBe('rt-2');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('shares one refresh across concurrent 401s (single-flight)', async () => {
    setAccessToken('old');
    await setRefreshToken('rt-1');

    let refreshCalls = 0;
    jest.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 30));
        return makeJsonResponse(sessionBody('shared', 'rt-shared'));
      }
      if (
        (init?.headers as Record<string, string> | undefined)?.Authorization === 'Bearer shared'
      ) {
        return makeJsonResponse({ ok: true });
      }
      return makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401);
    });

    await Promise.all([apiRequest('/a'), apiRequest('/b')]);
    expect(refreshCalls).toBe(1);
  });

  it('clears the session when refresh fails definitively (401)', async () => {
    setAccessToken('old');
    await setRefreshToken('rt-1');

    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'dead' } }, 401),
      );

    await expect(apiRequest('/secure')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
  });

  it('keeps the refresh token when refresh returns 503 during a 401 retry', async () => {
    setAccessToken('old');
    await setRefreshToken('rt-keep');

    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'down' } }, 503),
      );

    await expect(apiRequest('/secure')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(await getRefreshToken()).toBe('rt-keep');
  });
});

describe('withAuthMutex and session helpers', () => {
  it('serializes mutex holders so a second op waits for the first', async () => {
    const order: string[] = [];
    const first = withAuthMutex(async () => {
      order.push('start-1');
      await new Promise((r) => setTimeout(r, 40));
      order.push('end-1');
      return 1;
    });
    const second = withAuthMutex(async () => {
      order.push('start-2');
      order.push('end-2');
      return 2;
    });

    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
  });

  it('persistAuthSession writes SecureStore and clearSessionTokens empties it', async () => {
    await persistAuthSession(sessionBody('at', 'rt') as never);
    expect(getAccessToken()).toBe('at');
    expect(await getRefreshToken()).toBe('rt');

    await clearSessionTokens();
    expect(getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
  });

  it('refreshSession restores access from SecureStore', async () => {
    await setRefreshToken('rt-stored');
    jest.mocked(fetch).mockResolvedValueOnce(makeJsonResponse(sessionBody('restored', 'rt-new')));

    await expect(refreshSession()).resolves.toBe('restored');
    expect(getAccessToken()).toBe('restored');
    expect(await getRefreshToken()).toBe('rt-new');
  });

  it('keeps the refresh token and throws TransientAuthError on network failure', async () => {
    await setRefreshToken('rt-offline');
    jest.mocked(fetch).mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(refreshSession()).rejects.toBeInstanceOf(TransientAuthError);
    expect(await getRefreshToken()).toBe('rt-offline');
  });

  it('keeps the refresh token and throws TransientAuthError on HTTP 503', async () => {
    await setRefreshToken('rt-503');
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'down' } }, 503),
      );

    await expect(refreshSession()).rejects.toBeInstanceOf(TransientAuthError);
    expect(await getRefreshToken()).toBe('rt-503');
  });

  it('clears tokens on 401 REFRESH_TOKEN_REUSED', async () => {
    await setRefreshToken('rt-reused');
    setAccessToken('old');
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'REFRESH_TOKEN_REUSED', message: 'reuse' } }, 401),
      );

    await expect(refreshSession()).resolves.toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
  });

  it('clearRefreshToken leaves storage empty after sign-out path', async () => {
    await setRefreshToken('rt');
    await clearRefreshToken();
    expect(await getRefreshToken()).toBeNull();
  });
});
