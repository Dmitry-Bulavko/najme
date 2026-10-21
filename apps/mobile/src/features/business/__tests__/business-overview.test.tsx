import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Business } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { BusinessOverview } from '@/features/business/business-overview';
import { loadChecklist } from '@/features/business/load-checklist';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

const mockSetBusiness = jest.fn();

const baseBusiness: Business = {
  id: '11111111-1111-4111-8111-111111111111',
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

const mockBusinessRef: { current: Business } = { current: { ...baseBusiness } };

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

jest.mock('@/features/business/business-provider', () => ({
  useBusinessContext: () => ({
    get business() {
      return mockBusinessRef.current;
    },
    setBusiness: mockSetBusiness,
    reload: jest.fn(async () => undefined),
  }),
}));

jest.mock('@/features/business/load-checklist', () => ({
  loadChecklist: jest.fn(async () => ({
    hasLogo: false,
    hasStaff: false,
    hasServiceWithStaff: false,
    allActiveHaveHours: false,
  })),
}));

async function wrapQuery(ui: ReactElement) {
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
  mockBusinessRef.current = { ...baseBusiness };
  mockSetBusiness.mockReset();
  jest.mocked(loadChecklist).mockClear();
});

describe('BusinessOverview checklist', () => {
  it('loads checklist for OWNER and not for STAFF', async () => {
    const ownerScreen = await wrapQuery(<BusinessOverview />);
    await waitFor(() => {
      expect(loadChecklist).toHaveBeenCalledWith(baseBusiness.id);
      expect(ownerScreen.getByText(catalogs.en.business.overview.itemLogo)).toBeTruthy();
    });
    ownerScreen.unmount();

    jest.mocked(loadChecklist).mockClear();
    mockBusinessRef.current = { ...baseBusiness, myRole: 'STAFF' };
    const staffScreen = await wrapQuery(<BusinessOverview />);
    await waitFor(() => expect(staffScreen.getByTestId('business-overview')).toBeTruthy());
    expect(staffScreen.queryByText(catalogs.en.business.overview.checklistHeading)).toBeNull();
    expect(loadChecklist).not.toHaveBeenCalled();
    staffScreen.unmount();
  });
});
