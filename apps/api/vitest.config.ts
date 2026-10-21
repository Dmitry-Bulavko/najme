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
    env: {
      // Match CI / production containers so DST tests cannot pass by accident on a CET laptop.
      TZ: 'UTC',
      JWT_ACCESS_SECRET:
        process.env.JWT_ACCESS_SECRET ?? 'test-only-access-secret-0123456789abcdef',
      // Mailpit (SMTP 1025, UI/API 8025) in dev and CI; see docs/runbooks/local-dev.md.
      SMTP_HOST: process.env.SMTP_HOST ?? 'localhost',
      SMTP_PORT: process.env.SMTP_PORT ?? '1025',
      MAIL_FROM: process.env.MAIL_FROM ?? 'Najme <no-reply@najme.test>',
      APP_WEB_URL: process.env.APP_WEB_URL ?? 'http://localhost:3001',
      STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT ?? 'http://localhost:9000',
      STORAGE_REGION: process.env.STORAGE_REGION ?? 'us-east-1',
      STORAGE_BUCKET: process.env.STORAGE_BUCKET ?? 'najme',
      STORAGE_ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID ?? 'minioadmin',
      STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY ?? 'minioadmin',
      STORAGE_PUBLIC_BASE_URL: process.env.STORAGE_PUBLIC_BASE_URL ?? 'http://localhost:9000/najme',
      STORAGE_FORCE_PATH_STYLE: process.env.STORAGE_FORCE_PATH_STYLE ?? 'true',
    },
  },
});
