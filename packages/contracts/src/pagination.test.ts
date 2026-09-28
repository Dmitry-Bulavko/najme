import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { paginated, paginationQuerySchema } from './pagination.js';

describe('paginationQuerySchema', () => {
  it('applies the default limit when omitted', () => {
    const result = paginationQuerySchema.parse({});

    expect(result).toEqual({ limit: 20 });
  });

  it('coerces a query-string limit', () => {
    const result = paginationQuerySchema.parse({ limit: '5' });

    expect(result.limit).toBe(5);
  });

  it('accepts a cursor', () => {
    const result = paginationQuerySchema.parse({ limit: '10', cursor: 'abc123' });

    expect(result).toEqual({ limit: 10, cursor: 'abc123' });
  });

  it('rejects a limit above 100', () => {
    const result = paginationQuerySchema.safeParse({ limit: '101' });

    expect(result.success).toBe(false);
  });

  it('rejects a limit below 1', () => {
    const result = paginationQuerySchema.safeParse({ limit: '0' });

    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric limit', () => {
    const result = paginationQuerySchema.safeParse({ limit: 'many' });

    expect(result.success).toBe(false);
  });
});

describe('paginated', () => {
  const itemSchema = z.object({ id: z.string() });
  const schema = paginated(itemSchema);

  it('accepts a page with items and a next cursor', () => {
    const result = schema.safeParse({ items: [{ id: '1' }], nextCursor: 'cursor-2' });

    expect(result.success).toBe(true);
  });

  it('accepts the last page with a null cursor', () => {
    const result = schema.safeParse({ items: [], nextCursor: null });

    expect(result.success).toBe(true);
  });

  it('rejects an item that does not match the item schema', () => {
    const result = schema.safeParse({ items: [{ id: 1 }], nextCursor: null });

    expect(result.success).toBe(false);
  });

  it('rejects a missing nextCursor', () => {
    const result = schema.safeParse({ items: [] });

    expect(result.success).toBe(false);
  });
});
