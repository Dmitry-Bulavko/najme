import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Business } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { BusinessProvider } from '@/features/business/business-provider';
import { ApiError, apiRequest } from '@/lib/api/client';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

const mockReplace = jest.fn();
const mockClearLastBusinessId = jest.fn(async () => undefined);
const mockReadLastBusinessId = jest.fn(async () => '11111111-1111-4111-8111-111111111111');
const mockInvalidate = jest.fn();
const mockEnterClientMode = jest.fn(async () => undefined);

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
      replace: mockReplace,
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

jest.mock('@/features/business/use-my-businesses', () => ({
  useInvalidateMyBusinesses: () => mockInvalidate,
}));

jest.mock('@/features/business/enter-mode', () => ({
  enterClientMode: (...args: unknown[]) => mockEnterClientMode(...args),
}));

jest.mock('@/features/business/last-business', () => {
  const actual = jest.requireActual<typeof import('@/features/business/last-business')>(
    '@/features/business/last-business',
  );
  return {
    ...actual,
    writeAppMode: jest.fn(async () => undefined),
    writeLastBusinessId: jest.fn(async () => undefined),
    clearLastBusinessId: (...args: unknown[]) => mockClearLastBusinessId(...args),
    readLastBusinessId: (...args: unknown[]) => mockReadLastBusinessId(...args),
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

beforeAll(async () => {
  await initTestI18n('en');
});

beforeEach(() => {
  cleanup();
  mockReplace.mockReset();
  mockClearLastBusinessId.mockClear();
  mockReadLastBusinessId.mockReset();
  mockReadLastBusinessId.mockResolvedValue(businessId);
  mockInvalidate.mockClear();
  mockEnterClientMode.mockClear();
  jest.mocked(apiRequest).mockReset();
});

describe('BusinessProvider membership dead-end', () => {
  it('offers Switch business and Client mode on NOT_FOUND (no Retry)', async () => {
    jest.mocked(apiRequest).mockRejectedValue(new ApiError('NOT_FOUND', 'gone', 404));

    const screen = await wrap(
      <BusinessProvider businessId={businessId}>
        <></>
      </BusinessProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('business-provider-error')).toBeTruthy();
    });
    expect(screen.getByText(catalogs.en.errors.NOT_FOUND)).toBeTruthy();
    expect(screen.getByTestId('business-provider-switch')).toBeTruthy();
    expect(screen.getByTestId('business-provider-client-mode')).toBeTruthy();
    expect(screen.queryByTestId('business-provider-retry')).toBeNull();
    expect(mockClearLastBusinessId).toHaveBeenCalled();
    expect(mockInvalidate).toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByTestId('business-provider-switch'));
    });
    expect(mockReplace).toHaveBeenCalledWith('/(business)/pick');

    await act(async () => {
      fireEvent.press(screen.getByTestId('business-provider-client-mode'));
    });
    expect(mockEnterClientMode).toHaveBeenCalled();

    screen.unmount();
  });

  it('shows Retry for transient errors', async () => {
    jest.mocked(apiRequest).mockRejectedValue(new ApiError('INTERNAL_ERROR', 'boom', 500));

    const screen = await wrap(
      <BusinessProvider businessId={businessId}>
        <></>
      </BusinessProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('business-provider-retry')).toBeTruthy();
    });
    expect(screen.queryByTestId('business-provider-switch')).toBeNull();
    expect(mockClearLastBusinessId).not.toHaveBeenCalled();

    screen.unmount();
  });

  it('loads business and writes mode on success', async () => {
    jest.mocked(apiRequest).mockResolvedValue(baseBusiness);
    const { writeAppMode, writeLastBusinessId } = jest.requireMock<
      typeof import('@/features/business/last-business')
    >('@/features/business/last-business');

    const screen = await wrap(
      <BusinessProvider businessId={businessId}>
        <></>
      </BusinessProvider>,
    );

    await waitFor(() => {
      expect(writeLastBusinessId).toHaveBeenCalledWith(businessId);
      expect(writeAppMode).toHaveBeenCalledWith('business');
    });

    screen.unmount();
  });
});
