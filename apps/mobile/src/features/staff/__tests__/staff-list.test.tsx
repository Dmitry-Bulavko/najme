import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Business, StaffMember } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { cleanup, fireEvent, waitFor } from '@testing-library/react-native';

import { StaffList } from '@/features/staff/staff-list';
import { apiRequest } from '@/lib/api/client';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

const mockPush = jest.fn();
const mockConfirm = jest.fn<(options: unknown) => Promise<boolean>>();

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
    push: mockPush,
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

beforeAll(async () => {
  await initTestI18n('en');
});

beforeEach(() => {
  cleanup();
  mockPush.mockReset();
  mockConfirm.mockReset();
  mockConfirm.mockResolvedValue(true);
  jest.mocked(apiRequest).mockReset();
  mockBusinessRef.current = { ...baseBusiness, myRole: 'OWNER' };
});

describe('StaffList', () => {
  it('shows empty CTA for OWNER', async () => {
    jest.mocked(apiRequest).mockImplementation(((path: string) => {
      if (path.endsWith('/staff')) return Promise.resolve([]);
      if (path.endsWith('/members')) return Promise.resolve([]);
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);
    const screen = await renderWithI18n(<StaffList />);
    expect(await screen.findByText(catalogs.en.business.staff.empty)).toBeTruthy();
    expect(screen.getByLabelText(catalogs.en.business.staff.emptyCta)).toBeTruthy();
    expect(screen.getByTestId('staff-add')).toBeTruthy();
    screen.unmount();
  });

  it('hides manage actions for STAFF', async () => {
    mockBusinessRef.current = { ...baseBusiness, myRole: 'STAFF' };
    jest.mocked(apiRequest).mockImplementation(((path: string) => {
      if (path.endsWith('/staff')) return Promise.resolve([makeStaff()]);
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);
    const screen = await renderWithI18n(<StaffList />);
    expect(await screen.findByText('Ana')).toBeTruthy();
    expect(screen.queryByTestId('staff-add')).toBeNull();
    expect(screen.queryByLabelText(catalogs.en.business.staff.edit)).toBeNull();
    expect(screen.queryByLabelText(catalogs.en.business.staff.delete)).toBeNull();
    expect(
      screen.getByText(
        catalogs.en.business.staff.linkedLabel.replace(
          '{name}',
          catalogs.en.business.staff.notLinked,
        ),
      ),
    ).toBeTruthy();
    screen.unmount();
  });

  it('deletes after confirm()', async () => {
    jest.mocked(apiRequest).mockImplementation(((path: string, init?: { method?: string }) => {
      if (path.endsWith('/members')) return Promise.resolve([]);
      if (path.endsWith('/staff') && (!init || !init.method || init.method === 'GET')) {
        return Promise.resolve([makeStaff()]);
      }
      if (init?.method === 'DELETE') return Promise.resolve(undefined);
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);
    const screen = await renderWithI18n(<StaffList />);
    expect(await screen.findByText('Ana')).toBeTruthy();
    fireEvent.press(screen.getByTestId('staff-delete-33333333-3333-4333-8333-333333333333'));
    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.staff.deletedToast)).toBeTruthy();
    });
    expect(screen.queryByText('Ana')).toBeNull();
    screen.unmount();
  });

  it('does not delete when confirm is cancelled', async () => {
    mockConfirm.mockResolvedValue(false);
    jest.mocked(apiRequest).mockImplementation(((path: string) => {
      if (path.endsWith('/members')) return Promise.resolve([]);
      if (path.endsWith('/staff')) return Promise.resolve([makeStaff()]);
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);
    const screen = await renderWithI18n(<StaffList />);
    expect(await screen.findByText('Ana')).toBeTruthy();
    fireEvent.press(screen.getByTestId('staff-delete-33333333-3333-4333-8333-333333333333'));
    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
    });
    expect(jest.mocked(apiRequest).mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(
      false,
    );
    expect(screen.getByText('Ana')).toBeTruthy();
    screen.unmount();
  });
});
