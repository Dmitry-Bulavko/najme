import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BusinessIndexView } from './business-index-view';
import { AuthProvider } from '@/features/auth/session-context';
import { setAccessToken } from '@/lib/api/client';

const replace = vi.fn();
let pickParam: string | null = null;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => ({ get: (key: string) => (key === 'pick' ? pickParam : null) }),
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

const biz1 = {
  businessId: '11111111-1111-4111-8111-111111111111',
  name: 'Ada',
  slug: 'ada',
  role: 'OWNER' as const,
  status: 'APPROVED' as const,
  staffMemberId: null,
  logoUrl: null,
};

const biz2 = {
  businessId: '22222222-2222-4222-8222-222222222222',
  name: 'Bar',
  slug: 'bar',
  role: 'ADMIN' as const,
  status: 'APPROVED' as const,
  staffMemberId: null,
  logoUrl: null,
};

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  auth: catalogs.en.auth,
  business: catalogs.en.business,
};

function renderIndex() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <AuthProvider>
          <BusinessIndexView />
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
  replace.mockReset();
  pickParam = null;
  vi.stubGlobal('fetch', vi.fn());
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
  (globalThis as unknown as { __lbStore?: Map<string, string> }).__lbStore = store;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('BusinessIndexView', () => {
  it('redirects to the only membership', async () => {
    mockSession([biz1]);
    renderIndex();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(`/en/business/${biz1.businessId}`);
    });
  });

  it('redirects to the remembered membership', async () => {
    (globalThis as unknown as { __lbStore: Map<string, string> }).__lbStore.set(
      'najme.lastBusinessId',
      biz2.businessId,
    );
    mockSession([biz1, biz2]);
    renderIndex();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(`/en/business/${biz2.businessId}`);
    });
  });

  it('falls back to the first membership when the remembered id is stale', async () => {
    (globalThis as unknown as { __lbStore: Map<string, string> }).__lbStore.set(
      'najme.lastBusinessId',
      '99999999-9999-4999-8999-999999999999',
    );
    mockSession([biz1, biz2]);
    renderIndex();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(`/en/business/${biz1.businessId}`);
    });
  });

  it('shows the picker when pick=1', async () => {
    pickParam = '1';
    mockSession([biz1, biz2]);
    renderIndex();
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: catalogs.en.business.list.heading }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Bar')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalledWith(expect.stringContaining('/business/'));
  });
});
