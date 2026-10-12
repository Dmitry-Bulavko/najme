import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Business, Service, StaffMember } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { act, cleanup, fireEvent, waitFor, within } from '@testing-library/react-native';

import { ServiceForm } from '@/features/services/service-form';
import { ApiError, apiRequest } from '@/lib/api/client';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);

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
const inactiveStaffId = '55555555-5555-4555-8555-555555555555';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    back: mockBack,
    canGoBack: () => mockCanGoBack(),
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

async function fillPrice(
  screen: Awaited<ReturnType<typeof renderWithI18n>>,
  amount: string,
): Promise<void> {
  const priceInput = within(screen.getByTestId('service-price')).getByLabelText(
    catalogs.en.business.services.price,
  );
  await act(async () => {
    fireEvent(priceInput, 'focus');
  });
  await act(async () => {
    fireEvent.changeText(priceInput, amount);
  });
}

beforeAll(async () => {
  await initTestI18n('en');
});

beforeEach(() => {
  cleanup();
  mockReplace.mockReset();
  mockBack.mockReset();
  mockCanGoBack.mockReset();
  mockCanGoBack.mockReturnValue(true);
  jest.mocked(apiRequest).mockReset();
  mockBusinessRef.current = { ...baseBusiness, myRole: 'OWNER' };
});

describe('ServiceForm', () => {
  it('submits typed price without blur', async () => {
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
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText(catalogs.en.business.services.name), 'Color');
    });
    await fillPrice(screen, '12.50');
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
          }),
        }),
      );
    });
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining(`/services/44444444-4444-4444-8444-444444444444?created=1`),
    );
    screen.unmount();
  });

  it('blocks submit for invalid en price draft 12,50', async () => {
    jest.mocked(apiRequest).mockImplementation(((path: string) => {
      if (path.endsWith('/staff')) return Promise.resolve([makeStaff()]);
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);
    const screen = await renderWithI18n(<ServiceForm mode="create" />);
    await waitFor(() => {
      expect(screen.getByTestId('service-price')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText(catalogs.en.business.services.name), 'Cut');
    });
    await fillPrice(screen, '12,50');
    await act(async () => {
      fireEvent.press(screen.getByTestId('service-submit'));
    });
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.services.errors.priceInvalid)).toBeTruthy();
    });
    expect(jest.mocked(apiRequest).mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
      false,
    );
    const priceInput = within(screen.getByTestId('service-price')).getByLabelText(
      catalogs.en.business.services.price,
    );
    expect(priceInput.props.value).toBe('12,50');
    screen.unmount();
  });

  it('keeps focus and invalid draft when retyping after a blocked Save', async () => {
    jest.mocked(apiRequest).mockImplementation(((path: string) => {
      if (path.endsWith('/staff')) return Promise.resolve([makeStaff()]);
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);
    const screen = await renderWithI18n(<ServiceForm mode="create" />);
    await waitFor(() => {
      expect(screen.getByTestId('service-price')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText(catalogs.en.business.services.name), 'Cut');
    });
    await fillPrice(screen, '12,50');
    await act(async () => {
      fireEvent.press(screen.getByTestId('service-submit'));
    });
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.services.errors.priceInvalid)).toBeTruthy();
    });

    const priceInput = () =>
      within(screen.getByTestId('service-price')).getByLabelText(
        catalogs.en.business.services.price,
      );

    await act(async () => {
      fireEvent(priceInput(), 'focus');
    });
    // Retype character-by-character: a spurious blur after "12" would commit 1200 and
    // replace the draft with the formatted "12.00", losing the rest of the keystrokes.
    for (const draft of ['1', '12', '12,', '12,5', '12,50']) {
      await act(async () => {
        fireEvent.changeText(priceInput(), draft);
      });
      expect(priceInput().props.value).toBe(draft);
    }
    expect(priceInput().props.value).not.toBe('12.00');

    await act(async () => {
      fireEvent.press(screen.getByTestId('service-submit'));
    });
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.services.errors.priceInvalid)).toBeTruthy();
    });
    expect(jest.mocked(apiRequest).mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
      false,
    );
    expect(priceInput().props.value).toBe('12,50');
    screen.unmount();
  });

  it('saves me-locale 12,50 as 1250 minor units', async () => {
    let posted: unknown;
    jest.mocked(apiRequest).mockImplementation(((
      path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (path.endsWith('/staff')) return Promise.resolve([makeStaff()]);
      if (init?.method === 'POST') {
        posted = init.body;
        return Promise.resolve(makeService());
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);
    // Pass locale on MoneyInput via ServiceForm's i18n language — isolate with try/finally.
    await initTestI18n('me');
    try {
      const screen = await renderWithI18n(<ServiceForm mode="create" />);
      await waitFor(() => {
        expect(screen.getByTestId('service-price')).toBeTruthy();
      });
      await act(async () => {
        fireEvent.changeText(screen.getByLabelText(catalogs.me.business.services.name), 'Cut');
      });
      const priceInput = within(screen.getByTestId('service-price')).getByLabelText(
        catalogs.me.business.services.price,
      );
      await act(async () => {
        fireEvent(priceInput, 'focus');
      });
      await act(async () => {
        fireEvent.changeText(priceInput, '12,50');
      });
      await act(async () => {
        fireEvent.press(screen.getByTestId('service-submit'));
      });
      await waitFor(() => {
        expect(posted).toBeTruthy();
      });
      expect((posted as { price: { amount: number } }).price.amount).toBe(1250);
      screen.unmount();
    } finally {
      await initTestI18n('en');
    }
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
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText(catalogs.en.business.services.name), 'Color');
    });
    await fillPrice(screen, '10');
    await act(async () => {
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

  it('PATCHes edits including an updated price', async () => {
    let patched: unknown;
    const existing = makeService({ price: { amount: 1500, currency: 'EUR' }, name: 'Cut' });
    jest.mocked(apiRequest).mockImplementation(((
      path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (path.endsWith('/staff')) return Promise.resolve([makeStaff()]);
      if (path.includes('/services/') && (!init || !init.method || init.method === 'GET')) {
        return Promise.resolve(existing);
      }
      if (path.includes('/services/') && init?.method === 'PATCH') {
        patched = init.body;
        return Promise.resolve({
          ...existing,
          price: { amount: 3500, currency: 'EUR' },
          name: 'Fade',
        });
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<ServiceForm mode="edit" serviceId={existing.id} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Cut')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText(catalogs.en.business.services.name), 'Fade');
    });
    await fillPrice(screen, '35');
    await act(async () => {
      fireEvent.press(screen.getByTestId('service-submit'));
    });
    await waitFor(() => {
      expect(patched).toBeTruthy();
    });
    expect((patched as { price: { amount: number }; name: string }).price.amount).toBe(3500);
    expect((patched as { name: string }).name).toBe('Fade');
    screen.unmount();
  });

  it('preserves non-preset duration 125 and buffer 45', async () => {
    const existing = makeService({
      durationMinutes: 125,
      bufferBeforeMinutes: 45,
    });
    jest.mocked(apiRequest).mockImplementation(((path: string) => {
      if (path.endsWith('/staff')) return Promise.resolve([makeStaff()]);
      if (path.includes('/services/')) return Promise.resolve(existing);
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);
    const screen = await renderWithI18n(<ServiceForm mode="edit" serviceId={existing.id} />);
    await waitFor(() => {
      expect(screen.getByTestId('service-duration-value').props.children).toBe('125');
      expect(screen.getByTestId('service-buffer-before-value').props.children).toBe('45');
    });
    screen.unmount();
  });

  it('preserves advanced notice/horizon while collapsed on save', async () => {
    let patched: unknown;
    const existing = makeService({
      minBookingNoticeMinutes: 120,
      bookingHorizonDays: 30,
    });
    jest.mocked(apiRequest).mockImplementation(((
      path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (path.endsWith('/staff')) return Promise.resolve([makeStaff()]);
      if (path.includes('/services/') && (!init || !init.method || init.method === 'GET')) {
        return Promise.resolve(existing);
      }
      if (init?.method === 'PATCH') {
        patched = init.body;
        return Promise.resolve(existing);
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<ServiceForm mode="edit" serviceId={existing.id} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Haircut')).toBeTruthy();
    });
    expect(screen.queryByTestId('service-notice')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('service-submit'));
    });
    await waitFor(() => {
      expect(patched).toBeTruthy();
    });
    expect(
      (patched as { minBookingNoticeMinutes: number; bookingHorizonDays: number })
        .minBookingNoticeMinutes,
    ).toBe(120);
    expect((patched as { bookingHorizonDays: number }).bookingHorizonDays).toBe(30);
    screen.unmount();
  });

  it('maps customFields[i].key detail onto the matching row', async () => {
    jest.mocked(apiRequest).mockImplementation(((path: string, init?: { method?: string }) => {
      if (path.endsWith('/staff')) return Promise.resolve([makeStaff()]);
      if (init?.method === 'POST') {
        return Promise.reject(
          new ApiError('VALIDATION_FAILED', 'invalid', 422, {
            issues: [{ path: ['customFields', 0, 'key'] }],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<ServiceForm mode="create" />);
    await waitFor(() => {
      expect(screen.getByTestId('service-price')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText(catalogs.en.business.services.name), 'Cut');
    });
    await fillPrice(screen, '20');
    await act(async () => {
      fireEvent.press(screen.getByTestId('custom-fields-add'));
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText(catalogs.en.business.customFields.label), 'Notes');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('service-submit'));
    });
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.services.errors.invalid)).toBeTruthy();
    });
    screen.unmount();
  });

  it('shows formInvalid banner for local custom-field validation', async () => {
    jest.mocked(apiRequest).mockImplementation(((path: string) => {
      if (path.endsWith('/staff')) return Promise.resolve([makeStaff()]);
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<ServiceForm mode="create" />);
    await waitFor(() => {
      expect(screen.getByTestId('service-price')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText(catalogs.en.business.services.name), 'Cut');
    });
    await fillPrice(screen, '20');
    await act(async () => {
      fireEvent.press(screen.getByTestId('custom-fields-add'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('service-submit'));
    });
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.customFields.errors.formInvalid)).toBeTruthy();
    });
    screen.unmount();
  });

  it('allows unassigning an inactive assigned staff chip', async () => {
    const inactive = makeStaff({
      id: inactiveStaffId,
      displayName: 'Bojan',
      active: false,
    });
    const existing = makeService({ staffMemberIds: [inactiveStaffId] });
    jest.mocked(apiRequest).mockImplementation(((path: string) => {
      if (path.endsWith('/staff')) return Promise.resolve([inactive]);
      if (path.includes('/services/')) return Promise.resolve(existing);
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<ServiceForm mode="edit" serviceId={existing.id} />);
    const chip = await screen.findByTestId(`service-staff-${inactiveStaffId}`);
    expect(chip.props.accessibilityState?.disabled).not.toBe(true);
    await act(async () => {
      fireEvent.press(chip);
    });
    await waitFor(() => {
      expect(chip.props.accessibilityState?.selected).toBe(false);
    });
    screen.unmount();
  });

  it('retries after a load error', async () => {
    let fail = true;
    const existing = makeService({ name: 'Cut' });
    jest.mocked(apiRequest).mockImplementation(((path: string) => {
      if (path.endsWith('/staff')) {
        if (fail) {
          fail = false;
          return Promise.reject(new ApiError('INTERNAL_ERROR', 'boom', 500));
        }
        return Promise.resolve([makeStaff()]);
      }
      if (path.includes('/services/')) return Promise.resolve(existing);
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<ServiceForm mode="edit" serviceId={existing.id} />);
    await waitFor(() => {
      expect(screen.getByLabelText(catalogs.en.business.services.retry)).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText(catalogs.en.business.services.retry));
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue('Cut')).toBeTruthy();
    });
    screen.unmount();
  });

  it('exposes expanded state on the advanced toggle', async () => {
    jest.mocked(apiRequest).mockImplementation(((path: string) => {
      if (path.endsWith('/staff')) return Promise.resolve([makeStaff()]);
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);
    const screen = await renderWithI18n(<ServiceForm mode="create" />);
    await waitFor(() => {
      expect(screen.getByTestId('service-advanced-toggle')).toBeTruthy();
    });
    const toggle = screen.getByTestId('service-advanced-toggle');
    expect(toggle.props.accessibilityState?.expanded).toBe(false);
    await act(async () => {
      fireEvent.press(toggle);
    });
    expect(toggle.props.accessibilityState?.expanded).toBe(true);
    screen.unmount();
  });
});
