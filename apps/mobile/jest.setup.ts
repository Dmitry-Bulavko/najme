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
    signIn: jest.fn(async () => ({ type: 'success', data: { idToken: 'test-id-token' } })),
  },
  isCancelledResponse: (response: { type?: string }) => response.type === 'cancelled',
  isSuccessResponse: (response: { type?: string }) => response.type === 'success',
}));

// datetimepicker is native-only; provide a lightweight stub for unit tests.
jest.mock('@react-native-community/datetimepicker', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native') as typeof import('react-native');
  function MockDateTimePicker(): React.ReactElement {
    return React.createElement(View, { testID: 'mock-datetimepicker' });
  }
  return { __esModule: true, default: MockDateTimePicker };
});

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

jest.mock('expo-image-manipulator', () => {
  const SaveFormat = { JPEG: 'jpeg', PNG: 'png' };
  function createContext(uri: string) {
    const context = {
      resize: jest.fn(() => context),
      renderAsync: jest.fn(async () => ({
        saveAsync: jest.fn(async () => ({ uri, width: 800, height: 600 })),
      })),
    };
    return context;
  }
  return {
    SaveFormat,
    ImageManipulator: {
      manipulate: jest.fn((uri: string) => createContext(uri)),
    },
  };
});

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000/api/v1';
