import { LOCALE_META, SUPPORTED_LOCALES, type Locale } from '@najme/i18n';
import { tokens } from '@najme/ui-tokens';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { setLocale } from '@/i18n';

/**
 * Lets the user pick a locale, persisting the explicit choice on device (ADR-0004 step 1) so it
 * applies again on the next launch. Uses plain `Pressable`s (no shared UI components between web
 * and mobile, per ADR-0003) with native locale labels from `LOCALE_META`.
 */
export function LanguageSwitcher(): ReactElement {
  const { t, i18n } = useTranslation();
  const activeLocale = i18n.language as Locale;

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('languageSwitcher.label')}>
      <Text style={styles.label}>{t('languageSwitcher.label')}</Text>
      <View style={styles.row}>
        {SUPPORTED_LOCALES.map((locale) => {
          const active = locale === activeLocale;
          return (
            <Pressable
              key={locale}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => {
                void setLocale(locale);
              }}
              style={[styles.option, active && styles.optionActive]}
            >
              <Text style={[styles.optionText, active && styles.optionTextActive]}>
                {LOCALE_META[locale].label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: tokens.typography.scale.body.fontSize,
    color: tokens.colors.text02,
    marginBottom: tokens.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  option: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.base01,
  },
  optionActive: {
    backgroundColor: tokens.colors.primary,
  },
  optionText: {
    fontFamily: tokens.typography.fontFamily,
    color: tokens.colors.text01,
  },
  optionTextActive: {
    color: tokens.colors.primaryForeground,
  },
});
