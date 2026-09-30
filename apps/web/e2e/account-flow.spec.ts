import { DEFAULT_PASSWORD, expect, test } from './fixtures';

const NEW_PASSWORD = 'another staple horse';
const INVALID_CREDENTIALS = 'Incorrect email or password.';

test.describe('Account flow', () => {
  test('sign up, verify email, sign in, switch language to ru', async ({
    page,
    uniqueEmail,
    mailpit,
  }) => {
    await page.goto('/en/sign-up');
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Password', { exact: true }).fill(DEFAULT_PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();

    const verifyUrl = await mailpit.waitForLink(uniqueEmail, 'verify-email');
    await page.goto(verifyUrl);
    await expect(page.getByTestId('verify-email-success')).toBeVisible({ timeout: 30_000 });

    await page.goto('/en/account');
    await expect(page.getByText('Verified', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

    await page.goto('/en/sign-in');
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Password', { exact: true }).fill(DEFAULT_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();

    await page.goto('/en/account');
    await page.getByLabel('Account language').selectOption('ru');
    await page.getByRole('button', { name: 'Save language' }).click();
    await expect(page).toHaveURL(/\/ru\/account/);
    await expect(page.getByRole('heading', { name: 'Аккаунт' })).toBeVisible();
  });

  test('forgot password reset via Mailpit; new password works, old fails', async ({
    page,
    mailpit,
    registerViaApi,
    signInViaUi,
  }) => {
    const { email, password } = await registerViaApi();
    // Drain the async verify-email before requesting a reset so inbox state is stable.
    await mailpit.waitForLink(email, 'verify-email');
    await mailpit.deleteFor(email);

    await page.goto('/en/forgot-password');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('status')).toContainText('Check your email');

    const resetUrl = await mailpit.waitForLink(email, 'reset-password');
    await page.goto(resetUrl);
    await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel('Confirm password').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page).toHaveURL(/\/en\/sign-in/);

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert').filter({ hasText: INVALID_CREDENTIALS })).toBeVisible();

    await signInViaUi(page, email, NEW_PASSWORD);
  });

  test('wrong password shows localized INVALID_CREDENTIALS', async ({ page, registerViaApi }) => {
    const { email } = await registerViaApi();

    await page.goto('/en/sign-in');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('definitely-wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert').filter({ hasText: INVALID_CREDENTIALS })).toBeVisible();
  });

  test('rejects external ?next= after sign-in (stays on app origin)', async ({
    page,
    registerViaApi,
  }) => {
    const { email, password } = await registerViaApi();

    await page.goto('/en/sign-in?next=https://example.org/');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
    await expect(page).toHaveURL(/\/en\/?$/);
    expect(new URL(page.url()).origin).not.toBe('https://example.org');
    expect(page.url()).not.toContain('example.org');
  });
});
