import path from 'node:path';

import { withBaseConfig } from '@najme/config/vitest';

export default withBaseConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
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
