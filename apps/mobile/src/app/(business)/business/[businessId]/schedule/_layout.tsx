import { tokens } from '@najme/ui-tokens';
import { Stack } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { fontFamilies } from '@/components/ui/theme';

/** Schedule stack: picker / staff schedule editor. */
export default function BusinessScheduleLayout(): ReactElement {
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
      <Stack.Screen name="index" options={{ title: t('schedule.pickerPageTitle') }} />
      <Stack.Screen name="[staffId]" options={{ title: t('schedule.pageTitle') }} />
    </Stack>
  );
}
