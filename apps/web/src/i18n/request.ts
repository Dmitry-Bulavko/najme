import { catalogs } from '@najme/i18n';
import { getRequestConfig } from 'next-intl/server';

import { defaultLocale, isSupportedLocale } from './routing';

/**
 * Supplies `next-intl` with messages for the current request. Locale resolution itself happens in
 * `proxy.ts` (ADR-0004: cookie -> Accept-Language -> en) before this ever runs; by the time a
 * request reaches a `[locale]` route, the segment is already a supported locale.
 *
 * The `common` and `shell` namespaces are merged at the top level (their root keys do not overlap),
 * so components use e.g. `useTranslations('nav')` or `useTranslations('apiStatus')`.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isSupportedLocale(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: {
      // common and shell are spread at the top level; their root keys must not collide (tested).
      ...catalogs[locale].common,
      ...catalogs[locale].shell,
      // Namespaced catalogs keep their namespace key so components use useTranslations('auth') etc.
      errors: catalogs[locale].errors,
      auth: catalogs[locale].auth,
    },
  };
});
