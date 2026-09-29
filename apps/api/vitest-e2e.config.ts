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
    env: {
      // Throwaway signing key for tests only.
      JWT_ACCESS_SECRET:
        process.env.JWT_ACCESS_SECRET ?? 'test-only-access-secret-0123456789abcdef',
      // Mailpit (SMTP 1025, UI/API 8025) in dev and CI; see docs/runbooks/local-dev.md.
      SMTP_HOST: process.env.SMTP_HOST ?? 'localhost',
      SMTP_PORT: process.env.SMTP_PORT ?? '1025',
      MAIL_FROM: process.env.MAIL_FROM ?? 'Najme <no-reply@najme.test>',
      APP_WEB_URL: process.env.APP_WEB_URL ?? 'http://localhost:3001',
    },
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
