import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Business, StaffMember } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react-native';

import { StaffForm } from '@/features/staff/staff-form';
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

jest.mock('@/features/business/business-image-upload', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text: RNText } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    BusinessImageUpload: ({
      currentUrl,
      onChanged,
    }: {
      currentUrl: string | null;
      onChanged: (urls: { photoUrl?: string | null }) => void;
    }) =>
      ReactActual.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: 'remove-photo',
          testID: 'mock-remove-photo',
          onPress: () => onChanged({ photoUrl: null }),
        },
        ReactActual.createElement(RNText, null, currentUrl ?? 'none'),
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

describe('StaffForm', () => {
  it('creates a staff member and replaces to edit with created=1', async () => {
    const created = makeStaff();
    jest.mocked(apiRequest).mockImplementation(((path: string, init?: { method?: string }) => {
      if (path.endsWith('/staff') && init?.method === 'POST') {
        return Promise.resolve(created);
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<StaffForm mode="create" />);
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText(catalogs.en.business.staff.name), 'Ana');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('staff-submit'));
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        `/(business)/business/${baseBusiness.id}/staff/${created.id}?created=1`,
      );
    });
    screen.unmount();
  });

  it('PATCHes edits and shows the saved banner', async () => {
    const existing = makeStaff();
    let patched: unknown;
    jest.mocked(apiRequest).mockImplementation(((
      path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (path.includes('/staff/') && (!init || !init.method || init.method === 'GET')) {
        return Promise.resolve(existing);
      }
      if (path.includes('/staff/') && init?.method === 'PATCH') {
        patched = init.body;
        return Promise.resolve({ ...existing, displayName: 'Ana Markovic' });
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<StaffForm mode="edit" staffId={existing.id} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ana')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText(catalogs.en.business.staff.name), 'Ana Markovic');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('staff-submit'));
    });
    await waitFor(() => {
      expect(patched).toEqual({ displayName: 'Ana Markovic', active: true });
      expect(screen.getByText(catalogs.en.business.staff.savedToast)).toBeTruthy();
    });
    screen.unmount();
  });

  it('shows forbidden for STAFF on create', async () => {
    mockBusinessRef.current = { ...baseBusiness, myRole: 'STAFF' };
    const screen = await renderWithI18n(<StaffForm mode="create" />);
    expect(screen.getByText(catalogs.en.business.staff.forbidden)).toBeTruthy();
    expect(screen.queryByTestId('staff-submit')).toBeNull();
    screen.unmount();
  });

  it('maps VALIDATION_FAILED onto displayName', async () => {
    const existing = makeStaff();
    jest.mocked(apiRequest).mockImplementation(((path: string, init?: { method?: string }) => {
      if (path.includes('/staff/') && (!init || !init.method || init.method === 'GET')) {
        return Promise.resolve(existing);
      }
      if (init?.method === 'PATCH') {
        return Promise.reject(
          new ApiError('VALIDATION_FAILED', 'invalid', 422, {
            issues: [{ path: ['displayName'] }],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<StaffForm mode="edit" staffId={existing.id} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ana')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('staff-submit'));
    });
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.staff.errors.invalid)).toBeTruthy();
    });
    screen.unmount();
  });

  it('clears photo via upload onChanged', async () => {
    const existing = makeStaff({ photoUrl: 'https://cdn.example/staff.jpg' });
    jest.mocked(apiRequest).mockImplementation(((path: string) => {
      if (path.includes('/staff/')) return Promise.resolve(existing);
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    const screen = await renderWithI18n(<StaffForm mode="edit" staffId={existing.id} />);
    await waitFor(() => {
      expect(screen.getByText('https://cdn.example/staff.jpg')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('mock-remove-photo'));
    });
    await waitFor(() => {
      expect(screen.getByText('none')).toBeTruthy();
    });
    screen.unmount();
  });

  it('shows created banner when showCreatedBanner is set', async () => {
    const existing = makeStaff();
    jest.mocked(apiRequest).mockResolvedValue(existing);
    const screen = await renderWithI18n(
      <StaffForm mode="edit" staffId={existing.id} showCreatedBanner />,
    );
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.staff.createdToast)).toBeTruthy();
    });
    screen.unmount();
  });

  it('uses router.back when history exists', async () => {
    const screen = await renderWithI18n(<StaffForm mode="create" />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText(catalogs.en.business.staff.backToList));
    });
    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    screen.unmount();
  });
});
