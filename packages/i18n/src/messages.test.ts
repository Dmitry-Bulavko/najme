import { parse } from '@formatjs/icu-messageformat-parser';
import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from './locales.js';
import { catalogs, flattenMessages } from './messages.js';

describe.each([
  'account',
  'admin',
  'auth',
  'common',
  'errors',
  'shell',
  'mobile',
  'emails',
] as const)('%s catalog', (ns) => {
  const enKeys = Object.keys(flattenMessages(catalogs.en[ns])).sort();

  it('en catalog is not empty', () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  it.each(SUPPORTED_LOCALES)('%s has exactly the keys of en (key parity)', (locale) => {
    const keys = Object.keys(flattenMessages(catalogs[locale][ns])).sort();
    expect(keys).toEqual(enKeys);
  });

  it.each(SUPPORTED_LOCALES)('every %s message is valid ICU syntax', (locale) => {
    const flat = flattenMessages(catalogs[locale][ns]);
    for (const [key, message] of Object.entries(flat)) {
      expect(() => parse(message), `${locale}.${key}: "${message}"`).not.toThrow();
    }
  });
});

describe('plurals', () => {
  it("me and ru plural messages use CLDR's one/few/other (+many for ru)", () => {
    const mePlural = catalogs.me.common.bookingsCount;
    expect(mePlural).toContain('one {');
    expect(mePlural).toContain('few {');
    expect(mePlural).toContain('other {');

    const ruPlural = catalogs.ru.common.bookingsCount;
    expect(ruPlural).toContain('one {');
    expect(ruPlural).toContain('few {');
    expect(ruPlural).toContain('many {');
    expect(ruPlural).toContain('other {');
  });
});
