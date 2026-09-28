import { describe, expect, it } from 'vitest';

import { parseAcceptLanguage } from './accept-language.js';

describe('parseAcceptLanguage', () => {
  it('returns an empty list for an empty header', () => {
    expect(parseAcceptLanguage('')).toEqual([]);
    expect(parseAcceptLanguage('   ')).toEqual([]);
  });

  it('returns tags in header order when no q-value is given', () => {
    expect(parseAcceptLanguage('en, fr, de')).toEqual(['en', 'fr', 'de']);
  });

  it('orders tags by descending q-value', () => {
    expect(parseAcceptLanguage('da, en-gb;q=0.8, en;q=0.9')).toEqual(['da', 'en', 'en-gb']);
  });

  it('excludes q=0 entries', () => {
    expect(parseAcceptLanguage('en;q=0.9, fr;q=0')).toEqual(['en']);
  });

  it('keeps original order for equal q-values', () => {
    expect(parseAcceptLanguage('fr;q=0.5, de;q=0.5, en;q=0.5')).toEqual(['fr', 'de', 'en']);
  });

  it('trims whitespace around tags and params', () => {
    expect(parseAcceptLanguage(' en ; q=0.8 , fr ')).toEqual(['fr', 'en']);
  });

  it('treats a missing q as 1', () => {
    expect(parseAcceptLanguage('fr;q=0.9, en')).toEqual(['en', 'fr']);
  });

  it('ignores malformed q values by treating them as the default (1)', () => {
    expect(parseAcceptLanguage('fr;q=oops, en;q=0.5')).toEqual(['fr', 'en']);
  });

  it('keeps the wildcard tag as-is', () => {
    expect(parseAcceptLanguage('*, en;q=0.5')).toEqual(['*', 'en']);
  });

  it('drops duplicate tags, keeping the highest-q occurrence', () => {
    expect(parseAcceptLanguage('en;q=0.5, fr, en;q=0.9')).toEqual(['fr', 'en']);
  });

  it('is case-insensitive when deduplicating', () => {
    expect(parseAcceptLanguage('en-US, en-us;q=0.5')).toEqual(['en-US']);
  });

  it('skips blank comma-separated segments', () => {
    expect(parseAcceptLanguage('en,, fr')).toEqual(['en', 'fr']);
  });

  it('composes with resolveLocale', async () => {
    const { resolveLocale } = await import('./resolve-locale.js');
    expect(resolveLocale(parseAcceptLanguage('fr;q=0.9, sr-RS;q=0.95, en;q=0.5'))).toBe('me');
  });
});
