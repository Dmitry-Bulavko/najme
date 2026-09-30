import { tokens } from '@najme/ui-tokens';
import { Stack } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { fontFamilies } from '@/components/ui/theme';

/** Nested account stack: home + edit profile / language / change password. */
export default function AccountLayout(): ReactElement {
  const { t } = useTranslation(['account', 'common']);

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
      <Stack.Screen name="index" options={{ title: t('common:tabs.account') }} />
      <Stack.Screen name="edit-profile" options={{ title: t('account:profileSection.title') }} />
      <Stack.Screen name="language" options={{ title: t('account:languageSection.title') }} />
      <Stack.Screen
        name="change-password"
        options={{ title: t('account:passwordSection.title') }}
      />
    </Stack>
  );
}
