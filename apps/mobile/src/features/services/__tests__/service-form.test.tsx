import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Business, Service, StaffMember } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { act, cleanup, fireEvent, waitFor, within } from '@testing-library/react-native';

import { ServiceForm } from '@/features/services/service-form';
import { ApiError, apiRequest } from '@/lib/api/client';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

const mockReplace = jest.fn();

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
    replace: mockReplace,
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

jest.mock('@/components/ui/select', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const { Text, TextInput, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Select: ({
      label,
      value,
      onChange,
      disabled,
      error,
      testID,
    }: {
      label: string;
      value: string | null;
      options: { value: string; label: string }[];
      onChange: (value: string) => void;
      disabled?: boolean;
      error?: string;
      testID?: string;
    }) =>
      ReactActual.createElement(
        View,
        { testID },
        ReactActual.createElement(TextInput, {
          accessibilityLabel: label,
          value: value ?? '',
          editable: !disabled,
          onChangeText: onChange,
        }),
        value != null
          ? ReactActual.createElement(Text, { testID: `${testID}-value` }, value)
          : null,
        error ? ReactActual.createElement(Text, null, error) : null,
      ),
  };
});

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiRequest: jest.fn(),
  };
});

function makeStaff(overrides: Partial<StaffMember> = {}): StaffMember {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    businessId: baseBusiness.id,
    displayName: 'Ana',
    photoUrl: null,
    active: true,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

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
  mockReplace.mockReset();
  jest.mocked(apiRequest).mockReset();
  mockBusinessRef.current = { ...baseBusiness, myRole: 'OWNER' };
});

describe('ServiceForm', () => {
  it('binds MoneyInput to minor units and exposes duration presets', async () => {
    jest.mocked(apiRequest).mockImplementation(((path: string, init?: { method?: string }) => {
      if (path.endsWith('/staff')) return Promise.resolve([makeStaff()]);
      if (init?.method === 'POST') {
        return Promise.resolve(
          makeService({ name: 'Color', price: { amount: 1250, currency: 'EUR' } }),
        );
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);
    const screen = await renderWithI18n(<ServiceForm mode="create" />);
    await waitFor(() => {
      expect(screen.getByTestId('service-price')).toBeTruthy();
    });
    expect(screen.getByTestId('service-duration-value').props.children).toBe('30');
    const priceInput = within(screen.getByTestId('service-price')).getByLabelText(
      catalogs.en.business.services.price,
    );
    await act(async () => {
      await fireEvent(priceInput, 'focus');
    });
    await act(async () => {
      await fireEvent.changeText(priceInput, '12.50');
    });
    await act(async () => {
      await fireEvent(priceInput, 'blur');
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText(catalogs.en.business.services.name), 'Color');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('service-submit'));
    });
    await waitFor(() => {
      expect(jest.mocked(apiRequest)).toHaveBeenCalledWith(
        `/businesses/${baseBusiness.id}/services`,
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            name: 'Color',
            price: { amount: 1250, currency: 'EUR' },
            durationMinutes: 30,
          }),
        }),
      );
    });
    screen.unmount();
  });

  it('is read-only for STAFF on edit', async () => {
    mockBusinessRef.current = { ...baseBusiness, myRole: 'STAFF' };
    const service = makeService();
    jest.mocked(apiRequest).mockImplementation(((path: string) => {
      if (path.endsWith('/staff')) return Promise.resolve([makeStaff()]);
      if (path.endsWith(`/services/${service.id}`)) return Promise.resolve(service);
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);
    const screen = await renderWithI18n(<ServiceForm mode="edit" serviceId={service.id} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Haircut')).toBeTruthy();
    });
    expect(screen.queryByTestId('service-submit')).toBeNull();
    expect(screen.queryByTestId('custom-fields-add')).toBeNull();
    screen.unmount();
  });

  it('maps staffMemberIds validation details onto the form', async () => {
    jest.mocked(apiRequest).mockImplementation(((path: string, init?: { method?: string }) => {
      if (path.endsWith('/staff') && (!init || !init.method || init.method === 'GET')) {
        return Promise.resolve([makeStaff()]);
      }
      if (init?.method === 'POST') {
        return Promise.reject(
          new ApiError('VALIDATION_FAILED', 'invalid', 422, {
            staffMemberIds: ['33333333-3333-4333-8333-333333333333'],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);
    const screen = await renderWithI18n(<ServiceForm mode="create" />);
    await waitFor(() => {
      expect(screen.getByTestId('service-price')).toBeTruthy();
    });
    const priceInput = within(screen.getByTestId('service-price')).getByLabelText(
      catalogs.en.business.services.price,
    );
    await act(async () => {
      await fireEvent(priceInput, 'focus');
    });
    await act(async () => {
      await fireEvent.changeText(priceInput, '10');
    });
    await act(async () => {
      await fireEvent(priceInput, 'blur');
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText(catalogs.en.business.services.name), 'Color');
      fireEvent.press(screen.getByTestId('service-staff-33333333-3333-4333-8333-333333333333'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('service-submit'));
    });
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.services.errors.invalid)).toBeTruthy();
    });
    screen.unmount();
  });
});
