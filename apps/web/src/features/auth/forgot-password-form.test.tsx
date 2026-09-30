import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogs } from '@najme/i18n';

import { ForgotPasswordForm } from './forgot-password-form';
import { setAccessToken } from '@/lib/api/client';

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  auth: catalogs.en.auth,
};

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ForgotPasswordForm />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  setAccessToken(null);
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ForgotPasswordForm', () => {
  it('shows validation error for empty email', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: catalogs.en.auth.forgotPassword.submit }));

    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  it('shows the sent confirmation after a successful request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 202 }));

    renderForm();
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText(catalogs.en.auth.forgotPassword.emailLabel),
      'alice@example.com',
    );
    await user.click(screen.getByRole('button', { name: catalogs.en.auth.forgotPassword.submit }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        catalogs.en.auth.forgotPassword.sentTitle,
      );
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/auth/forgot-password',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows RATE_LIMITED from the API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({ error: { code: 'RATE_LIMITED', message: 'slow' } }, 429),
    );

    renderForm();
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText(catalogs.en.auth.forgotPassword.emailLabel),
      'alice@example.com',
    );
    await user.click(screen.getByRole('button', { name: catalogs.en.auth.forgotPassword.submit }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(catalogs.en.errors.RATE_LIMITED);
    });
  });
});
