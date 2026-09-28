import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@najme/i18n';

/** Name of the cookie that remembers the user's explicit locale choice (ADR-0004, step 1). */
export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

/** One year, matching a long-lived explicit preference. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const locales = SUPPORTED_LOCALES;
export const defaultLocale: Locale = DEFAULT_LOCALE;

/** Type guard used by route/layout params (which arrive as unvalidated strings). */
export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
