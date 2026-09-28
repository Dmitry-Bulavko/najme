import { z } from 'zod';

/**
 * Query params for cursor-paginated list endpoints (`?limit=20&cursor=…`), see
 * `docs/conventions/api.md`. `limit` is coerced since it arrives as a URL query-string value.
 */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Wraps an item schema into the cursor-paginated response envelope:
 * `{ items: T[], nextCursor: string | null }`.
 */
export function paginated<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().min(1).nullable(),
  });
}

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
};
