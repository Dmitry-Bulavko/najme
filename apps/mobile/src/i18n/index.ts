import AsyncStorage from '@react-native-async-storage/async-storage';
import { catalogs, DEFAULT_LOCALE, flattenMessages, isLocale, resolveLocale } from '@najme/i18n';
import type { Locale } from '@najme/i18n';
import * as Localization from 'expo-localization';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';

/** AsyncStorage key for the explicit locale choice (ADR-0004 resolution step 1). */
export const LOCALE_STORAGE_KEY = 'najme.locale';

const resources = Object.fromEntries(
  Object.entries(catalogs).map(([locale, { common, mobile }]) => [
    locale,
    { common: flattenMessages(common), mobile: flattenMessages(mobile) },
  ]),
);

/**
 * Device locale preferences, most preferred first, as BCP-47-ish tags `resolveLocale` understands
 * (`expo-localization` already orders them by user/device preference).
 */
function deviceLocaleCandidates(): string[] {
  return Localization.getLocales().map((entry) => entry.languageTag);
}

/**
 * Initializes i18next once for the app lifetime. Resolution order follows ADR-0004: an explicit
 * choice persisted on device (read asynchronously from `AsyncStorage`) wins outright if it is a
 * valid {@link Locale} (checked directly with `isLocale`, since a stored internal code like `me`
 * is not itself a BCP-47 primary subtag — see #34); otherwise device languages are resolved via
 * `@najme/i18n`'s `resolveLocale`, falling back to `en`. `i18next-icu` is registered as the
 * formatting engine so catalog values keep the same ICU MessageFormat syntax (plurals, selects)
 * used by `@najme/i18n` and the API, instead of i18next's own `{{var}}`/`count`-suffixed-key
 * interpolation.
 */
export async function initI18n(): Promise<Locale> {
  const storedLocale = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
  const locale =
    storedLocale && isLocale(storedLocale) ? storedLocale : resolveLocale(deviceLocaleCandidates());

  if (!i18next.isInitialized) {
    await i18next
      .use(ICU)
      .use(initReactI18next)
      .init({
        resources,
        lng: locale,
        fallbackLng: DEFAULT_LOCALE,
        defaultNS: 'common',
        ns: ['common', 'mobile'],
        interpolation: { escapeValue: false },
        returnNull: false,
      });
  } else {
    await i18next.changeLanguage(locale);
  }

  return locale;
}

/** Changes the active locale and persists the explicit choice for the next launch. */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) {
    return;
  }
  await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
  await i18next.changeLanguage(locale);
}

export { i18next };
