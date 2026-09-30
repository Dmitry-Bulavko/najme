import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.WEB_BASE_URL ?? 'http://localhost:3001';

/**
 * Browser e2e for critical account flows. Not part of `pnpm test` — run with
 * `pnpm --filter @najme/web test:e2e` against a running API + web + Mailpit stack.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
