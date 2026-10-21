import { catalogs, flattenMessages } from '@najme/i18n';
import { render } from '@testing-library/react-native';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import type { ReactElement } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import { UI_NAMESPACES } from '@/i18n';

/** Initializes a test i18next instance with the real catalogs (idempotent). */
export async function initTestI18n(lng = 'en'): Promise<void> {
  if (!i18next.isInitialized) {
    await i18next
      .use(ICU)
      .use(initReactI18next)
      .init({
        resources: Object.fromEntries(
          Object.entries(catalogs).map(([locale, localeCatalogs]) => [
            locale,
            Object.fromEntries(
              UI_NAMESPACES.map((ns) => [
                ns,
                flattenMessages(localeCatalogs[ns] as Parameters<typeof flattenMessages>[0]),
              ]),
            ),
          ]),
        ),
        lng,
        fallbackLng: 'en',
        defaultNS: 'common',
        ns: [...UI_NAMESPACES],
        interpolation: { escapeValue: false },
        returnNull: false,
      });
  } else {
    await i18next.changeLanguage(lng);
  }
}

/** Renders a tree inside the test `I18nextProvider`. */
export function renderWithI18n(ui: ReactElement) {
  return render(<I18nextProvider i18n={i18next}>{ui}</I18nextProvider>);
}
