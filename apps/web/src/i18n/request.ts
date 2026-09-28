import { catalogs } from '@najme/i18n';
import { getRequestConfig } from 'next-intl/server';

import { defaultLocale, isSupportedLocale } from './routing';

/**
 * Supplies `next-intl` with messages for the current request. Locale resolution itself happens in
 * `middleware.ts` (ADR-0004: cookie -> Accept-Language -> en) before this ever runs; by the time a
 * request reaches a `[locale]` route, the segment is already a supported locale.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isSupportedLocale(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: catalogs[locale].common,
  };
});
