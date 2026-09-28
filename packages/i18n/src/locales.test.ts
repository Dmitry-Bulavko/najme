import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_META,
  SUPPORTED_LOCALES,
  toIntlLocale,
} from './locales.js';

describe('locales', () => {
  it('supports exactly en, me, ru, tr', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'me', 'ru', 'tr']);
  });

  it('defaults to en', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('maps me to the sr-Latn-ME BCP-47 tag', () => {
    expect(LOCALE_META.me.bcp47).toBe('sr-Latn-ME');
    expect(toIntlLocale('me')).toBe('sr-Latn-ME');
  });

  it('has a label and BCP-47 tag for every supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_META[locale].label.length).toBeGreaterThan(0);
      expect(LOCALE_META[locale].bcp47.length).toBeGreaterThan(0);
      expect(toIntlLocale(locale)).toBe(LOCALE_META[locale].bcp47);
    }
  });

  it('new Intl.NumberFormat accepts every BCP-47 tag', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(() => new Intl.NumberFormat(toIntlLocale(locale))).not.toThrow();
    }
  });

  it('isLocale narrows valid and rejects invalid codes', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('me')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale('')).toBe(false);
  });
});
