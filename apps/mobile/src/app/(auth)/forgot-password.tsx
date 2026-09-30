import { tokens } from '@najme/ui-tokens';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';

export default function ForgotPasswordScreen(): ReactElement {
  const { t } = useTranslation('auth');

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text variant="heading">{t('forgotPassword.title')}</Text>
        <Text variant="body" color="text03">
          {t('forgotPassword.subtitle')}
        </Text>
      </View>
      <ForgotPasswordForm />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: tokens.spacing.sm },
});
