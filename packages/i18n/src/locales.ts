/**
 * Locales supported by the product UI. See ADR-0004 for the decision and the resolution rules.
 */
export const SUPPORTED_LOCALES = ['en', 'me', 'ru', 'tr'] as const;

/** A supported UI locale code. `me` covers Montenegrin/Serbian written in Latin script. */
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Default and fallback locale when nothing else can be resolved. */
export const DEFAULT_LOCALE: Locale = 'en';

/** Metadata for a supported locale. */
export interface LocaleMeta {
  /** Label shown in the language picker, written in the locale's own script. */
  readonly label: string;
  /** BCP-47 tag to pass to `Intl` APIs (date/number/plural formatting). */
  readonly bcp47: string;
}

/** Per-locale display metadata, keyed by {@link Locale}. */
export const LOCALE_META: Readonly<Record<Locale, LocaleMeta>> = {
  en: { label: 'English', bcp47: 'en' },
  me: { label: 'Crnogorski / Srpski', bcp47: 'sr-Latn-ME' },
  ru: { label: 'Русский', bcp47: 'ru' },
  tr: { label: 'Türkçe', bcp47: 'tr' },
};

/** Type guard: is `value` one of {@link SUPPORTED_LOCALES}. */
export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Returns the BCP-47 tag to use with `Intl` APIs for a given locale. */
export function toIntlLocale(locale: Locale): string {
  return LOCALE_META[locale].bcp47;
}
