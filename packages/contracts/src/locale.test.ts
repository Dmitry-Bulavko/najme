import { SUPPORTED_LOCALES, catalogs, flattenMessages } from '@najme/i18n';
import { describe, expect, it } from 'vitest';

import { ERROR_CODES } from './error.js';
import { localeSchema } from './locale.js';

describe('localeSchema', () => {
  it('matches SUPPORTED_LOCALES from @najme/i18n', () => {
    expect([...localeSchema.options].sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });
});

describe('error code translations', () => {
  it.each(SUPPORTED_LOCALES)('%s has an errors.<CODE> message for every error code', (locale) => {
    const flat = flattenMessages(catalogs[locale].errors);
    for (const code of ERROR_CODES) {
      expect(flat[code], `${locale}: errors.${code}`).toBeTruthy();
    }
    expect(Object.keys(flat).sort()).toEqual([...ERROR_CODES].sort());
  });
});
