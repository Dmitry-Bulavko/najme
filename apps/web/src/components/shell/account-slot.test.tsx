import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogs } from '@najme/i18n';

import { AccountSlot } from './account-slot';
import { AuthProvider } from '@/features/auth/session-context';
import { setAccessToken } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
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
  displayName: 'Alice B',
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

function renderSlot() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AuthProvider>
        <AccountSlot />
      </AuthProvider>
    </NextIntlClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  setAccessToken(null);
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccountSlot', () => {
  it('renders a locale-prefixed "Sign in" link when the user is anonymous', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
    );

    renderSlot();

    await waitFor(() => {
      expect(
        screen.getByRole('link', { name: catalogs.en.auth.header.signIn }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: catalogs.en.auth.header.signIn })).toHaveAttribute(
      'href',
      '/en/sign-in',
    );
  });

  it('renders the avatar button with initials when authenticated', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({
          accessToken: 'tok',
          accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
          user: fakeUser,
        }),
      )
      .mockResolvedValueOnce(makeJsonResponse(fakeUser));

    renderSlot();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: catalogs.en.auth.header.menuLabel }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('shows email in the dropdown when displayName is null', async () => {
    const noNameUser = { ...fakeUser, displayName: null };
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({
          accessToken: 'tok',
          accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
          user: noNameUser,
        }),
      )
      .mockResolvedValueOnce(makeJsonResponse(noNameUser));

    renderSlot();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: catalogs.en.auth.header.menuLabel }),
      ).toBeInTheDocument();
    });
    // Initials from email: "al" → "AL"
    expect(screen.getByText('AL')).toBeInTheDocument();
  });
});
