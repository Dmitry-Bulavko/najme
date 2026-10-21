import { z } from 'zod';

import { localeSchema } from './locale.js';

/** Query of `GET /api/v1/categories`. */
export const listCategoriesQuerySchema = z.object({
  locale: localeSchema,
});

export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;

/** One row of `GET /api/v1/categories`. */
export const categorySchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  iconKey: z.string().nullable(),
  sortOrder: z.number().int(),
});

export type Category = z.infer<typeof categorySchema>;

export const categoriesResponseSchema = z.array(categorySchema);

export type CategoriesResponse = z.infer<typeof categoriesResponseSchema>;
