import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isApiHealthy } from './health';

const okBody = { status: 'ok', db: 'ok', version: 'abc1234' };

describe('isApiHealthy', () => {
  beforeEach(() => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api:3000/api/v1');
    vi.stubEnv('PUBLIC_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns true for a healthy API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(okBody));
    vi.stubGlobal('fetch', fetchMock);

    await expect(isApiHealthy()).resolves.toBe(true);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://api:3000/api/v1/health');
  });

  it('returns false on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 503 })));
    await expect(isApiHealthy()).resolves.toBe(false);
  });

  it('returns false on timeout / abort', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('The operation timed out', 'TimeoutError')),
    );
    await expect(isApiHealthy()).resolves.toBe(false);
  });

  it('returns false on a malformed JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })));
    await expect(isApiHealthy()).resolves.toBe(false);
  });

  it('returns false when the body does not match the contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ hello: 'world' })));
    await expect(isApiHealthy()).resolves.toBe(false);
  });

  it('returns false without calling fetch when no API URL is configured', async () => {
    vi.stubEnv('API_INTERNAL_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(isApiHealthy()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
