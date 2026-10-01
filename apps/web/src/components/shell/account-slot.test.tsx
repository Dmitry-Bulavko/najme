import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogs } from '@najme/i18n';

import { AccountSlot } from './account-slot';
import { AuthProvider } from '@/features/auth/session-context';
import { setAccessToken } from '@/lib/api/client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fakeUser: {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  locale: 'en';
  hasPassword: boolean;
  isPlatformAdmin: boolean;
} = {
  id: 'u1',
  email: 'alice@example.com',
  emailVerified: true,
  displayName: 'Alice B',
  avatarUrl: null,
  locale: 'en',
  hasPassword: true,
  isPlatformAdmin: false,
};

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  auth: catalogs.en.auth,
  admin: catalogs.en.admin,
  business: catalogs.en.business,
};

function renderSlot() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <AuthProvider>
          <AccountSlot />
        </AuthProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

/** Session restore + /me + empty memberships (business menu → create link). */
function mockAuthenticatedSession(user = fakeUser) {
  vi.mocked(fetch)
    .mockResolvedValueOnce(
      makeJsonResponse({
        accessToken: 'tok',
        accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
        user,
      }),
    )
    .mockResolvedValueOnce(makeJsonResponse(user))
    .mockResolvedValue(makeJsonResponse([]));
}

beforeEach(() => {
  setAccessToken(null);
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

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
    mockAuthenticatedSession();
    renderSlot();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: catalogs.en.auth.header.menuLabel }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('shows email in the dropdown when displayName is null', async () => {
    mockAuthenticatedSession({ ...fakeUser, displayName: null });
    renderSlot();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: catalogs.en.auth.header.menuLabel }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('shows create-business and admin links for a platform admin with no memberships', async () => {
    const adminUser = { ...fakeUser, isPlatformAdmin: true };
    mockAuthenticatedSession(adminUser);

    const { user } = await (async () => {
      const userEvent = (await import('@testing-library/user-event')).default;
      return { user: userEvent.setup() };
    })();
    renderSlot();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: catalogs.en.auth.header.menuLabel }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: catalogs.en.auth.header.menuLabel }));
    expect(
      screen.getByRole('menuitem', { name: catalogs.en.business.menu.createBusiness }),
    ).toHaveAttribute('href', '/en/business/new');
    expect(screen.getByRole('menuitem', { name: catalogs.en.admin.menuLink })).toHaveAttribute(
      'href',
      '/en/admin/businesses',
    );
  });

  it('hides the admin link for non-admins', async () => {
    mockAuthenticatedSession();

    const { user } = await (async () => {
      const userEvent = (await import('@testing-library/user-event')).default;
      return { user: userEvent.setup() };
    })();
    renderSlot();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: catalogs.en.auth.header.menuLabel }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: catalogs.en.auth.header.menuLabel }));
    expect(screen.queryByRole('menuitem', { name: catalogs.en.admin.menuLink })).toBeNull();
  });
});
