import { withBaseConfig } from '@najme/config/vitest';
import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Unit tests for `src/**`. NestJS decorators need SWC to emit decorator metadata for Vitest
 * (which does not run through `tsc`), see https://docs.nestjs.com/recipes/swc#vitest.
 */
export default withBaseConfig({
  plugins: [tsconfigPaths(), swc.vite()],
  test: {
    include: ['src/**/*.spec.ts'],
  },
});
