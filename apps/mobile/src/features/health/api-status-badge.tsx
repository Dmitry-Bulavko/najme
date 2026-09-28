import { tokens } from '@najme/ui-tokens';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useApiStatus } from '@/features/health/use-api-status';

/** Localized API health badge, shown on the Account tab (issue #15). */
export function ApiStatusBadge(): ReactElement {
  const { t } = useTranslation();
  const status = useApiStatus();

  const statusText =
    status === 'checking'
      ? t('states.loading')
      : status === 'online'
        ? t('apiStatus.online')
        : t('apiStatus.unavailable');

  return (
    <View accessibilityRole="text" style={styles.container}>
      <Text style={styles.label}>{t('apiStatus.label')}</Text>
      <Text style={styles.value}>{statusText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.sm,
  },
  label: {
    fontFamily: tokens.typography.fontFamily,
    color: tokens.colors.text02,
  },
  value: {
    fontFamily: tokens.typography.fontFamily,
    color: tokens.colors.text01,
    fontWeight: tokens.typography.fontWeight.bold,
  },
});
