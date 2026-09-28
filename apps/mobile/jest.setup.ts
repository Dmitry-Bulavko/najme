import { jest } from '@jest/globals';

// `@react-native-async-storage/async-storage`'s official Jest mock (backed by an in-memory map),
// used everywhere the app persists the locale choice (`src/i18n/index.ts`).
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
