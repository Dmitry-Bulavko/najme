import { tokens } from '@najme/ui-tokens';
import { Stack } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { fontFamilies } from '@/components/ui/theme';

/** Stack for create/pick; `[businessId]` hosts its own tab navigator. */
export default function BusinessGroupLayout(): ReactElement {
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
      <Stack.Screen name="new" options={{ title: t('create.pageTitle') }} />
      <Stack.Screen name="pick" options={{ title: t('list.pageTitle') }} />
      <Stack.Screen name="[businessId]" options={{ headerShown: false }} />
    </Stack>
  );
}
