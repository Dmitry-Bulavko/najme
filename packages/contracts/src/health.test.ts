import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('accepts a healthy response', () => {
    const result = healthResponseSchema.safeParse({ status: 'ok', db: 'ok', version: 'abc1234' });

    expect(result.success).toBe(true);
  });

  it('accepts a degraded db status', () => {
    const result = healthResponseSchema.safeParse({
      status: 'ok',
      db: 'error',
      version: 'abc1234',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an unknown status value', () => {
    const result = healthResponseSchema.safeParse({ status: 'down', db: 'ok', version: 'abc1234' });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown db value', () => {
    const result = healthResponseSchema.safeParse({
      status: 'ok',
      db: 'degraded',
      version: 'abc1234',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a missing version', () => {
    const result = healthResponseSchema.safeParse({ status: 'ok', db: 'ok' });

    expect(result.success).toBe(false);
  });
});
