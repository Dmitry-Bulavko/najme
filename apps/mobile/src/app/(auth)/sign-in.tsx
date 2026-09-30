import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { SignInForm } from '@/features/auth/sign-in-form';
import { tokens } from '@najme/ui-tokens';

export default function SignInScreen(): ReactElement {
  const { t } = useTranslation('auth');

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text variant="heading">{t('signIn.title')}</Text>
        <Text variant="body" color="text03">
          {t('signIn.subtitle')}
        </Text>
      </View>
      <SignInForm />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: tokens.spacing.sm },
});
