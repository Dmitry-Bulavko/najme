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
    // Comma as grouping (en): 1,234 = 1234 not 1.234
    ['1,234', 123400],
    ['1,234,567', 123456700],
    // Dot as decimal + comma grouping
    ['1,234.56', 123456],
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

  it('returns null for two decimal separators (1.234.567 in en)', () => {
    // Two dots in en = two decimal separators → ambiguous
    expect(parseMajorToMinor('1.234.567', 'en')).toBeNull();
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
    // Dot as grouping (me): 1.234 = 1234
    ['1.234', 123400],
    ['1.234.567', 123456700],
    // Dot grouping + comma decimal
    ['1.234,56', 123456],
    // Space grouping + comma decimal
    ['1 234,56', 123456],
    // Negative
    ['-10,5', -1050],
  ])('me: parses %j → %i', (raw, expected) => {
    expect(parseMajorToMinor(raw, 'me')).toBe(expected);
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
    [2500, '25.00'],
    [2550, '25.50'],
    [1, '0.01'],
    [0, '0.00'],
    [-1050, '-10.50'],
  ])('formats %i → %j', (minor, expected) => {
    expect(formatMinorAsMajor(minor)).toBe(expected);
  });
});
