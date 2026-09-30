import { tokens } from '@najme/ui-tokens';
import { Stack } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { fontFamilies } from '@/components/ui/theme';

/** Auth stack: sign-in, sign-up, forgot password with localized native headers. */
export default function AuthLayout(): ReactElement {
  const { t } = useTranslation('auth');

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.colors.background },
        headerShadowVisible: false,
        headerTintColor: tokens.colors.text01,
        headerTitleStyle: { fontFamily: fontFamilies.extrabold, color: tokens.colors.text01 },
        contentStyle: { backgroundColor: tokens.colors.background },
      }}
    >
      <Stack.Screen name="sign-in" options={{ title: t('signIn.title') }} />
      <Stack.Screen name="sign-up" options={{ title: t('signUp.title') }} />
      <Stack.Screen name="forgot-password" options={{ title: t('forgotPassword.title') }} />
    </Stack>
  );
}
