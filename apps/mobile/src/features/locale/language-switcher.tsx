import { LOCALE_META, SUPPORTED_LOCALES, type Locale } from '@najme/i18n';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ListGroup, ListItem } from '@/components/ui';
import { setLocale } from '@/i18n';

/**
 * Lets the user pick a locale, persisting the explicit choice on device (ADR-0004 step 1) so it
 * applies again on the next launch. Rendered as a `ListItem` radio group with native locale
 * labels from `LOCALE_META`.
 */
export function LanguageSwitcher(): ReactElement {
  const { t, i18n } = useTranslation();
  const activeLocale = i18n.language as Locale;

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('languageSwitcher.label')}>
      <ListGroup>
        {SUPPORTED_LOCALES.map((locale) => (
          <ListItem
            key={locale}
            accessibilityRole="radio"
            title={LOCALE_META[locale].label}
            selected={locale === activeLocale}
            onPress={() => {
              void setLocale(locale);
            }}
          />
        ))}
      </ListGroup>
    </View>
  );
}
