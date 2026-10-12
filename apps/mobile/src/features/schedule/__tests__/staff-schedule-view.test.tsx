import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Business, MyBusiness, StaffMember, WorkingHoursInterval } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { cleanup, fireEvent, waitFor } from '@testing-library/react-native';

import { StaffScheduleView } from '@/features/schedule/staff-schedule-view';
import { apiRequest } from '@/lib/api/client';
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
const mockMembershipsRef: {
  current: {
    data: MyBusiness[] | undefined;
    isLoading: boolean;
    isError: boolean;
  };
} = {
  current: { data: [], isLoading: false, isError: false },
};

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

jest.mock('@/features/business/use-my-businesses', () => ({
  useMyBusinesses: () => ({
    get data() {
      return mockMembershipsRef.current.data;
    },
    get isLoading() {
      return mockMembershipsRef.current.isLoading;
    },
    get isError() {
      return mockMembershipsRef.current.isError;
    },
    refetch: jest.fn(),
  }),
}));

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiRequest: jest.fn(),
  };
});

const staffId = '33333333-3333-4333-8333-333333333333';

function makeMember(): StaffMember {
  return {
    id: staffId,
    businessId: baseBusiness.id,
    displayName: 'Ana',
    photoUrl: null,
    active: true,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
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
  mockMembershipsRef.current = { data: [], isLoading: false, isError: false };
});

describe('StaffScheduleView', () => {
  it('loads hours and shows timezone + editor', async () => {
    const intervals: WorkingHoursInterval[] = [{ weekday: 'MONDAY', start: '09:00', end: '17:00' }];
    jest.mocked(apiRequest).mockImplementation(((path: string) => {
      if (path.endsWith(`/staff/${staffId}`)) return Promise.resolve(makeMember());
      if (path.endsWith('/working-hours')) return Promise.resolve({ intervals });
      if (path.includes('/time-off')) return Promise.resolve([]);
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<StaffScheduleView staffId={staffId} />);
    expect(await screen.findByTestId('staff-schedule')).toBeTruthy();
    expect(screen.getByTestId('timezone-label')).toBeTruthy();
    expect(screen.getByTestId('working-hours-editor')).toBeTruthy();
    expect(screen.getByTestId('time-off-section')).toBeTruthy();
    screen.unmount();
  });

  it('blocks STAFF from another staff member schedule', async () => {
    mockBusinessRef.current = { ...baseBusiness, myRole: 'STAFF' };
    mockMembershipsRef.current = {
      data: [
        {
          businessId: baseBusiness.id,
          name: baseBusiness.name,
          slug: baseBusiness.slug,
          role: 'STAFF',
          staffMemberId: '44444444-4444-4444-8444-444444444444',
          status: 'APPROVED',
          logoUrl: null,
        },
      ],
      isLoading: false,
      isError: false,
    };

    const screen = await renderWithI18n(<StaffScheduleView staffId={staffId} />);
    expect(await screen.findByTestId('schedule-forbidden')).toBeTruthy();
    expect(screen.getByText(catalogs.en.business.schedule.forbidden)).toBeTruthy();
    expect(apiRequest).not.toHaveBeenCalled();
    screen.unmount();
  });

  it('saves working hours via PUT', async () => {
    const intervals: WorkingHoursInterval[] = [{ weekday: 'MONDAY', start: '09:00', end: '17:00' }];
    jest.mocked(apiRequest).mockImplementation(((path: string, init?: { method?: string }) => {
      if (path.endsWith(`/staff/${staffId}`) && !init?.method) {
        return Promise.resolve(makeMember());
      }
      if (path.endsWith('/working-hours') && init?.method === 'PUT') {
        return Promise.resolve({ intervals });
      }
      if (path.endsWith('/working-hours')) return Promise.resolve({ intervals });
      if (path.includes('/time-off')) return Promise.resolve([]);
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<StaffScheduleView staffId={staffId} />);
    await screen.findByTestId('save-hours');
    fireEvent.press(screen.getByTestId('save-hours'));
    await waitFor(() => {
      expect(jest.mocked(apiRequest)).toHaveBeenCalledWith(
        expect.stringContaining('/working-hours'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });
    expect(await screen.findByText(catalogs.en.business.schedule.hours.savedToast)).toBeTruthy();
    screen.unmount();
  });
});
