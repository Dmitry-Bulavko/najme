import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogs } from '@najme/i18n';

import { SignInForm } from './sign-in-form';
import { AuthProvider } from './session-context';
import { setAccessToken } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const replace = vi.fn();
const getParam = vi.fn<() => string | null>(() => null);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => ({ get: getParam }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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
  email: 'alice@example.com',
  emailVerified: true,
  displayName: 'Alice',
  avatarUrl: null,
  locale: 'en' as const,
  hasPassword: true,
  isPlatformAdmin: false,
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
        <SignInForm />
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
  // Suppress the initial refresh (returns 401 → anonymous)
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

describe('SignInForm', () => {
  it('shows validation errors when submitting empty form', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: catalogs.en.auth.signIn.submit }));

    // Email and password are required by the zod schema; errors should appear.
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  it('shows API error message when credentials are invalid', async () => {
    vi.mocked(fetch)
      // Initial refresh fails (anonymous)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      )
      // Login: INVALID_CREDENTIALS
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'INVALID_CREDENTIALS', message: 'Bad creds' } }, 401),
      );

    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(catalogs.en.auth.signIn.emailLabel as string), 'a@b.com');
    await user.type(
      screen.getByLabelText(catalogs.en.auth.signIn.passwordLabel as string),
      'wrong',
    );
    await user.click(screen.getByRole('button', { name: catalogs.en.auth.signIn.submit }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(catalogs.en.errors.INVALID_CREDENTIALS);
    });
  });

  it('shows RATE_LIMITED error', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'RATE_LIMITED', message: 'Slow down' } }, 429),
      );

    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(catalogs.en.auth.signIn.emailLabel as string), 'a@b.com');
    await user.type(
      screen.getByLabelText(catalogs.en.auth.signIn.passwordLabel as string),
      'password123',
    );
    await user.click(screen.getByRole('button', { name: catalogs.en.auth.signIn.submit }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(catalogs.en.errors.RATE_LIMITED);
    });
  });

  it('redirects to home on successful sign-in', async () => {
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
      screen.getByLabelText(catalogs.en.auth.signIn.emailLabel as string),
      'alice@example.com',
    );
    await user.type(
      screen.getByLabelText(catalogs.en.auth.signIn.passwordLabel as string),
      'ValidPass1!',
    );
    await user.click(
      screen.getByRole('button', { name: catalogs.en.auth.signIn.submit as string }),
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/en');
    });
  });

  it('redirects to ?next= URL on success', async () => {
    getParam.mockReturnValue('/en/bookings');
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
      screen.getByLabelText(catalogs.en.auth.signIn.emailLabel as string),
      'alice@example.com',
    );
    await user.type(
      screen.getByLabelText(catalogs.en.auth.signIn.passwordLabel as string),
      'ValidPass1!',
    );
    await user.click(
      screen.getByRole('button', { name: catalogs.en.auth.signIn.submit as string }),
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/en/bookings');
    });
  });

  it('falls back to /en when ?next= is an external URL', async () => {
    getParam.mockReturnValue('https://evil.example/pwned');
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
      screen.getByLabelText(catalogs.en.auth.signIn.emailLabel as string),
      'alice@example.com',
    );
    await user.type(
      screen.getByLabelText(catalogs.en.auth.signIn.passwordLabel as string),
      'ValidPass1!',
    );
    await user.click(
      screen.getByRole('button', { name: catalogs.en.auth.signIn.submit as string }),
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/en');
    });
  });

  it('toggles password visibility', async () => {
    renderForm();
    const user = userEvent.setup();

    const input = screen.getByLabelText(catalogs.en.auth.signIn.passwordLabel as string);
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByLabelText(catalogs.en.auth.signIn.showPassword as string));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByLabelText(catalogs.en.auth.signIn.hidePassword as string));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('redirects authenticated users to home (or ?next=)', async () => {
    getParam.mockReturnValue('/en/bookings');
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({
          accessToken: 'tok',
          accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
          user: fakeUser,
        }),
      )
      .mockResolvedValueOnce(makeJsonResponse(fakeUser));

    renderForm();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/en/bookings');
    });
  });
});
