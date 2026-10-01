import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BusinessShell } from './business-shell';
import { AuthProvider } from '@/features/auth/session-context';
import { setAccessToken } from '@/lib/api/client';

const replace = vi.fn();
const notFoundMock = vi.fn();
let pathname = '/en/business/11111111-1111-4111-8111-111111111111';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => pathname,
  notFound: () => {
    notFoundMock();
  },
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

const businessId = '11111111-1111-4111-8111-111111111111';

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

function business(role: 'OWNER' | 'ADMIN' | 'STAFF' = 'OWNER') {
  return {
    id: businessId,
    name: 'Salon Ada',
    slug: 'salon-ada',
    categoryId: '22222222-2222-4222-8222-222222222222',
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
    status: 'APPROVED',
    rejectionReason: null,
    myRole: role,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
  };
}

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  auth: catalogs.en.auth,
  business: catalogs.en.business,
};

function renderShell() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AuthProvider>
        <BusinessShell businessId={businessId}>
          <div>child</div>
        </BusinessShell>
      </AuthProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  setAccessToken(null);
  replace.mockReset();
  notFoundMock.mockReset();
  pathname = `/en/business/${businessId}`;
  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('BusinessShell', () => {
  it('redirects anonymous users with a locale-prefixed next path', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
    );
    pathname = `/en/business/${businessId}/staff`;
    renderShell();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        `/en/sign-in?next=${encodeURIComponent(`/en/business/${businessId}/staff`)}`,
      );
    });
  });

  it('calls notFound on 404', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return makeJsonResponse({
          accessToken: 'tok',
          accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
          user: fakeUser,
        });
      }
      if (url.includes('/me') && !url.includes('/businesses')) {
        return makeJsonResponse(fakeUser);
      }
      if (url.includes(`/businesses/${businessId}`)) {
        return makeJsonResponse({ error: { code: 'NOT_FOUND', message: 'missing' } }, 404);
      }
      return makeJsonResponse({ error: { code: 'NOT_FOUND', message: url } }, 404);
    });
    // notFound() throws; React may surface it — assert the mock was invoked.
    renderShell();
    await waitFor(() => {
      expect(notFoundMock).toHaveBeenCalled();
    });
  });

  it('shows error + retry when the business fails to load', async () => {
    const user = userEvent.setup();
    let failBusiness = true;
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return makeJsonResponse({
          accessToken: 'tok',
          accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
          user: fakeUser,
        });
      }
      if (url.includes('/me') && !url.includes('/businesses')) {
        return makeJsonResponse(fakeUser);
      }
      if (url.includes(`/businesses/${businessId}`)) {
        if (failBusiness) {
          return makeJsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'boom' } }, 500);
        }
        return makeJsonResponse(business());
      }
      return makeJsonResponse({ error: { code: 'NOT_FOUND', message: url } }, 404);
    });
    renderShell();
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.errors.INTERNAL_ERROR)).toBeInTheDocument();
    });
    failBusiness = false;
    await user.click(screen.getByRole('button', { name: catalogs.en.business.overview.retry }));
    await waitFor(() => {
      expect(screen.getByText('child')).toBeInTheDocument();
    });
  });

  it('hides Team and Settings for STAFF and shows switch business', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return makeJsonResponse({
          accessToken: 'tok',
          accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
          user: fakeUser,
        });
      }
      if (url.includes('/me') && !url.includes('/businesses')) {
        return makeJsonResponse(fakeUser);
      }
      if (url.includes(`/businesses/${businessId}`)) {
        return makeJsonResponse(business('STAFF'));
      }
      return makeJsonResponse({ error: { code: 'NOT_FOUND', message: url } }, 404);
    });
    renderShell();
    await waitFor(() => {
      expect(screen.getAllByText('Salon Ada').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(catalogs.en.business.shell.overview).length).toBeGreaterThan(0);
    expect(screen.queryByText(catalogs.en.business.shell.team)).toBeNull();
    expect(screen.queryByText(catalogs.en.business.shell.settings)).toBeNull();
    expect(
      screen.getAllByRole('link', { name: catalogs.en.business.menu.switchBusiness })[0],
    ).toHaveAttribute('href', '/en/business?pick=1');
  });
});
