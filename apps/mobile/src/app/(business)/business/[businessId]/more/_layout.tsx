import { tokens } from '@najme/ui-tokens';
import { Stack } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { fontFamilies } from '@/components/ui/theme';

/** More stack: home (client mode / profile / settings) + nested screens. */
export default function BusinessMoreLayout(): ReactElement {
  const { t } = useTranslation('business');

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
      <Stack.Screen name="index" options={{ title: t('shell.more') }} />
      <Stack.Screen name="profile" options={{ title: t('profile.pageTitle') }} />
      <Stack.Screen name="settings" options={{ title: t('settings.pageTitle') }} />
    </Stack>
  );
}
