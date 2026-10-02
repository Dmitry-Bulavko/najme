import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Business } from '@najme/contracts';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { BusinessImageUpload } from '@/features/business/business-image-upload';
import { BusinessStatusBanner } from '@/features/business/business-status-banner';
import { apiRequest } from '@/lib/api/client';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';
import {
  formatHorizonLabel,
  formatMinutesLabel,
  optionsWithCurrentValue,
} from '@/features/business/booking-presets';
import { enterBusinessMode, enterClientMode } from '@/features/business/enter-mode';
import { writeAppMode, writeLastBusinessId } from '@/features/business/last-business';

const mockReplace = jest.fn();
const mockPush = jest.fn();

const baseBusiness: Business = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Salon Ada',
  slug: 'salon-ada',
  status: 'REJECTED',
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
  rejectionReason: 'Fix the logo',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  myRole: 'OWNER',
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiRequest: jest.fn(),
  };
});

jest.mock('@/features/business/last-business', () => {
  const actual = jest.requireActual<typeof import('@/features/business/last-business')>(
    '@/features/business/last-business',
  );
  return {
    ...actual,
    writeAppMode: jest.fn(async () => undefined),
    writeLastBusinessId: jest.fn(async () => undefined),
  };
});

beforeAll(async () => {
  await initTestI18n('en');
});

beforeEach(() => {
  mockReplace.mockReset();
  mockPush.mockReset();
  jest.mocked(apiRequest).mockReset();
  jest.mocked(writeAppMode).mockClear();
  jest.mocked(writeLastBusinessId).mockClear();
});

describe('BusinessStatusBanner', () => {
  it('resubmits a REJECTED business for OWNER/ADMIN', async () => {
    const onUpdated = jest.fn();
    jest.mocked(apiRequest).mockResolvedValue({
      ...baseBusiness,
      status: 'PENDING_APPROVAL',
      rejectionReason: null,
    });

    const screen = await renderWithI18n(
      <BusinessStatusBanner business={baseBusiness} onUpdated={onUpdated} />,
    );

    expect(screen.getByTestId('business-resubmit')).toBeTruthy();
    fireEvent.press(screen.getByTestId('business-resubmit'));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/businesses/${baseBusiness.id}/resubmit`,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(onUpdated).toHaveBeenCalled();
    });
  });

  it('hides resubmit for STAFF', async () => {
    const screen = await renderWithI18n(
      <BusinessStatusBanner
        business={{ ...baseBusiness, myRole: 'STAFF' }}
        onUpdated={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('business-resubmit')).toBeNull();
  });
});

describe('BusinessImageUpload', () => {
  it('hides upload controls on web export', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const screen = await renderWithI18n(
      <BusinessImageUpload
        businessId={baseBusiness.id}
        kind="LOGO"
        currentUrl={null}
        frame="square"
        onChanged={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('upload-logo')).toBeNull();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
  });
});

describe('enterBusinessMode', () => {
  it('opens create when the user has no businesses', async () => {
    await enterBusinessMode({ push: mockPush, replace: mockReplace }, []);
    expect(writeAppMode).toHaveBeenCalledWith('business');
    expect(mockPush).toHaveBeenCalledWith('/(business)/new');
  });

  it('opens the only business directly', async () => {
    await enterBusinessMode({ push: mockPush, replace: mockReplace }, [
      {
        businessId: baseBusiness.id,
        name: 'Salon Ada',
        slug: 'salon-ada',
        status: 'PENDING_APPROVAL',
        role: 'OWNER',
        staffMemberId: null,
        logoUrl: null,
      },
    ]);
    expect(writeLastBusinessId).toHaveBeenCalledWith(baseBusiness.id);
    expect(mockReplace).toHaveBeenCalledWith(`/(business)/${baseBusiness.id}`);
  });

  it('forces the picker when requested', async () => {
    await enterBusinessMode(
      { push: mockPush, replace: mockReplace },
      [
        {
          businessId: baseBusiness.id,
          name: 'A',
          slug: 'a',
          status: 'APPROVED',
          role: 'OWNER',
          staffMemberId: null,
          logoUrl: null,
        },
        {
          businessId: '33333333-3333-4333-8333-333333333333',
          name: 'B',
          slug: 'b',
          status: 'APPROVED',
          role: 'ADMIN',
          staffMemberId: null,
          logoUrl: null,
        },
      ],
      { forcePick: true },
    );
    expect(mockPush).toHaveBeenCalledWith('/(business)/pick');
  });
});

describe('enterClientMode', () => {
  it('persists client mode and returns to account', async () => {
    await enterClientMode({ replace: mockReplace });
    expect(writeAppMode).toHaveBeenCalledWith('client');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/account');
  });
});

describe('booking-presets helpers', () => {
  const t = ((key: string, values?: { count: number }) => {
    if (key === 'settings.durationNone') return 'None';
    if (key === 'settings.durationMinutes') return `${values?.count ?? 0}m`;
    if (key === 'settings.durationHours') return `${values?.count ?? 0}h`;
    if (key === 'settings.durationDays') return `${values?.count ?? 0}d`;
    return key;
  }) as Parameters<typeof formatMinutesLabel>[1];

  it('keeps non-preset values selectable', () => {
    expect(optionsWithCurrentValue([0, 30, 60], 45)).toEqual([0, 30, 45, 60]);
  });

  it('formats duration labels', () => {
    expect(formatMinutesLabel(120, t)).toBe('2h');
    expect(formatHorizonLabel(60, t)).toBe('60d');
  });
});
