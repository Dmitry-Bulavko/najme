import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateBusinessForm } from './create-business-form';
import { AuthProvider } from '@/features/auth/session-context';
import { setAccessToken } from '@/lib/api/client';

const push = vi.fn();
const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
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

const category = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  slug: 'beauty',
  name: 'Beauty',
  iconKey: null,
  sortOrder: 0,
};

const createdBusiness = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'New Salon',
  slug: 'new-salon',
  categoryId: category.id,
  description: null,
  timezone: 'Europe/Podgorica',
  city: 'PODGORICA',
  address: null,
  contactPhone: null,
  contactEmail: null,
  logoUrl: null,
  coverUrl: null,
  confirmationMode: 'AUTO',
  cancellationWindowMinutes: 120,
  minBookingNoticeMinutes: 60,
  bookingHorizonDays: 60,
  status: 'PENDING_APPROVAL',
  rejectionReason: null,
  myRole: 'OWNER',
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
};

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  auth: catalogs.en.auth,
  business: catalogs.en.business,
};

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <AuthProvider>
          <CreateBusinessForm />
        </AuthProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function mockAuthAndCategories(categoriesBody: unknown = [category], categoriesStatus = 200) {
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes('/auth/refresh')) {
      return makeJsonResponse({
        accessToken: 'tok',
        accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
        user: fakeUser,
      });
    }
    if (url.endsWith('/me') || url.includes('/api/v1/me')) {
      return makeJsonResponse(fakeUser);
    }
    if (url.includes('/categories')) {
      return makeJsonResponse(categoriesBody, categoriesStatus);
    }
    if (url.includes('/businesses') && init?.method === 'POST') {
      return makeJsonResponse(createdBusiness);
    }
    return makeJsonResponse({ error: { code: 'NOT_FOUND', message: url } }, 404);
  });
}

beforeEach(() => {
  setAccessToken(null);
  push.mockReset();
  replace.mockReset();
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
  (globalThis as unknown as { __createStore?: Map<string, string> }).__createStore = store;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('CreateBusinessForm', () => {
  it('shows localized field errors without enum dumps', async () => {
    const user = userEvent.setup();
    mockAuthAndCategories();
    renderForm();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: catalogs.en.business.create.submit }),
      ).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: catalogs.en.business.create.submit }));
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.create.errors.nameRequired)).toBeInTheDocument();
    });
    expect(
      screen.getByText(catalogs.en.business.create.errors.categoryRequired),
    ).toBeInTheDocument();
    expect(screen.getByText(catalogs.en.business.create.errors.cityRequired)).toBeInTheDocument();
    expect(screen.queryByText(/ANDRIJEVICA/)).toBeNull();
  });

  it('shows categories error with retry', async () => {
    const user = userEvent.setup();
    let categoriesOk = false;
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return makeJsonResponse({
          accessToken: 'tok',
          accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
          user: fakeUser,
        });
      }
      if (url.includes('/me')) {
        return makeJsonResponse(fakeUser);
      }
      if (url.includes('/categories')) {
        if (!categoriesOk) {
          return makeJsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'boom' } }, 500);
        }
        return makeJsonResponse([category]);
      }
      return makeJsonResponse({ error: { code: 'NOT_FOUND', message: url } }, 404);
    });
    renderForm();
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.errors.INTERNAL_ERROR)).toBeInTheDocument();
    });
    categoriesOk = true;
    await user.click(
      screen.getByRole('button', { name: catalogs.en.business.create.retryCategories }),
    );
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: catalogs.en.business.create.submit }),
      ).toBeEnabled();
    });
  });

  it('submits omitting empty optionals, remembers id, and redirects', async () => {
    const user = userEvent.setup();
    let postedBody: unknown;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return makeJsonResponse({
          accessToken: 'tok',
          accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
          user: fakeUser,
        });
      }
      if (url.includes('/me')) {
        return makeJsonResponse(fakeUser);
      }
      if (url.includes('/categories')) {
        return makeJsonResponse([category]);
      }
      if (url.includes('/businesses') && init?.method === 'POST') {
        postedBody = init.body ? JSON.parse(String(init.body)) : undefined;
        return makeJsonResponse(createdBusiness);
      }
      return makeJsonResponse({ error: { code: 'NOT_FOUND', message: url } }, 404);
    });
    renderForm();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: catalogs.en.business.create.submit }),
      ).toBeEnabled();
    });

    await user.type(screen.getByLabelText(catalogs.en.business.create.name), 'New Salon');
    await user.click(screen.getByLabelText(catalogs.en.business.create.category));
    await user.click(await screen.findByRole('option', { name: 'Beauty' }));
    await user.click(screen.getByLabelText(catalogs.en.business.create.city));
    await user.click(
      await screen.findByRole('option', { name: catalogs.en.common.cities.PODGORICA }),
    );
    await user.click(screen.getByLabelText(catalogs.en.business.create.ownerIsStaff));
    await user.click(screen.getByRole('button', { name: catalogs.en.business.create.submit }));

    await waitFor(() => {
      expect(postedBody).toEqual({
        name: 'New Salon',
        categoryId: category.id,
        city: 'PODGORICA',
        ownerIsStaff: true,
      });
    });
    expect(
      (globalThis as unknown as { __createStore: Map<string, string> }).__createStore.get(
        'najme.lastBusinessId',
      ),
    ).toBe(createdBusiness.id);
    expect(push).toHaveBeenCalledWith(`/en/business/${createdBusiness.id}`);
  }, 15_000);
});
