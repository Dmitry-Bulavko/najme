import { tokens } from '@najme/ui-tokens';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { SignUpForm } from '@/features/auth/sign-up-form';

export default function SignUpScreen(): ReactElement {
  const { t } = useTranslation('auth');

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text variant="heading">{t('signUp.title')}</Text>
        <Text variant="body" color="text03">
          {t('signUp.subtitle')}
        </Text>
      </View>
      <SignUpForm />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: tokens.spacing.sm },
});
