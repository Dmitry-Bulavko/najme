import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Business, MyBusiness, StaffMember, TimeOff } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { act, cleanup, fireEvent, waitFor, within } from '@testing-library/react-native';

import { StaffScheduleView } from '@/features/schedule/staff-schedule-view';
import { ApiError, apiRequest } from '@/lib/api/client';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => false);
const mockConfirm = jest.fn<(options: unknown) => Promise<boolean>>();
const mockFocusCallbacks: Array<() => void> = [];

const businessId = '11111111-1111-4111-8111-111111111111';
const staffId = '33333333-3333-4333-8333-333333333333';
const otherStaffId = '44444444-4444-4444-8444-444444444444';

const mockBaseBusiness: Business = {
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

let mockRole: Business['myRole'] = 'OWNER';
let mockMemberships: MyBusiness[] = [];
let mockMembershipsLoading = false;
let mockMembershipsError = false;

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({
      push: mockPush,
      replace: mockReplace,
      back: mockBack,
      canGoBack: () => mockCanGoBack(),
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
    business: { ...mockBaseBusiness, myRole: mockRole },
    setBusiness: jest.fn(),
    reload: jest.fn(async () => undefined),
  }),
}));

jest.mock('@/features/business/use-my-businesses', () => ({
  useMyBusinesses: () => ({
    data: mockMemberships,
    isLoading: mockMembershipsLoading,
    isError: mockMembershipsError,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/components/ui/confirm', () => ({
  confirm: (options: unknown) => mockConfirm(options),
}));

const dtpCallbacks: { onChange?: (event: { type: string }, date?: Date) => void } = {};

jest.mock('@react-native-community/datetimepicker', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock factory
  const React = require('react') as typeof import('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock factory
  const { View } = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({ onChange }: { onChange: (event: { type: string }, date?: Date) => void }) => {
      dtpCallbacks.onChange = onChange;
      return React.createElement(View, { testID: 'mock-datetimepicker' });
    },
  };
});

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiRequest: jest.fn(),
  };
});

function makeMember(overrides: Partial<StaffMember> = {}): StaffMember {
  return {
    id: staffId,
    businessId,
    displayName: 'Ana',
    photoUrl: null,
    active: true,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeTimeOff(overrides: Partial<TimeOff> = {}): TimeOff {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    staffMemberId: staffId,
    startsAt: '2099-08-01T08:00:00.000Z',
    endsAt: '2099-08-02T08:00:00.000Z',
    reason: null,
    conflictingBookings: [],
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

function routeFor(path: string): unknown {
  if (path === `/businesses/${businessId}/staff/${staffId}`) return makeMember();
  if (path === `/businesses/${businessId}/staff/${staffId}/working-hours`) {
    return { intervals: [{ weekday: 'MONDAY', start: '09:00', end: '17:00' }] };
  }
  if (path.startsWith(`/businesses/${businessId}/staff/${staffId}/time-off`)) {
    return [];
  }
  throw new Error(`Unexpected path ${path}`);
}

beforeAll(async () => {
  await initTestI18n('en');
});

beforeEach(() => {
  cleanup();
  mockFocusCallbacks.length = 0;
  mockReplace.mockReset();
  mockPush.mockReset();
  mockBack.mockReset();
  mockCanGoBack.mockReset();
  mockCanGoBack.mockReturnValue(false);
  mockConfirm.mockReset();
  mockConfirm.mockResolvedValue(true);
  jest.mocked(apiRequest).mockReset();
  jest.mocked(apiRequest).mockImplementation(((path: string) => {
    return Promise.resolve(routeFor(String(path)));
  }) as typeof apiRequest);
  mockRole = 'OWNER';
  mockMemberships = [];
  mockMembershipsLoading = false;
  mockMembershipsError = false;
});

describe('StaffScheduleView', () => {
  it('loads hours and shows timezone + editor', async () => {
    const screen = await renderWithI18n(<StaffScheduleView staffId={staffId} />);
    expect(await screen.findByTestId('staff-schedule')).toBeTruthy();
    expect(screen.getByTestId('timezone-label')).toBeTruthy();
    expect(screen.getByTestId('working-hours-editor')).toBeTruthy();
    expect(screen.getByTestId('time-off-section')).toBeTruthy();
    screen.unmount();
  });

  it('PUTs replace-all body on save', async () => {
    jest.mocked(apiRequest).mockImplementation(((
      path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (init?.method === 'PUT') {
        return Promise.resolve({ intervals: (init.body as { intervals: unknown }).intervals });
      }
      return Promise.resolve(routeFor(String(path)));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<StaffScheduleView staffId={staffId} />);
    await screen.findByTestId('save-hours');
    fireEvent.press(screen.getByTestId('save-hours'));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/businesses/${businessId}/staff/${staffId}/working-hours`,
        expect.objectContaining({
          method: 'PUT',
          body: {
            intervals: [{ weekday: 'MONDAY', start: '09:00', end: '17:00' }],
          },
        }),
      );
    });
    expect(await screen.findByText(catalogs.en.business.schedule.hours.savedToast)).toBeTruthy();
    screen.unmount();
  });

  it('maps PUT VALIDATION_FAILED details.issues onto rows and keeps the editor', async () => {
    jest.mocked(apiRequest).mockImplementation(((path: string, init?: { method?: string }) => {
      if (init?.method === 'PUT') {
        return Promise.reject(
          new ApiError('VALIDATION_FAILED', 'invalid', 422, {
            issues: [{ path: ['intervals', 0, 'end'], message: 'bad' }],
          }),
        );
      }
      return Promise.resolve(routeFor(String(path)));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<StaffScheduleView staffId={staffId} />);
    await screen.findByTestId('save-hours');
    fireEvent.press(screen.getByTestId('save-hours'));

    expect(
      await screen.findByText(catalogs.en.business.schedule.hours.validationError),
    ).toBeTruthy();
    expect(
      screen.getAllByText(catalogs.en.business.schedule.hours.rowValidationError).length,
    ).toBeGreaterThan(0);
    expect(screen.getByTestId('working-hours-editor')).toBeTruthy();
    screen.unmount();
  });

  it('keeps the editor mounted when save fails with a non-validation error', async () => {
    jest.mocked(apiRequest).mockImplementation(((path: string, init?: { method?: string }) => {
      if (init?.method === 'PUT') {
        return Promise.reject(new ApiError('INTERNAL_ERROR', 'boom', 500));
      }
      return Promise.resolve(routeFor(String(path)));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<StaffScheduleView staffId={staffId} />);
    await screen.findByTestId('save-hours');
    fireEvent.press(screen.getByTestId('save-hours'));

    expect(await screen.findByText(catalogs.en.errors.INTERNAL_ERROR)).toBeTruthy();
    expect(screen.getByTestId('working-hours-editor')).toBeTruthy();
    expect(screen.getByTestId('staff-schedule')).toBeTruthy();
    screen.unmount();
  });

  async function setDateField(
    screen: Awaited<ReturnType<typeof renderWithI18n>>,
    testID: string,
    date: Date,
  ): Promise<void> {
    const field = screen.getByTestId(testID);
    fireEvent.press(within(field).getByRole('button'));
    await screen.findByTestId('mock-datetimepicker');
    await act(async () => {
      dtpCallbacks.onChange?.({ type: 'set' }, date);
    });
  }

  it('creates all-day time off with next-day 00:00', async () => {
    const created = makeTimeOff();
    jest.mocked(apiRequest).mockImplementation(((
      path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (init?.method === 'POST' && String(path).endsWith('/time-off')) {
        return Promise.resolve(created);
      }
      return Promise.resolve(routeFor(String(path)));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<StaffScheduleView staffId={staffId} />);
    fireEvent.press(await screen.findByTestId('add-time-off'));
    expect(await screen.findByTestId('time-off-dialog')).toBeTruthy();
    await setDateField(screen, 'time-off-start-date', new Date(2026, 8, 10));
    await setDateField(screen, 'time-off-end-date', new Date(2026, 8, 10));
    fireEvent.press(screen.getByTestId('time-off-create'));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/businesses/${businessId}/staff/${staffId}/time-off`,
        expect.objectContaining({
          method: 'POST',
          body: {
            start: '2026-09-10T00:00',
            end: '2026-09-11T00:00',
          },
        }),
      );
    });
    screen.unmount();
  });

  it('keeps the create dialog open when POST fails', async () => {
    jest.mocked(apiRequest).mockImplementation(((path: string, init?: { method?: string }) => {
      if (init?.method === 'POST' && String(path).endsWith('/time-off')) {
        return Promise.reject(new ApiError('INTERNAL_ERROR', 'boom', 500));
      }
      return Promise.resolve(routeFor(String(path)));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<StaffScheduleView staffId={staffId} />);
    fireEvent.press(await screen.findByTestId('add-time-off'));
    await screen.findByTestId('time-off-dialog');
    await setDateField(screen, 'time-off-start-date', new Date(2026, 8, 10));
    await setDateField(screen, 'time-off-end-date', new Date(2026, 8, 10));
    fireEvent.press(screen.getByTestId('time-off-create'));

    expect(await screen.findByText(catalogs.en.errors.INTERNAL_ERROR)).toBeTruthy();
    expect(screen.getByTestId('time-off-dialog')).toBeTruthy();
    expect(screen.getByTestId('working-hours-editor')).toBeTruthy();
    screen.unmount();
  });

  it('deletes upcoming time off via confirm', async () => {
    const entry = makeTimeOff();
    jest.mocked(apiRequest).mockImplementation(((path: string, init?: { method?: string }) => {
      if (String(path).includes('/time-off/') && init?.method === 'DELETE') {
        return Promise.resolve(undefined);
      }
      if (String(path).startsWith(`/businesses/${businessId}/staff/${staffId}/time-off`)) {
        return Promise.resolve([entry]);
      }
      return Promise.resolve(routeFor(String(path)));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<StaffScheduleView staffId={staffId} />);
    expect(await screen.findByTestId(`delete-time-off-${entry.id}`)).toBeTruthy();
    fireEvent.press(screen.getByTestId(`delete-time-off-${entry.id}`));

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/businesses/${businessId}/staff/${staffId}/time-off/${entry.id}`,
        { method: 'DELETE' },
      );
    });
    screen.unmount();
  });

  it('keeps the editor when delete fails', async () => {
    const entry = makeTimeOff();
    jest.mocked(apiRequest).mockImplementation(((path: string, init?: { method?: string }) => {
      if (String(path).includes('/time-off/') && init?.method === 'DELETE') {
        return Promise.reject(new ApiError('INTERNAL_ERROR', 'boom', 500));
      }
      if (String(path).startsWith(`/businesses/${businessId}/staff/${staffId}/time-off`)) {
        return Promise.resolve([entry]);
      }
      return Promise.resolve(routeFor(String(path)));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<StaffScheduleView staffId={staffId} />);
    await screen.findByTestId(`delete-time-off-${entry.id}`);
    fireEvent.press(screen.getByTestId(`delete-time-off-${entry.id}`));

    expect(await screen.findByText(catalogs.en.errors.INTERNAL_ERROR)).toBeTruthy();
    expect(screen.getByTestId('working-hours-editor')).toBeTruthy();
    screen.unmount();
  });

  it('blocks STAFF from another staff member schedule', async () => {
    mockRole = 'STAFF';
    mockMemberships = [
      {
        businessId,
        name: mockBaseBusiness.name,
        slug: mockBaseBusiness.slug,
        role: 'STAFF',
        staffMemberId: otherStaffId,
        status: 'APPROVED',
        logoUrl: null,
      },
    ];

    const screen = await renderWithI18n(<StaffScheduleView staffId={staffId} />);
    expect(await screen.findByTestId('schedule-forbidden')).toBeTruthy();
    expect(screen.getByText(catalogs.en.business.schedule.forbidden)).toBeTruthy();
    expect(apiRequest).not.toHaveBeenCalled();
    screen.unmount();
  });

  it('does not spin forever for OWNER when memberships fail', async () => {
    mockMembershipsError = true;
    mockMembershipsLoading = false;
    const screen = await renderWithI18n(<StaffScheduleView staffId={staffId} />);
    expect(await screen.findByTestId('staff-schedule')).toBeTruthy();
    screen.unmount();
  });

  it('reloads on focus', async () => {
    const screen = await renderWithI18n(<StaffScheduleView staffId={staffId} />);
    await screen.findByTestId('staff-schedule');
    const callsBefore = jest.mocked(apiRequest).mock.calls.length;
    expect(mockFocusCallbacks.length).toBeGreaterThan(0);
    await act(async () => {
      mockFocusCallbacks[mockFocusCallbacks.length - 1]?.();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(jest.mocked(apiRequest).mock.calls.length).toBeGreaterThan(callsBefore);
    });
    screen.unmount();
  });

  it('goes back to picker with back() when possible', async () => {
    mockCanGoBack.mockReturnValue(true);
    const screen = await renderWithI18n(<StaffScheduleView staffId={staffId} />);
    await screen.findByTestId('back-to-picker');
    fireEvent.press(screen.getByTestId('back-to-picker'));
    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    screen.unmount();
  });
});
