import { withBaseConfig } from '@najme/config/vitest';
import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * End-to-end tests: boot the real Nest app and hit it with supertest against the Postgres
 * instance at `DATABASE_URL` (see docs/conventions/testing.md).
 */
export default withBaseConfig({
  plugins: [tsconfigPaths(), swc.vite()],
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
