import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogs } from '@najme/i18n';

import { ResetPasswordForm } from './reset-password-form';
import { setAccessToken } from '@/lib/api/client';

const replace = vi.fn();
const getParam = vi.fn<() => string | null>(() => 'reset-token');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => ({ get: getParam }),
}));

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
      <ResetPasswordForm />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  setAccessToken(null);
  replace.mockClear();
  getParam.mockReturnValue('reset-token');
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ResetPasswordForm', () => {
  it('shows missing-token message when the query has no token', () => {
    getParam.mockReturnValue(null);
    renderForm();
    expect(screen.getByRole('alert')).toHaveTextContent(
      catalogs.en.auth.passwordReset.missingToken,
    );
  });

  it('shows validation error for a short password', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(catalogs.en.auth.passwordReset.passwordLabel), 'short');
    await user.click(screen.getByRole('button', { name: catalogs.en.auth.passwordReset.submit }));

    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  it('redirects to sign-in on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    renderForm();
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText(catalogs.en.auth.passwordReset.passwordLabel),
      'ValidPass1!',
    );
    await user.click(screen.getByRole('button', { name: catalogs.en.auth.passwordReset.submit }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/en/sign-in');
    });
  });

  it('shows TOKEN_EXPIRED from the API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({ error: { code: 'TOKEN_EXPIRED', message: 'gone' } }, 400),
    );

    renderForm();
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText(catalogs.en.auth.passwordReset.passwordLabel),
      'ValidPass1!',
    );
    await user.click(screen.getByRole('button', { name: catalogs.en.auth.passwordReset.submit }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(catalogs.en.errors.TOKEN_EXPIRED);
    });
  });
});
