import { randomUUID } from 'node:crypto';

import type { Page } from '@playwright/test';

import { DEFAULT_PASSWORD, expect, test } from './fixtures';

/** Seeded platform admin from `pnpm --filter @najme/api db:seed` (#88). */
const SEED_ADMIN_EMAIL = 'admin@najme.dev';
const SEED_ADMIN_PASSWORD = 'najme-dev-password';

const BUSINESS_NAME = `M2 Exit ${randomUUID().slice(0, 8)}`;
const STAFF_A = 'Alex';
const STAFF_B = 'Sam';
const SERVICES = [
  { name: 'Haircut', price: '25', withCustomField: false },
  { name: 'Color', price: '55', withCustomField: false },
  { name: 'Consultation', price: '10', withCustomField: true },
] as const;

test.describe('M2 exit flow', () => {
  test('owner setup, staff invite, admin approval', async ({
    page,
    browser,
    uniqueEmail,
    mailpit,
    signInViaUi,
  }) => {
    test.setTimeout(240_000);

    const ownerEmail = uniqueEmail;
    const inviteeEmail = `e2e-staff-${randomUUID()}@example.com`;

    // --- 1. Owner signs up and creates business + staff + services + hours ---
    await page.goto('/en/sign-up');
    await page.getByLabel('Email').fill(ownerEmail);
    await page.getByLabel('Password', { exact: true }).fill(DEFAULT_PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();

    const verifyUrl = await mailpit.waitForLink(ownerEmail, 'verify-email');
    await page.goto(verifyUrl);
    await expect(page.getByTestId('verify-email-success')).toBeVisible({ timeout: 30_000 });

    await page.goto('/en/business/new');
    await page.getByLabel('Business name').fill(BUSINESS_NAME);
    await page.getByLabel('Category').click();
    await page.getByRole('option', { name: 'Hair' }).click();
    await page.getByLabel('City').click();
    await page.getByRole('option', { name: 'Podgorica' }).click();
    await page.getByRole('button', { name: 'Create business' }).click();
    await expect(page).toHaveURL(/\/en\/business\/[0-9a-f-]+\/?$/);
    await expect(page.getByText('Waiting for approval')).toBeVisible();

    const businessUrl = page.url();
    const businessId = businessUrl.match(/\/business\/([0-9a-f-]+)/)?.[1];
    if (!businessId) {
      throw new Error(`Could not parse business id from ${businessUrl}`);
    }

    await createStaffMember(page, businessId, STAFF_A);
    await createStaffMember(page, businessId, STAFF_B);

    for (const service of SERVICES) {
      await createService(page, businessId, service);
    }

    await setWeekdayHours(page, businessId, STAFF_A);
    await setWeekdayHours(page, businessId, STAFF_B);

    // --- 2. Invite staff; accept in a second browser context ---
    await page.goto(`/en/business/${businessId}/team`);
    await page.getByRole('button', { name: 'Invite' }).click();
    const inviteDialog = page.getByRole('dialog');
    await expect(inviteDialog.getByRole('heading', { name: 'Invite a teammate' })).toBeVisible();
    await inviteDialog.getByLabel('Email').fill(inviteeEmail);
    await inviteDialog.getByLabel('Role').click();
    await page.getByRole('option', { name: 'Staff' }).click();
    await inviteDialog.getByLabel('Staff member').click();
    await page.getByRole('option', { name: STAFF_A }).click();
    await inviteDialog.getByRole('button', { name: 'Send invitation' }).click();
    await expect(page.getByText(inviteeEmail)).toBeVisible({ timeout: 15_000 });

    const inviteUrl = await mailpit.waitForLink(inviteeEmail, 'invitations/accept');

    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    try {
      await staffPage.goto(inviteUrl);
      await expect(staffPage.getByTestId('invite-accept-preview')).toBeVisible({
        timeout: 30_000,
      });
      await staffPage.getByRole('link', { name: 'Create an account' }).click();
      await staffPage.getByLabel('Email').fill(inviteeEmail);
      await staffPage.getByLabel('Password', { exact: true }).fill(DEFAULT_PASSWORD);
      await staffPage.getByRole('button', { name: 'Create account' }).click();
      await expect(staffPage.getByRole('button', { name: 'Account menu' })).toBeVisible();

      // Return to accept (next= may already land here; otherwise reopen the invite link).
      if (!staffPage.url().includes('/invitations/accept')) {
        await staffPage.goto(inviteUrl);
      }
      await expect(staffPage.getByTestId('invite-accept-preview')).toBeVisible({
        timeout: 30_000,
      });
      await staffPage.getByRole('button', { name: 'Accept invitation' }).click();
      await expect(staffPage).toHaveURL(new RegExp(`/en/business/${businessId}`), {
        timeout: 30_000,
      });

      // STAFF nav: "My hours" (shell.mySchedule); Team / Settings stay owner-only.
      const businessNav = staffPage.getByRole('navigation', { name: 'Business' });
      await expect(businessNav.getByRole('link', { name: 'My hours' })).toBeVisible();
      await expect(businessNav.getByRole('link', { name: 'Team' })).toHaveCount(0);
      await expect(businessNav.getByRole('link', { name: 'Settings' })).toHaveCount(0);
      await businessNav.getByRole('link', { name: 'My hours' }).click();
      await expect(staffPage).toHaveURL(
        new RegExp(`/en/business/${businessId}/staff/[0-9a-f-]+/schedule`),
      );
      await expect(staffPage.getByRole('heading', { name: 'Working hours' })).toBeVisible();
    } finally {
      await staffContext.close();
    }

    // --- 3. Seeded admin approves; owner sees APPROVED banner ---
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await signInViaUi(adminPage, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD);
      await adminPage.goto('/en/admin/businesses');
      await expect(adminPage.getByRole('heading', { name: 'Businesses' })).toBeVisible();
      await adminPage.getByRole('button', { name: BUSINESS_NAME }).click();
      await adminPage.getByRole('button', { name: 'Approve' }).click();
      await expect(adminPage.getByText('Business approved.')).toBeVisible({ timeout: 15_000 });
    } finally {
      await adminContext.close();
    }

    await page.goto(`/en/business/${businessId}`);
    await expect(page.getByText('Public', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Your business is live and clients can book.')).toBeVisible();
  });
});

async function createStaffMember(page: Page, businessId: string, name: string): Promise<void> {
  await page.goto(`/en/business/${businessId}/staff/new`);
  await page.getByLabel('Display name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

async function createService(
  page: Page,
  businessId: string,
  service: { name: string; price: string; withCustomField: boolean },
): Promise<void> {
  await page.goto(`/en/business/${businessId}/services/new`);
  await page.getByLabel('Service name').fill(service.name);
  await page.getByLabel('Price').fill(service.price);
  await page.getByLabel(STAFF_A, { exact: true }).check();
  await page.getByLabel(STAFF_B, { exact: true }).check();

  if (service.withCustomField) {
    await page.getByRole('button', { name: 'Add field' }).click();
    await page.getByLabel('Label', { exact: true }).fill('Client notes');
  }

  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(service.name, { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
}

async function setWeekdayHours(page: Page, businessId: string, staffName: string): Promise<void> {
  await page.goto(`/en/business/${businessId}/schedule`);
  await page
    .getByRole('listitem')
    .filter({ hasText: staffName })
    .getByRole('link', { name: 'Open schedule' })
    .click();
  await expect(page.getByText('Working hours')).toBeVisible();

  const monday = page.locator('[data-weekday="MONDAY"]');
  // Default draft is Closed; turn Monday open (switch checked = closed).
  await monday.getByLabel('Closed').click();
  await monday.getByLabel('Monday, interval 1, start').fill('09:00');
  await monday.getByLabel('Monday, interval 1, end').fill('13:00');
  await monday.getByRole('button', { name: 'Add interval' }).click();
  await monday.getByLabel('Monday, interval 2, start').fill('14:00');
  await monday.getByLabel('Monday, interval 2, end').fill('18:00');

  await monday.getByRole('button', { name: 'Copy to…' }).click();
  for (const day of ['Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
    await page.getByRole('checkbox', { name: day }).check();
  }
  await page.getByRole('button', { name: 'Copy' }).click();
  await page.getByRole('button', { name: 'Save hours' }).click();
  await expect(page.getByText('Working hours saved.')).toBeVisible({ timeout: 15_000 });
}
