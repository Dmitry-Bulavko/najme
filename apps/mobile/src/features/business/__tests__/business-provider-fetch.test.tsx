import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Business } from '@najme/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { BusinessProvider } from '@/features/business/business-provider';
import { ApiError, apiRequest } from '@/lib/api/client';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

const businessId = '11111111-1111-4111-8111-111111111111';

const baseBusiness: Business = {
  id: businessId,
  name: 'Salon Ada',
  slug: 'salon-ada',
  status: 'APPROVED',
  categoryId: '22222222-2222-4222-8222-222222222222',
  city: 'PODGORICA',
  description: null,
  address: null,
  contactPhone: null,
  contactEmail: null,
  logoUrl: null,
  coverUrl: null,
  timezone: 'Europe/Podgorica',
  confirmationMode: 'AUTO',
  cancellationWindowMinutes: 120,
  minBookingNoticeMinutes: 60,
  bookingHorizonDays: 60,
  rejectionReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  myRole: 'OWNER',
};

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: () => true,
    }),
    Redirect: ({ href }: { href: string }) =>
      ReactActual.createElement(ReactActual.Fragment, null, `redirect:${href}`),
    Link: ({ children }: { children: ReactNode }) =>
      ReactActual.createElement(ReactActual.Fragment, null, children),
  };
});

jest.mock('@/features/auth/auth-provider', () => ({
  useSession: () => ({
    state: 'authenticated' as const,
    me: {
      id: 'u1',
      email: 'owner@example.com',
      emailVerified: true,
      displayName: 'Owner',
      avatarUrl: null,
      locale: 'en',
      hasPassword: true,
      isPlatformAdmin: false,
    },
    signIn: jest.fn(),
    signUp: jest.fn(),
    signInWithGoogle: jest.fn(),
    signOut: jest.fn(),
    updateMe: jest.fn(),
  }),
}));

jest.mock('@/features/business/enter-mode', () => ({
  enterClientMode: jest.fn(async () => undefined),
}));

jest.mock('@/features/business/last-business', () => {
  const actual = jest.requireActual<typeof import('@/features/business/last-business')>(
    '@/features/business/last-business',
  );
  return {
    ...actual,
    writeAppMode: jest.fn(async () => undefined),
    writeLastBusinessId: jest.fn(async () => undefined),
    clearLastBusinessId: jest.fn(async () => undefined),
    readLastBusinessId: jest.fn(async () => businessId),
  };
});

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiRequest: jest.fn(),
  };
});

async function wrap(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return renderWithI18n(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function businessGetCalls(): number {
  return jest.mocked(apiRequest).mock.calls.filter(([path]) => path === `/businesses/${businessId}`)
    .length;
}

beforeAll(async () => {
  await initTestI18n('en');
});

beforeEach(() => {
  cleanup();
  jest.mocked(apiRequest).mockReset();
});

describe('BusinessProvider fetch stability (real invalidate hook)', () => {
  it('calls GET /businesses/:id exactly once after settling on success', async () => {
    jest.mocked(apiRequest).mockResolvedValue(baseBusiness);

    const screen = await wrap(
      <BusinessProvider businessId={businessId}>
        <></>
      </BusinessProvider>,
    );

    await waitFor(() => {
      expect(businessGetCalls()).toBe(1);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(businessGetCalls()).toBe(1);

    screen.unmount();
  });

  it('calls GET /businesses/:id exactly once after settling on NOT_FOUND', async () => {
    jest.mocked(apiRequest).mockRejectedValue(new ApiError('NOT_FOUND', 'gone', 404));

    const screen = await wrap(
      <BusinessProvider businessId={businessId}>
        <></>
      </BusinessProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('business-provider-error')).toBeTruthy();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(businessGetCalls()).toBe(1);

    screen.unmount();
  });
});
