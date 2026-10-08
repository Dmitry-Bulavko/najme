import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Business, Service } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react-native';

import { ServiceList } from '@/features/services/service-list';
import { apiRequest } from '@/lib/api/client';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

const mockConfirm = jest.fn<(options: unknown) => Promise<boolean>>();
const mockFocusCallbacks: Array<() => void> = [];

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
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactActual.useEffect(() => {
        mockFocusCallbacks.push(callback);
        const cleanupFn = callback();
        return typeof cleanupFn === 'function' ? cleanupFn : undefined;
      }, [callback]);
    },
  };
});

jest.mock('@/features/business/business-provider', () => ({
  useBusinessContext: () => ({
    get business() {
      return mockBusinessRef.current;
    },
    setBusiness: jest.fn(),
    reload: jest.fn(async () => undefined),
  }),
}));

jest.mock('@/components/ui/confirm', () => ({
  confirm: (options: unknown) => mockConfirm(options),
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
  mockFocusCallbacks.length = 0;
  mockConfirm.mockReset();
  mockConfirm.mockResolvedValue(true);
  jest.mocked(apiRequest).mockReset();
  mockBusinessRef.current = { ...baseBusiness, myRole: 'OWNER' };
});

describe('ServiceList', () => {
  it('shows empty CTA for OWNER', async () => {
    jest.mocked(apiRequest).mockResolvedValue([]);
    const screen = await renderWithI18n(<ServiceList />);
    expect(await screen.findByText(catalogs.en.business.services.empty)).toBeTruthy();
    expect(screen.getByLabelText(catalogs.en.business.services.emptyCta)).toBeTruthy();
    screen.unmount();
  });

  it('hides manage actions for STAFF', async () => {
    mockBusinessRef.current = { ...baseBusiness, myRole: 'STAFF' };
    jest.mocked(apiRequest).mockResolvedValue([makeService()]);
    const screen = await renderWithI18n(<ServiceList />);
    expect(await screen.findByText('Haircut')).toBeTruthy();
    expect(screen.queryByTestId('services-add')).toBeNull();
    expect(screen.queryByLabelText(catalogs.en.business.services.edit)).toBeNull();
    expect(screen.queryByLabelText(catalogs.en.business.services.delete)).toBeNull();
    screen.unmount();
  });

  it('refetches on focus', async () => {
    jest.mocked(apiRequest).mockResolvedValue([makeService()]);
    const screen = await renderWithI18n(<ServiceList />);
    expect(await screen.findByText('Haircut')).toBeTruthy();
    expect(jest.mocked(apiRequest).mock.calls.length).toBe(1);
    const latest = mockFocusCallbacks[mockFocusCallbacks.length - 1];
    expect(latest).toBeTruthy();
    await act(async () => {
      latest?.();
    });
    await waitFor(() => {
      expect(jest.mocked(apiRequest).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    screen.unmount();
  });

  it('deletes after confirm()', async () => {
    jest.mocked(apiRequest).mockImplementation(((path: string, init?: { method?: string }) => {
      if (path.endsWith('/services') && (!init || !init.method || init.method === 'GET')) {
        return Promise.resolve([makeService()]);
      }
      if (init?.method === 'DELETE') return Promise.resolve(undefined);
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);
    const screen = await renderWithI18n(<ServiceList />);
    expect(await screen.findByText('Haircut')).toBeTruthy();
    expect(
      screen.getByLabelText(catalogs.en.business.services.deleteNamed.replace('{name}', 'Haircut')),
    ).toBeTruthy();
    const deleteButton = screen.getByTestId('service-delete-44444444-4444-4444-8444-444444444444');
    fireEvent.press(deleteButton);
    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.services.deletedToast)).toBeTruthy();
    });
    expect(screen.queryByText('Haircut')).toBeNull();
    screen.unmount();
  });
});
