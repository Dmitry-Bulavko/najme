import { describe, expect, it } from 'vitest';

import { currencySchema, moneySchema } from './money.js';

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
