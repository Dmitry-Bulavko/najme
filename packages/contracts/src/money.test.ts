import { describe, expect, it } from 'vitest';

import { currencySchema, formatMinorAsMajor, moneySchema, parseMajorToMinor } from './money.js';

describe('moneySchema', () => {
  it('accepts a positive amount', () => {
    const result = moneySchema.safeParse({ amount: 2500, currency: 'EUR' });

    expect(result.success).toBe(true);
  });

  it('accepts a zero amount', () => {
    const result = moneySchema.safeParse({ amount: 0, currency: 'EUR' });

    expect(result.success).toBe(true);
  });

  it('accepts a negative amount for refunds/credits', () => {
    const result = moneySchema.safeParse({ amount: -500, currency: 'EUR' });

    expect(result.success).toBe(true);
  });

  it('rejects a non-integer amount', () => {
    const result = moneySchema.safeParse({ amount: 25.5, currency: 'EUR' });

    expect(result.success).toBe(false);
  });

  it('rejects a lowercase currency', () => {
    const result = moneySchema.safeParse({ amount: 2500, currency: 'eur' });

    expect(result.success).toBe(false);
  });

  it('rejects a currency that is not 3 letters', () => {
    const result = moneySchema.safeParse({ amount: 2500, currency: 'EURO' });

    expect(result.success).toBe(false);
  });
});

describe('currencySchema', () => {
  it('accepts a valid ISO 4217-shaped code', () => {
    expect(currencySchema.safeParse('USD').success).toBe(true);
  });

  it('rejects digits', () => {
    expect(currencySchema.safeParse('12A').success).toBe(false);
  });
});

describe('parseMajorToMinor — en locale (. decimal, , grouping)', () => {
  it.each([
    // Basic integers
    ['25', 2500],
    ['0', 0],
    // Dot as decimal
    ['25.5', 2550],
    ['25.50', 2550],
    ['25.99', 2599],
    // Valid comma grouping: groups of exactly 3 after the first 1–3 digits
    ['1,234', 123400],
    ['1,234,567', 123456700],
    // Valid grouping + decimal
    ['1,234.56', 123456],
    ['1,234.5', 123450],
    // Fractional-only input
    ['.5', 50],
    // Rounding: third decimal ≥ 5 rounds up
    ['0.005', 1],
    ['1.005', 101],
    // Rounding: third decimal < 5 rounds down
    ['0.004', 0],
    // Negative
    ['-10.5', -1050],
    ['-0.50', -50],
    // Leading/trailing whitespace
    ['  12.3  ', 1230],
    // Space as grouping
    ['1 234.56', 123456],
  ])('en: parses %j → %i', (raw, expected) => {
    expect(parseMajorToMinor(raw, 'en')).toBe(expected);
  });

  it.each([
    // Bad grouping: 12,5 — only 1 digit after the comma (not 3)
    ['12,5'],
    // Bad grouping: 12,50 — only 2 digits after the comma
    ['12,50'],
    // Two decimal separators
    ['1.234.567'],
  ])('en: returns null for invalid grouping / ambiguous %j', (raw) => {
    expect(parseMajorToMinor(raw, 'en')).toBeNull();
  });

  it('normalises -0 to 0', () => {
    expect(Object.is(parseMajorToMinor('-0', 'en'), -0)).toBe(false);
    expect(parseMajorToMinor('-0', 'en')).toBe(0);
  });

  it('returns null for empty / whitespace', () => {
    expect(parseMajorToMinor('', 'en')).toBeNull();
    expect(parseMajorToMinor('   ', 'en')).toBeNull();
  });

  it('returns null for strings with non-numeric chars (12abc)', () => {
    expect(parseMajorToMinor('12abc', 'en')).toBeNull();
    expect(parseMajorToMinor('abc', 'en')).toBeNull();
    expect(parseMajorToMinor('12e3', 'en')).toBeNull();
  });

  it('returns null for value beyond MAX_SAFE_INTEGER', () => {
    expect(parseMajorToMinor(String(Number.MAX_SAFE_INTEGER + 1), 'en')).toBeNull();
  });
});

describe('parseMajorToMinor — me/ru/tr locales (, decimal, . grouping)', () => {
  it.each([
    // Comma as decimal (me)
    ['25,5', 2550],
    ['25,99', 2599],
    // Valid dot grouping (me): groups of exactly 3
    ['1.234', 123400],
    ['1.234.567', 123456700],
    // Valid grouping + comma decimal
    ['1.234,56', 123456],
    ['1.234,5', 123450],
    // Space grouping + comma decimal
    ['1 234,56', 123456],
    // Negative
    ['-10,5', -1050],
  ])('me: parses %j → %i', (raw, expected) => {
    expect(parseMajorToMinor(raw, 'me')).toBe(expected);
  });

  it.each([
    // Bad grouping: 1.2.3 — groups of 1, not 3
    ['1.2.3'],
  ])('me: returns null for invalid grouping %j', (raw) => {
    expect(parseMajorToMinor(raw, 'me')).toBeNull();
  });

  it('returns null for two decimal separators in me (1,234,567)', () => {
    expect(parseMajorToMinor('1,234,567', 'me')).toBeNull();
  });

  it('applies same rules for ru and tr', () => {
    expect(parseMajorToMinor('1.234,56', 'ru')).toBe(123456);
    expect(parseMajorToMinor('1.234,56', 'tr')).toBe(123456);
  });
});

describe('parseMajorToMinor — default (no locale = en)', () => {
  it('defaults to en locale', () => {
    expect(parseMajorToMinor('1,234.56')).toBe(123456);
  });
});

describe('formatMinorAsMajor', () => {
  it.each([
    [2500, 'en', '25.00'],
    [2550, 'en', '25.50'],
    [1, 'en', '0.01'],
    [0, 'en', '0.00'],
    [-1050, 'en', '-10.50'],
    // me/ru/tr use comma as decimal separator
    [2500, 'me', '25,00'],
    [2550, 'ru', '25,50'],
    [-1050, 'tr', '-10,50'],
  ] as const)('formats %i (%s) → %j', (minor, locale, expected) => {
    expect(formatMinorAsMajor(minor, locale)).toBe(expected);
  });

  it('defaults to en (dot decimal)', () => {
    expect(formatMinorAsMajor(2500)).toBe('25.00');
  });
});

describe('formatMinorAsMajor / parseMajorToMinor round-trip', () => {
  const locales = ['en', 'me', 'ru', 'tr'] as const;
  // Covers zero, positive, negative, small, large, and boundary values.
  const samples = [0, 1, 50, 99, 100, 2500, 9999, 100000, -1, -50, -2500];

  it.each(locales)('%s: parse(format(x)) === x for all samples', (locale) => {
    for (const minor of samples) {
      const formatted = formatMinorAsMajor(minor, locale);
      const parsed = parseMajorToMinor(formatted, locale);
      expect(parsed).toBe(minor);
    }
  });
});
