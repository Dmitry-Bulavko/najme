import { jest } from '@jest/globals';

// `@react-native-async-storage/async-storage`'s official Jest mock (backed by an in-memory map),
// used everywhere the app persists the locale choice (`src/i18n/index.ts`).
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Safe-area context has no native module under Jest; use its official mock (zero insets).
jest.mock(
  'react-native-safe-area-context',
  () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native-safe-area-context/jest/mock').default,
);

// SecureStore is native-only; keep an in-memory map for auth session tests.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

// Native Google module must never load in Jest / Expo Go / web export.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({ data: { idToken: 'test-id-token' } })),
  },
}));

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000/api/v1';
