import type { ExpoConfig } from 'expo/config';

/**
 * Reversed iOS OAuth client ID for the Google Sign-In URL scheme
 * (`123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc`).
 * Falls back to a placeholder for development/preview builds where credentials are optional.
 * Throws for production EAS builds so a missing credential can never reach the store (#148).
 */
function iosUrlSchemeFromClientId(clientId: string | undefined): string {
  const trimmed = clientId?.trim();
  if (!trimmed) {
    const profile = process.env.EAS_BUILD_PROFILE?.trim();
    if (profile === 'production') {
      throw new Error(
        'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must be set for production EAS builds. ' +
          'Add it to the build environment or eas.json env section.',
      );
    }
    return 'com.googleusercontent.apps.placeholder';
  }
  const prefix = trimmed.replace(/\.apps\.googleusercontent\.com$/i, '');
  return `com.googleusercontent.apps.${prefix}`;
}

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
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow Najme to access your photos so you can upload a business logo or cover.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        backgroundColor: '#526ED3',
        imageWidth: 200,
      },
    ],
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme: iosUrlSchemeFromClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
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
