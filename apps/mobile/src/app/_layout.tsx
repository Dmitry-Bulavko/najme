import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { tokens } from '@najme/ui-tokens';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthProvider } from '@/features/auth/auth-provider';
import { BusinessModeRestorer } from '@/features/business/business-mode-restorer';
import { i18next, initI18n } from '@/i18n';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 30_000 },
  },
});

/**
 * Root layout: loads the Manrope font and resolves the initial locale (ADR-0004) before rendering
 * any route, then wraps the tree in i18n, TanStack Query and the auth session provider.
 */
export default function RootLayout() {
  // Named "Manrope" (not the package's per-weight names) so it matches
  // `tokens.typography.fontFamily` directly; per-weight variants are exposed under suffixed
  // family names for text that needs a specific weight (see `tokens.typography.fontWeight`).
  const [fontsLoaded] = useFonts({
    Manrope: Manrope_400Regular,
    'Manrope-Medium': Manrope_500Medium,
    'Manrope-Bold': Manrope_700Bold,
    'Manrope-ExtraBold': Manrope_800ExtraBold,
  });
  const [localeReady, setLocaleReady] = useState(false);

  useEffect(() => {
    void initI18n().then(() => setLocaleReady(true));
  }, []);

  const ready = fontsLoaded && localeReady;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <I18nextProvider i18n={i18next}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BusinessModeRestorer>
            <RootStack />
          </BusinessModeRestorer>
        </AuthProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

/** Tabs, auth stack and, in development builds only, the UI kit showcase. */
function RootStack() {
  const { t } = useTranslation('mobile');
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(business)" />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      {__DEV__ ? (
        <Stack.Screen
          name="ui-showcase"
          options={{
            headerShown: true,
            title: t('showcase.title'),
            headerShadowVisible: false,
            headerStyle: { backgroundColor: tokens.colors.background },
            headerTitleStyle: { fontFamily: 'Manrope-ExtraBold' },
          }}
        />
      ) : null}
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.background,
  },
});
