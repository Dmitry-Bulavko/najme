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
});
