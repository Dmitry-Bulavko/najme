import { afterEach, describe, expect, it, vi } from 'vitest';

import { replaceLocaleInPath, safeNextPath } from './safe-next-path';

describe('safeNextPath', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back for null', () => {
    expect(safeNextPath(null, 'en')).toBe('/en');
  });

  it('rejects absolute https URLs', () => {
    expect(safeNextPath('https://evil.com', 'en')).toBe('/en');
  });

  it('rejects protocol-relative URLs', () => {
    expect(safeNextPath('//evil.com', 'en')).toBe('/en');
  });

  it('rejects backslash-normalised protocol-relative paths', () => {
    expect(safeNextPath('/\\evil.com', 'en')).toBe('/en');
  });

  it('rejects URL-encoded protocol-relative paths', () => {
    expect(safeNextPath('/%2F%2Fevil.com', 'en')).toBe('/en');
  });

  it('rejects javascript: schemes', () => {
    expect(safeNextPath('javascript:alert(1)', 'en')).toBe('/en');
  });

  it('rejects control characters before a protocol-relative path', () => {
    expect(safeNextPath('\t//evil.com', 'en')).toBe('/en');
  });

  it('rejects unknown locale prefixes', () => {
    expect(safeNextPath('/xx/foo', 'en')).toBe('/en');
  });

  it('keeps a same-origin locale path with query and hash', () => {
    expect(safeNextPath('/en/account?tab=1#x', 'en')).toBe('/en/account?tab=1#x');
  });

  it('falls back when origin check fails', () => {
    // jsdom origin is http://localhost:3000; //other.example resolves off-origin.
    expect(safeNextPath('//other.example/pwned', 'me')).toBe('/me');
  });
});

describe('replaceLocaleInPath', () => {
  it('rewrites only the locale segment and keeps query and hash', () => {
    expect(replaceLocaleInPath('/en/account?tab=1#x', 'ru')).toBe('/ru/account?tab=1#x');
  });

  it('rewrites a bare locale home path', () => {
    expect(replaceLocaleInPath('/en', 'me')).toBe('/me');
  });
});
