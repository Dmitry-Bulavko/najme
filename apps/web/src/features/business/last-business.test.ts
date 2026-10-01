import { describe, expect, it, vi } from 'vitest';

import {
  LAST_BUSINESS_STORAGE_KEY,
  clearLastBusinessId,
  readLastBusinessId,
  writeLastBusinessId,
} from './last-business';

describe('last-business storage', () => {
  it('reads and writes the remembered business id', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });

    expect(readLastBusinessId()).toBeNull();
    writeLastBusinessId('biz-1');
    expect(store.get(LAST_BUSINESS_STORAGE_KEY)).toBe('biz-1');
    expect(readLastBusinessId()).toBe('biz-1');
    clearLastBusinessId();
    expect(readLastBusinessId()).toBeNull();
  });

  it('returns null when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readLastBusinessId()).toBeNull();
    expect(() => writeLastBusinessId('x')).not.toThrow();
    expect(() => clearLastBusinessId()).not.toThrow();
  });
});
