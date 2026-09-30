/**
 * Detects whether the native Google Sign-In module can run in this runtime.
 *
 * The module needs a development / production build. Expo Go and the web export must not load it
 * (require would throw or crash); callers hide the button instead.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function googleEnvConfigured(): boolean {
  const ios = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? '';
  const web = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
  return Boolean(ios && web);
}

export function isGoogleNativeAvailable(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  // Expo Go cannot host this native module (R6 / issue #55).
  if (Constants.appOwnership === 'expo') {
    return false;
  }
  try {
    // Lazy require so Metro / web export never evaluates the native entry at module load.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@react-native-google-signin/google-signin');
    return true;
  } catch {
    return false;
  }
}

export function canOfferGoogleSignIn(): boolean {
  return googleEnvConfigured() && isGoogleNativeAvailable();
}
