import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Business, MembershipRole, MyBusiness, StaffMember } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react-native';

import { SchedulePicker } from '@/features/schedule/schedule-picker';
import { apiRequest } from '@/lib/api/client';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockRouter = {
  push: (...args: unknown[]) => mockPush(...args),
  replace: (...args: unknown[]) => mockReplace(...args),
  back: jest.fn(),
  canGoBack: () => true,
};

const baseBusiness: Omit<Business, 'myRole'> = {
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
};

let mockRole: MembershipRole = 'OWNER';
let mockMemberships: MyBusiness[] = [];

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => mockRouter,
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactActual.useEffect(() => {
        const cleanupFn = callback();
        return typeof cleanupFn === 'function' ? cleanupFn : undefined;
      }, [callback]);
    },
  };
});

jest.mock('@/features/business/business-provider', () => ({
  useBusinessContext: () => ({
    business: { ...baseBusiness, myRole: mockRole },
    setBusiness: jest.fn(),
    reload: jest.fn(async () => undefined),
  }),
}));

jest.mock('@/features/business/use-my-businesses', () => ({
  useMyBusinesses: () => ({
    data: mockMemberships,
    isLoading: false,
    isError: false,
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

function staffMembership(staffMemberId: string | null): MyBusiness {
  return {
    businessId: baseBusiness.id,
    name: baseBusiness.name,
    slug: baseBusiness.slug,
    role: 'STAFF',
    staffMemberId,
    status: 'APPROVED',
    logoUrl: null,
  };
}

beforeAll(async () => {
  await initTestI18n('en');
});

beforeEach(async () => {
  cleanup();
  await act(async () => {
    await Promise.resolve();
  });
  mockReplace.mockReset();
  mockPush.mockReset();
  jest.mocked(apiRequest).mockReset();
  mockRole = 'OWNER';
  mockMemberships = [];
});

describe('SchedulePicker', () => {
  it('redirects linked STAFF to their schedule', async () => {
    const linkedId = '33333333-3333-4333-8333-333333333333';
    mockRole = 'STAFF';
    mockMemberships = [staffMembership(linkedId)];

    const screen = await renderWithI18n(<SchedulePicker />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        `/(business)/business/${baseBusiness.id}/schedule/${linkedId}`,
      );
    });
    screen.unmount();
  });

  it('shows no-linked state for unlinked STAFF', async () => {
    mockRole = 'STAFF';
    mockMemberships = [staffMembership(null)];

    const screen = await renderWithI18n(<SchedulePicker />);
    expect(await screen.findByTestId('schedule-no-linked')).toBeTruthy();
    expect(screen.getByText(catalogs.en.business.schedule.noLinkedStaff)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    screen.unmount();
  });

  it('shows empty CTA for OWNER when there is no staff', async () => {
    jest.mocked(apiRequest).mockResolvedValue([]);
    const screen = await renderWithI18n(<SchedulePicker />);
    expect(await screen.findByText(catalogs.en.business.schedule.pickerEmpty)).toBeTruthy();
    expect(screen.getByTestId('picker-empty-cta')).toBeTruthy();
    expect(screen.getByTestId('timezone-label')).toBeTruthy();
    screen.unmount();
  });

  it('lists staff and opens a schedule', async () => {
    const member: StaffMember = {
      id: '33333333-3333-4333-8333-333333333333',
      businessId: baseBusiness.id,
      displayName: 'Ana',
      photoUrl: null,
      active: true,
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-01T10:00:00.000Z',
    };
    jest.mocked(apiRequest).mockResolvedValue([member]);
    const screen = await renderWithI18n(<SchedulePicker />);
    expect(await screen.findByText('Ana')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId(`open-schedule-${member.id}`));
    });
    expect(mockPush).toHaveBeenCalledWith(
      `/(business)/business/${baseBusiness.id}/schedule/${member.id}`,
    );
    screen.unmount();
  });
});
