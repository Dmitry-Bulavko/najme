import { tokens } from '@najme/ui-tokens';
import { Redirect, Stack } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { fontFamilies } from '@/components/ui/theme';
import { useSession } from '@/features/auth/auth-provider';

/**
 * Stack for create/pick; `[businessId]` hosts its own tab navigator.
 * Anonymous users are redirected to sign-in before any business API call.
 */
export default function BusinessGroupLayout(): ReactElement {
  const { t } = useTranslation('business');
  const session = useSession();

  if (session.state === 'anonymous') {
    return <Redirect href="/sign-in" />;
  }

  if (session.state === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.colors.background,
        }}
      >
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

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
