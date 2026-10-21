import { Injectable } from '@nestjs/common';
import type { CategoriesResponse, ContractLocale } from '@najme/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const categoryListSelect = {
  id: true,
  slug: true,
  iconKey: true,
  sortOrder: true,
  translations: {
    select: { locale: true, name: true },
  },
} satisfies Prisma.CategorySelect;

type CategoryListRow = Prisma.CategoryGetPayload<{ select: typeof categoryListSelect }>;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(locale: ContractLocale): Promise<CategoriesResponse> {
    const rows = await this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        ...categoryListSelect,
        translations: {
          ...categoryListSelect.translations,
          // Only the requested locale and English (fallback) are needed for the response.
          where: { locale: { in: locale === 'en' ? ['en'] : [locale, 'en'] } },
        },
      },
    });

    return rows.map((row) => this.toResponse(row, locale));
  }

  private toResponse(row: CategoryListRow, locale: ContractLocale): CategoriesResponse[number] {
    const byLocale = new Map(row.translations.map((t) => [t.locale, t.name]));
    const name = byLocale.get(locale) ?? byLocale.get('en');
    if (!name) {
      // Seed guarantees an English name; a missing en row is a data bug, not a client error.
      throw new Error(`Category ${row.slug} has no English translation`);
    }
    return {
      id: row.id,
      slug: row.slug,
      name,
      iconKey: row.iconKey,
      sortOrder: row.sortOrder,
    };
  }
}
