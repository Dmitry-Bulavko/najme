import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogs } from '@najme/i18n';

import { SignUpForm } from './sign-up-form';
import { AuthProvider } from './session-context';
import { setAccessToken } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const replace = vi.fn();
const getParam = vi.fn(() => null);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => ({ get: getParam }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fakeUser = {
  id: 'u1',
  email: 'newuser@example.com',
  emailVerified: false,
  displayName: null,
  avatarUrl: null,
  locale: 'en' as const,
  hasPassword: true,
};

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  auth: catalogs.en.auth,
};

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AuthProvider>
        <SignUpForm />
      </AuthProvider>
    </NextIntlClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  setAccessToken(null);
  replace.mockClear();
  getParam.mockReturnValue(null);
  vi.stubGlobal('fetch', vi.fn());
  vi.mocked(fetch).mockResolvedValue(
    makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SignUpForm', () => {
  it('shows validation errors when submitting empty form', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: catalogs.en.auth.signUp.submit as string }),
    );

    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  it('shows EMAIL_TAKEN error', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'EMAIL_TAKEN', message: 'Already registered' } }, 409),
      );

    renderForm();
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText(catalogs.en.auth.signUp.emailLabel as string),
      'taken@example.com',
    );
    await user.type(
      screen.getByLabelText(catalogs.en.auth.signUp.passwordLabel as string),
      'ValidPass1!',
    );
    await user.click(
      screen.getByRole('button', { name: catalogs.en.auth.signUp.submit as string }),
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(catalogs.en.errors.EMAIL_TAKEN);
    });
  });

  it('redirects to home on successful registration', async () => {
    const fakeSession = {
      accessToken: 'tok',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      user: fakeUser,
    };

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      )
      .mockResolvedValueOnce(makeJsonResponse(fakeSession));

    renderForm();
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText(catalogs.en.auth.signUp.emailLabel as string),
      'new@example.com',
    );
    await user.type(
      screen.getByLabelText(catalogs.en.auth.signUp.passwordLabel as string),
      'ValidPass1!',
    );
    await user.click(
      screen.getByRole('button', { name: catalogs.en.auth.signUp.submit as string }),
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/en');
    });
  });
});
