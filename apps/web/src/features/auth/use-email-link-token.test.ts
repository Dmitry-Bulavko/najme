import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEmailLinkToken } from './use-email-link-token';

const getParam = vi.fn<() => string | null>(() => 'secret-token');

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: getParam }),
}));

beforeEach(() => {
  getParam.mockReturnValue('secret-token');
  window.history.replaceState({}, '', '/en/verify-email?token=secret-token');
  vi.spyOn(window.history, 'replaceState');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useEmailLinkToken', () => {
  it('returns the token and strips it from the URL without a timer', async () => {
    const { result, unmount } = renderHook(() => useEmailLinkToken());

    expect(result.current).toBe('secret-token');

    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalled();
    });

    const nextUrl = vi.mocked(window.history.replaceState).mock.calls[0]?.[2];
    expect(nextUrl).toBe('/en/verify-email');

    // Unmount must not cancel scrubbing (no setTimeout cleanup).
    unmount();
    expect(String(window.location.href)).not.toContain('token=');
  });

  it('returns null when the query has no token', () => {
    getParam.mockReturnValue(null);
    window.history.replaceState({}, '', '/en/verify-email');
    vi.mocked(window.history.replaceState).mockClear();

    const { result } = renderHook(() => useEmailLinkToken());
    expect(result.current).toBeNull();
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });
});
