import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountBusinessMenu } from './account-business-menu';
import { AuthProvider } from '@/features/auth/session-context';
import { setAccessToken } from '@/lib/api/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push }),
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
  business: catalogs.en.business,
};

function renderMenu() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <AuthProvider>
          <DropdownMenu open>
            <DropdownMenuTrigger asChild>
              <button type="button">menu</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <AccountBusinessMenu />
            </DropdownMenuContent>
          </DropdownMenu>
        </AuthProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function mockSession(memberships: unknown) {
  vi.mocked(fetch)
    .mockResolvedValueOnce(
      makeJsonResponse({
        accessToken: 'tok',
        accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
        user: fakeUser,
      }),
    )
    .mockResolvedValueOnce(makeJsonResponse(fakeUser))
    .mockResolvedValue(makeJsonResponse(memberships));
}

beforeEach(() => {
  setAccessToken(null);
  push.mockReset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AccountBusinessMenu', () => {
  it('shows create when there are no memberships', async () => {
    mockSession([]);
    renderMenu();
    await waitFor(() => {
      expect(
        screen.getByRole('menuitem', { name: catalogs.en.business.menu.createBusiness }),
      ).toHaveAttribute('href', '/en/business/new');
    });
    expect(screen.queryByText(catalogs.en.business.menu.clientMode)).toBeNull();
  });

  it('lists businesses and keeps last id on client mode', async () => {
    const user = userEvent.setup();
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    store.set('najme.lastBusinessId', 'biz-1');

    mockSession([
      {
        businessId: '11111111-1111-4111-8111-111111111111',
        name: 'Ada',
        slug: 'ada',
        role: 'OWNER',
        status: 'APPROVED',
        staffMemberId: null,
        logoUrl: null,
      },
      {
        businessId: '22222222-2222-4222-8222-222222222222',
        name: 'Bar',
        slug: 'bar',
        role: 'STAFF',
        status: 'APPROVED',
        staffMemberId: null,
        logoUrl: null,
      },
    ]);
    renderMenu();

    await waitFor(() => {
      expect(screen.getByText('Ada')).toBeInTheDocument();
    });
    expect(screen.getByText('Bar')).toBeInTheDocument();
    expect(screen.getByText(catalogs.en.business.menu.switchBusiness)).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: catalogs.en.business.menu.clientMode }));
    expect(push).toHaveBeenCalledWith('/en');
    expect(store.get('najme.lastBusinessId')).toBe('biz-1');
  });

  it('shows an error item when memberships fail to load', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({
          accessToken: 'tok',
          accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
          user: fakeUser,
        }),
      )
      .mockResolvedValueOnce(makeJsonResponse(fakeUser))
      .mockResolvedValue(
        makeJsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500),
      );
    renderMenu();
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.list.error)).toBeInTheDocument();
    });
  });
});
