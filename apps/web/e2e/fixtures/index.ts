import { randomUUID } from 'node:crypto';

import { test as base, expect, type Page } from '@playwright/test';

import { MailpitClient } from './mailpit';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

const DEFAULT_PASSWORD = 'correct horse battery';

type RegisterViaApiOptions = {
  email?: string;
  password?: string;
  locale?: string;
};

type AccountFixtures = {
  /** Unique email for this test (not registered until a helper creates the user). */
  uniqueEmail: string;
  mailpit: MailpitClient;
  /** Creates a user through the API (reusable for later specs that skip the UI sign-up path). */
  registerViaApi: (options?: RegisterViaApiOptions) => Promise<{
    email: string;
    password: string;
  }>;
  /** Fills the sign-in form and waits until the session is established. */
  signInViaUi: (page: Page, email: string, password: string) => Promise<void>;
};

export const test = base.extend<AccountFixtures>({
  uniqueEmail: async ({}, use) => {
    await use(`e2e-${randomUUID()}@example.com`);
  },

  mailpit: async ({}, use) => {
    await use(new MailpitClient(MAILPIT_URL));
  },

  registerViaApi: async ({ uniqueEmail }, use) => {
    await use(async (options = {}) => {
      const email = options.email ?? uniqueEmail;
      const password = options.password ?? DEFAULT_PASSWORD;
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Spread load across throttle buckets when several specs register in one run.
          'X-Forwarded-For': `10.57.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
        },
        body: JSON.stringify({
          email,
          password,
          ...(options.locale ? { locale: options.locale } : {}),
        }),
      });
      if (!res.ok) {
        throw new Error(`registerViaApi failed: ${res.status} ${await res.text()}`);
      }
      return { email, password };
    });
  },

  signInViaUi: async ({}, use) => {
    await use(async (page, email, password) => {
      await page.goto('/en/sign-in');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
    });
  },
});

export { expect, DEFAULT_PASSWORD };
