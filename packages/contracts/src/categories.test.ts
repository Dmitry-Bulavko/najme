import { describe, expect, it } from 'vitest';

import {
  categoriesResponseSchema,
  categorySchema,
  listCategoriesQuerySchema,
} from './categories.js';

describe('listCategoriesQuerySchema', () => {
  it('accepts every supported locale', () => {
    for (const locale of ['en', 'me', 'ru', 'tr'] as const) {
      expect(listCategoriesQuerySchema.parse({ locale })).toEqual({ locale });
    }
  });

  it('rejects missing or invalid locale', () => {
    expect(listCategoriesQuerySchema.safeParse({}).success).toBe(false);
    expect(listCategoriesQuerySchema.safeParse({ locale: 'fr' }).success).toBe(false);
  });
});

describe('categorySchema', () => {
  const sample = {
    id: '01932f3e-8b1a-7c4d-9e2f-1a2b3c4d5e6f',
    slug: 'hair',
    name: 'Hair',
    iconKey: null,
    sortOrder: 50,
  };

  it('parses a category row', () => {
    expect(categorySchema.parse(sample)).toEqual(sample);
  });

  it('parses a list response', () => {
    expect(categoriesResponseSchema.parse([sample])).toEqual([sample]);
  });
});
