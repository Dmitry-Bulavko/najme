import path from 'node:path';

import { withBaseConfig } from '@najme/config/vitest';

export default withBaseConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright specs live under e2e/ as *.spec.ts; keep them out of Vitest.
    exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**', '**/.next/**'],
    // CI runs lint/typecheck/test/build in parallel; jsdom service-form tests that finish
    // under 2s locally can exceed Vitest's 5s default on the GitHub runner (same idea as
    // apps/mobile jest.testTimeout: 20000). Prefer this package budget over per-test overrides.
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // apps/web's tsconfig.json sets `jsx: "preserve"` (required by Next's own compiler). Vite 8
  // transforms TS/TSX with oxc by default and picks up that tsconfig setting, leaving JSX
  // untransformed; fall back to esbuild (told to transform JSX itself) for the test build.
  oxc: false,
  esbuild: {
    jsx: 'automatic',
  },
});
