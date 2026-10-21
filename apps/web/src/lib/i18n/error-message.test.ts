import { describe, expect, it, vi } from 'vitest';

import { errorMessage } from './error-message';

describe('errorMessage', () => {
  it('returns the catalogued string for a known code', () => {
    const tErrors = Object.assign(
      vi.fn((key: string) => `msg:${key}`),
      { has: (key: string) => key === 'INVALID_CREDENTIALS' },
    );

    expect(errorMessage(tErrors, 'INVALID_CREDENTIALS')).toBe('msg:INVALID_CREDENTIALS');
    expect(tErrors).toHaveBeenCalledWith('INVALID_CREDENTIALS');
  });

  it('falls back to HTTP_ERROR for an unknown code', () => {
    const tErrors = Object.assign(
      vi.fn((key: string) => `msg:${key}`),
      { has: () => false },
    );

    expect(errorMessage(tErrors, 'SOME_FUTURE_CODE')).toBe('msg:HTTP_ERROR');
    expect(tErrors).toHaveBeenCalledWith('HTTP_ERROR');
  });
});
