import { describe, expect, it } from 'vitest';

import { apiErrorResponseSchema, apiErrorSchema } from './error.js';

describe('apiErrorSchema', () => {
  it('accepts a minimal error', () => {
    const result = apiErrorSchema.safeParse({ code: 'SLOT_TAKEN', message: 'The slot is taken.' });

    expect(result.success).toBe(true);
  });

  it('accepts an error with details', () => {
    const result = apiErrorSchema.safeParse({
      code: 'VALIDATION_FAILED',
      message: 'Invalid input.',
      details: { field: 'email' },
    });

    expect(result.success).toBe(true);
  });

  it('rejects a lowercase code', () => {
    const result = apiErrorSchema.safeParse({ code: 'slot_taken', message: 'The slot is taken.' });

    expect(result.success).toBe(false);
  });

  it('rejects a code with spaces', () => {
    const result = apiErrorSchema.safeParse({ code: 'SLOT TAKEN', message: 'The slot is taken.' });

    expect(result.success).toBe(false);
  });

  it('rejects an empty message', () => {
    const result = apiErrorSchema.safeParse({ code: 'SLOT_TAKEN', message: '' });

    expect(result.success).toBe(false);
  });
});

describe('apiErrorResponseSchema', () => {
  it('accepts the full envelope', () => {
    const result = apiErrorResponseSchema.safeParse({
      error: { code: 'SLOT_TAKEN', message: 'The slot is taken.', details: {} },
    });

    expect(result.success).toBe(true);
  });

  it('rejects a response missing the error wrapper', () => {
    const result = apiErrorResponseSchema.safeParse({ code: 'SLOT_TAKEN', message: 'oops' });

    expect(result.success).toBe(false);
  });
});
