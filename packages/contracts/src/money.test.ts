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

describe('parseMajorToMinor', () => {
  it.each([
    ['25', 2500],
    ['25.5', 2550],
    ['25,5', 2550],
    ['25.50', 2550],
    ['25,99', 2599],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['0.005', 1],
    ['0,004', 0],
    ['-10.5', -1050],
    ['  12,3  ', 1230],
  ])('parses %j → %i', (raw, expected) => {
    expect(parseMajorToMinor(raw)).toBe(expected);
  });

  it('returns null for empty or non-numeric input', () => {
    expect(parseMajorToMinor('')).toBeNull();
    expect(parseMajorToMinor('   ')).toBeNull();
    expect(parseMajorToMinor('abc')).toBeNull();
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
