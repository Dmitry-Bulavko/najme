import { z } from 'zod';

/**
 * Montenegro's 25 municipalities. Order is alphabetical by code (not display order).
 * The Prisma `City` enum lands with Business in #73; until then clients use this list.
 * Display names: i18n `common.cities.<CODE>` (en/me/ru/tr).
 */
export const CITY_CODES = [
  'ANDRIJEVICA',
  'BAR',
  'BERANE',
  'BIJELO_POLJE',
  'BUDVA',
  'CETINJE',
  'DANILOVGRAD',
  'GUSINJE',
  'HERCEG_NOVI',
  'KOLASIN',
  'KOTOR',
  'MOJKOVAC',
  'NIKSIC',
  'PETNJICA',
  'PLAV',
  'PLJEVLJA',
  'PLUZINE',
  'PODGORICA',
  'ROZAJE',
  'SAVNIK',
  'TIVAT',
  'TUZI',
  'ULCINJ',
  'ZABLJAK',
  'ZETA',
] as const;

export const citySchema = z.enum(CITY_CODES);

export type City = z.infer<typeof citySchema>;

/**
 * Featured cities for discovery UI, in display order
 * (docs/architecture/data-model.md "Cities").
 */
export const FEATURED_CITIES = [
  'PODGORICA',
  'BUDVA',
  'KOTOR',
  'BAR',
  'HERCEG_NOVI',
  'TIVAT',
  'NIKSIC',
  'ULCINJ',
] as const satisfies readonly City[];

export type FeaturedCity = (typeof FEATURED_CITIES)[number];
