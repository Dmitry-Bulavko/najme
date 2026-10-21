import { tokens } from '@najme/ui-tokens';
import { Stack } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { fontFamilies } from '@/components/ui/theme';

/** Services stack: list / create / edit. */
export default function BusinessServicesLayout(): ReactElement {
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
      <Stack.Screen name="index" options={{ title: t('services.pageTitle') }} />
      <Stack.Screen name="new" options={{ title: t('services.createPageTitle') }} />
      <Stack.Screen name="[serviceId]" options={{ title: t('services.editPageTitle') }} />
    </Stack>
  );
}
