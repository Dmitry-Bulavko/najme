import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES, catalogs, flattenMessages } from '@najme/i18n';

import { CITY_CODES, FEATURED_CITIES, citySchema } from './cities.js';

describe('CITY_CODES', () => {
  it('lists exactly the 25 Montenegro municipalities', () => {
    expect(CITY_CODES).toHaveLength(25);
    expect(new Set(CITY_CODES).size).toBe(25);
  });

  it('citySchema accepts every code and rejects unknown values', () => {
    for (const code of CITY_CODES) {
      expect(citySchema.parse(code)).toBe(code);
    }
    expect(citySchema.safeParse('UNKNOWN').success).toBe(false);
  });
});

describe('FEATURED_CITIES', () => {
  it('lists 8 cities in the documented discovery order', () => {
    expect(FEATURED_CITIES).toEqual([
      'PODGORICA',
      'BUDVA',
      'KOTOR',
      'BAR',
      'HERCEG_NOVI',
      'TIVAT',
      'NIKSIC',
      'ULCINJ',
    ]);
  });

  it('is a subset of CITY_CODES', () => {
    for (const code of FEATURED_CITIES) {
      expect(CITY_CODES).toContain(code);
    }
  });
});

describe('common.cities i18n parity', () => {
  it.each(SUPPORTED_LOCALES)('%s has common.cities.<CODE> for every CITY_CODE', (locale) => {
    const cities = catalogs[locale].common.cities;
    expect(Object.keys(cities).sort()).toEqual([...CITY_CODES].sort());
    for (const code of CITY_CODES) {
      expect(cities[code].length, `${locale}.cities.${code}`).toBeGreaterThan(0);
    }
  });

  it.each(SUPPORTED_LOCALES)('%s flat catalog includes every cities.* key', (locale) => {
    const flat = flattenMessages(catalogs[locale].common);
    for (const code of CITY_CODES) {
      expect(flat[`cities.${code}`], `${locale}: cities.${code}`).toBeTruthy();
    }
  });
});
