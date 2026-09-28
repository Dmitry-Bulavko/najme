import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { tokens } from '@najme/ui-tokens';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { i18next, initI18n } from '@/i18n';

void SplashScreen.preventAutoHideAsync();

/**
 * Root layout: loads the Manrope font and resolves the initial locale (ADR-0004) before rendering
 * any route, then renders the tabs stack wrapped in `I18nextProvider` for `useTranslation()`.
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
      <Stack screenOptions={{ headerShown: false }} />
    </I18nextProvider>
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
