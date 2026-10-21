import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CategoriesService } from './categories.service.js';

describe('CategoriesService', () => {
  const findMany = vi.fn();
  let service: CategoriesService;

  beforeEach(() => {
    findMany.mockReset();
    service = new CategoriesService({ category: { findMany } } as unknown as PrismaService);
  });

  it('returns names for the requested locale sorted by sortOrder', async () => {
    findMany.mockResolvedValue([
      {
        id: '1',
        slug: 'transfer',
        iconKey: null,
        sortOrder: 10,
        translations: [
          { locale: 'me', name: 'Transfer' },
          { locale: 'en', name: 'Transfer' },
        ],
      },
      {
        id: '2',
        slug: 'hair',
        iconKey: null,
        sortOrder: 50,
        translations: [
          { locale: 'me', name: 'Frizerski' },
          { locale: 'en', name: 'Hair' },
        ],
      },
    ]);

    await expect(service.list('me')).resolves.toEqual([
      { id: '1', slug: 'transfer', name: 'Transfer', iconKey: null, sortOrder: 10 },
      { id: '2', slug: 'hair', name: 'Frizerski', iconKey: null, sortOrder: 50 },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { sortOrder: 'asc' },
        select: expect.objectContaining({
          translations: expect.objectContaining({
            where: { locale: { in: ['me', 'en'] } },
          }),
        }),
      }),
    );
  });

  it('falls back to English when the requested locale is missing', async () => {
    findMany.mockResolvedValue([
      {
        id: '1',
        slug: 'hair',
        iconKey: null,
        sortOrder: 50,
        translations: [{ locale: 'en', name: 'Hair' }],
      },
    ]);

    await expect(service.list('ru')).resolves.toEqual([
      { id: '1', slug: 'hair', name: 'Hair', iconKey: null, sortOrder: 50 },
    ]);
  });
});
