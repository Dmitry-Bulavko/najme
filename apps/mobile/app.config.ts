import type { ExpoConfig } from 'expo/config';

/**
 * App config for the Najme Expo app (ADR-0003). Kept in TypeScript (rather than `app.json`) so it
 * can be extended with typed, environment-aware logic later without a second migration.
 */
const config: ExpoConfig = {
  name: 'Najme',
  slug: 'najme',
  scheme: 'najme',
  version: '0.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'me.najme.app',
    supportsTablet: true,
  },
  android: {
    package: 'me.najme.app',
    adaptiveIcon: {
      foregroundImage: './assets/images/icon.png',
      backgroundColor: '#526ED3',
    },
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        backgroundColor: '#526ED3',
        imageWidth: 200,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
  },
};

export default config;
