import { tokens } from '@najme/ui-tokens';
import { Stack } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { fontFamilies } from '@/components/ui/theme';

/** Staff stack: list / create / edit. */
export default function BusinessStaffLayout(): ReactElement {
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
      <Stack.Screen name="index" options={{ title: t('staff.pageTitle') }} />
      <Stack.Screen name="new" options={{ title: t('staff.createPageTitle') }} />
      <Stack.Screen name="[staffId]" options={{ title: t('staff.editPageTitle') }} />
    </Stack>
  );
}
