import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Me } from '@najme/contracts';
import { catalogs, LOCALE_META } from '@najme/i18n';

import { AuthProvider } from '@/features/auth/session-context';
import { setAccessToken } from '@/lib/api/client';

import { AccountView } from './account-view';

const replace = vi.fn();
const pathname = '/en/account';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => pathname,
  useSearchParams: () => ({ get: vi.fn(() => null) }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  auth: catalogs.en.auth,
  account: catalogs.en.account,
};

const passwordUser: Me = {
  id: 'u1',
  email: 'alice@example.com',
  emailVerified: true,
  displayName: 'Alice',
  avatarUrl: null,
  locale: 'en',
  hasPassword: true,
};

const googleUser: Me = {
  ...passwordUser,
  hasPassword: false,
  emailVerified: false,
  displayName: 'Gog',
};

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Queue refresh + /me so AuthProvider hydrates without an anonymous flash. */
function mockSessionRestore(me: Me) {
  vi.mocked(fetch)
    .mockResolvedValueOnce(
      makeJsonResponse({
        accessToken: 'tok',
        accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
        user: me,
      }),
    )
    .mockResolvedValueOnce(makeJsonResponse(me));
}

function renderAccount() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AuthProvider>
        <AccountView />
      </AuthProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  setAccessToken(null);
  replace.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
  document.cookie = 'NEXT_LOCALE=; Max-Age=0; Path=/';
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AccountView', () => {
  it('redirects anonymous users to sign-in with ?next=', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
    );

    renderAccount();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/en/sign-in?next=%2Fen%2Faccount');
    });
  });

  it('saves the display name and shows a success toast', async () => {
    const updated: Me = { ...passwordUser, displayName: 'Alice Updated' };
    mockSessionRestore(passwordUser);
    vi.mocked(fetch).mockResolvedValueOnce(makeJsonResponse(updated));

    renderAccount();
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: catalogs.en.account.pageTitle });

    const nameInput = screen.getByLabelText(catalogs.en.account.profileSection.displayNameLabel);
    await user.clear(nameInput);
    await user.type(nameInput, 'Alice Updated');
    await user.click(screen.getByRole('button', { name: catalogs.en.account.profileSection.save }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(catalogs.en.account.profileSection.saved);
    });
    expect(vi.mocked(fetch).mock.calls.some((c) => String(c[0]) === '/api/v1/me')).toBe(true);
  });

  it('saves language, sets the cookie and navigates to the new locale path', async () => {
    const updated: Me = { ...passwordUser, locale: 'ru' };
    mockSessionRestore(passwordUser);
    vi.mocked(fetch).mockResolvedValueOnce(makeJsonResponse(updated));

    renderAccount();
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: catalogs.en.account.pageTitle });

    const select = screen.getByLabelText(catalogs.en.account.languageSection.label);
    await user.selectOptions(select, 'ru');
    await user.click(
      screen.getByRole('button', { name: catalogs.en.account.languageSection.save }),
    );

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(catalogs.en.account.languageSection.saved);
    });
    expect(document.cookie).toContain('NEXT_LOCALE=ru');
    expect(replace).toHaveBeenCalledWith('/ru/account');
    expect(screen.getByRole('option', { name: LOCALE_META.ru.label })).toBeTruthy();
  });

  it('maps INVALID_CREDENTIALS onto the current-password field', async () => {
    mockSessionRestore(passwordUser);
    // Wrong password is also 401; changePasswordWithLock refreshes once then retries (#147).
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'INVALID_CREDENTIALS', message: 'bad' } }, 401),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          accessToken: 'refreshed',
          accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
          user: passwordUser,
        }),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'INVALID_CREDENTIALS', message: 'bad' } }, 401),
      );

    renderAccount();
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: catalogs.en.account.pageTitle });

    await user.type(
      screen.getByLabelText(catalogs.en.account.passwordSection.currentLabel),
      'wrongpass',
    );
    await user.type(
      screen.getByLabelText(catalogs.en.account.passwordSection.newLabel),
      'newpassword1',
    );
    await user.type(
      screen.getByLabelText(catalogs.en.account.passwordSection.confirmLabel),
      'newpassword1',
    );
    await user.click(
      screen.getByRole('button', { name: catalogs.en.account.passwordSection.save }),
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(catalogs.en.errors.INVALID_CREDENTIALS);
    });
  });

  it('shows a Google-only explanation instead of the password form', async () => {
    mockSessionRestore(googleUser);

    renderAccount();

    await screen.findByRole('heading', { name: catalogs.en.account.pageTitle });

    expect(screen.getByText(catalogs.en.account.passwordSection.googleOnly)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(catalogs.en.account.passwordSection.currentLabel),
    ).not.toBeInTheDocument();

    expect(screen.getByText(catalogs.en.account.unverified)).toBeInTheDocument();
    expect(
      within(
        screen.getByText(catalogs.en.account.unverified).parentElement as HTMLElement,
      ).getByRole('button', { name: catalogs.en.account.resend }),
    ).toBeInTheDocument();
  });

  it('shows the verified badge when emailVerified is true', async () => {
    mockSessionRestore(passwordUser);

    renderAccount();

    await screen.findByRole('heading', { name: catalogs.en.account.pageTitle });

    expect(screen.getByText(catalogs.en.account.verified)).toBeInTheDocument();
    expect(screen.queryByText(catalogs.en.account.unverified)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: catalogs.en.account.resend }),
    ).not.toBeInTheDocument();
  });

  it('resends verification from the unverified badge', async () => {
    mockSessionRestore(googleUser);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 202 }));

    renderAccount();
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: catalogs.en.account.pageTitle });

    await user.click(screen.getByRole('button', { name: catalogs.en.account.resend }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(catalogs.en.account.resent);
    });
    expect(
      vi.mocked(fetch).mock.calls.some((c) => String(c[0]) === '/api/v1/auth/verify-email/resend'),
    ).toBe(true);
  });

  it('signs out via /auth/logout and redirects home as anonymous', async () => {
    mockSessionRestore(passwordUser);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    renderAccount();
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: catalogs.en.account.pageTitle });

    await user.click(screen.getByRole('button', { name: catalogs.en.account.signOut }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/en');
    });
    expect(vi.mocked(fetch).mock.calls.some((c) => String(c[0]) === '/api/v1/auth/logout')).toBe(
      true,
    );
    // AccountView redirects anonymous users to sign-in after signOut clears the session.
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/en/sign-in?next=%2Fen%2Faccount');
    });
  });

  it('shows a localized mismatch message and does not call the password API', async () => {
    mockSessionRestore(passwordUser);

    renderAccount();
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: catalogs.en.account.pageTitle });

    const callsBefore = vi.mocked(fetch).mock.calls.length;

    await user.type(
      screen.getByLabelText(catalogs.en.account.passwordSection.currentLabel),
      'oldpassword',
    );
    await user.type(
      screen.getByLabelText(catalogs.en.account.passwordSection.newLabel),
      'newpassword1',
    );
    await user.type(
      screen.getByLabelText(catalogs.en.account.passwordSection.confirmLabel),
      'differentpass',
    );
    await user.click(
      screen.getByRole('button', { name: catalogs.en.account.passwordSection.save }),
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        catalogs.en.account.passwordSection.mismatch,
      );
    });
    expect(vi.mocked(fetch).mock.calls.length).toBe(callsBefore);
    expect(vi.mocked(fetch).mock.calls.some((c) => String(c[0]) === '/api/v1/me/password')).toBe(
      false,
    );
  });
});
