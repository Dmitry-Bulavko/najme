import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Business, Service } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { cleanup } from '@testing-library/react-native';

import { ServiceList } from '@/features/services/service-list';
import { apiRequest } from '@/lib/api/client';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

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

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

jest.mock('@/features/business/business-provider', () => ({
  useBusinessContext: () => ({
    get business() {
      return mockBusinessRef.current;
    },
    setBusiness: jest.fn(),
    reload: jest.fn(async () => undefined),
  }),
}));

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiRequest: jest.fn(),
  };
});

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    businessId: baseBusiness.id,
    name: 'Haircut',
    description: null,
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    price: { amount: 2500, currency: 'EUR' },
    active: true,
    staffMemberIds: [],
    minBookingNoticeMinutes: null,
    bookingHorizonDays: null,
    customFields: [],
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

beforeAll(async () => {
  await initTestI18n('en');
});

beforeEach(() => {
  cleanup();
  jest.mocked(apiRequest).mockReset();
  mockBusinessRef.current = { ...baseBusiness, myRole: 'OWNER' };
});

describe('ServiceList', () => {
  it('shows empty CTA for OWNER and hides manage actions for STAFF', async () => {
    jest.mocked(apiRequest).mockResolvedValue([]);
    const ownerScreen = await renderWithI18n(<ServiceList />);
    expect(await ownerScreen.findByText(catalogs.en.business.services.empty)).toBeTruthy();
    expect(ownerScreen.getByLabelText(catalogs.en.business.services.emptyCta)).toBeTruthy();
    ownerScreen.unmount();

    mockBusinessRef.current = { ...baseBusiness, myRole: 'STAFF' };
    jest.mocked(apiRequest).mockResolvedValue([makeService()]);
    const staffScreen = await renderWithI18n(<ServiceList />);
    expect(await staffScreen.findByText('Haircut')).toBeTruthy();
    expect(staffScreen.queryByTestId('services-add')).toBeNull();
    expect(staffScreen.queryByLabelText(catalogs.en.business.services.edit)).toBeNull();
    expect(staffScreen.queryByLabelText(catalogs.en.business.services.delete)).toBeNull();
    staffScreen.unmount();
  });
});
