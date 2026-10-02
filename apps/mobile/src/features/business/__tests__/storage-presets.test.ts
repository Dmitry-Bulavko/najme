import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  APP_MODE_STORAGE_KEY,
  LAST_BUSINESS_STORAGE_KEY,
  clearAppMode,
  clearLastBusinessId,
  readAppMode,
  readLastBusinessId,
  writeAppMode,
  writeLastBusinessId,
} from '@/features/business/last-business';
import {
  formatHorizonLabel,
  formatMinutesLabel,
  optionsWithCurrentValue,
} from '@/features/business/booking-presets';
import { loadChecklist, mapWithConcurrency } from '@/features/business/load-checklist';
import { apiRequest } from '@/lib/api/client';

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiRequest: jest.fn(),
  };
});

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.mocked(apiRequest).mockReset();
});

describe('last-business / app mode storage', () => {
  it('reads and writes last business id', async () => {
    expect(await readLastBusinessId()).toBeNull();
    await writeLastBusinessId('biz-1');
    expect(await AsyncStorage.getItem(LAST_BUSINESS_STORAGE_KEY)).toBe('biz-1');
    expect(await readLastBusinessId()).toBe('biz-1');
    await clearLastBusinessId();
    expect(await readLastBusinessId()).toBeNull();
  });

  it('defaults app mode to client and persists business', async () => {
    expect(await readAppMode()).toBe('client');
    await writeAppMode('business');
    expect(await AsyncStorage.getItem(APP_MODE_STORAGE_KEY)).toBe('business');
    expect(await readAppMode()).toBe('business');
    await writeAppMode('client');
    expect(await readAppMode()).toBe('client');
  });

  it('clearAppMode removes the key', async () => {
    await writeAppMode('business');
    await clearAppMode();
    expect(await AsyncStorage.getItem(APP_MODE_STORAGE_KEY)).toBeNull();
    expect(await readAppMode()).toBe('client');
  });
});

describe('booking-presets', () => {
  const t = ((key: string, values?: { count: number }) => {
    if (key === 'settings.durationNone') return 'None';
    if (key === 'settings.durationMinutes') return `${values?.count ?? 0}m`;
    if (key === 'settings.durationHours') return `${values?.count ?? 0}h`;
    if (key === 'settings.durationDays') return `${values?.count ?? 0}d`;
    return key;
  }) as Parameters<typeof formatMinutesLabel>[1];

  it('includes a non-preset current value', () => {
    expect(optionsWithCurrentValue([0, 30, 60], 45)).toEqual([0, 30, 45, 60]);
    expect(optionsWithCurrentValue([0, 30, 60], 30)).toEqual([0, 30, 60]);
  });

  it('formats minute and day labels', () => {
    expect(formatMinutesLabel(0, t)).toBe('None');
    expect(formatMinutesLabel(45, t)).toBe('45m');
    expect(formatMinutesLabel(120, t)).toBe('2h');
    expect(formatMinutesLabel(1440, t)).toBe('1d');
    expect(formatHorizonLabel(60, t)).toBe('60d');
  });
});

describe('mapWithConcurrency', () => {
  it('preserves order with bounded concurrency', async () => {
    const seen: number[] = [];
    const result = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => {
      seen.push(n);
      await new Promise((r) => setTimeout(r, 5));
      return n * 10;
    });
    expect(result).toEqual([10, 20, 30, 40]);
    expect(seen.sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('loadChecklist', () => {
  it('maps business, staff, services and hours into checklist flags', async () => {
    const businessId = '11111111-1111-4111-8111-111111111111';
    const staffId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    jest.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (path === `/businesses/${businessId}`) {
        return {
          id: businessId,
          name: 'Salon',
          slug: 'salon',
          status: 'APPROVED',
          categoryId: '22222222-2222-4222-8222-222222222222',
          city: 'PODGORICA',
          description: null,
          address: null,
          contactPhone: null,
          contactEmail: null,
          logoUrl: 'https://cdn.example/logo.jpg',
          coverUrl: null,
          timezone: 'Europe/Podgorica',
          confirmationMode: 'AUTO',
          cancellationWindowMinutes: 0,
          minBookingNoticeMinutes: 0,
          bookingHorizonDays: 30,
          rejectionReason: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          myRole: 'OWNER',
        };
      }
      if (path === `/businesses/${businessId}/staff`) {
        return [
          {
            id: staffId,
            businessId,
            displayName: 'Ada',
            photoUrl: null,
            active: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ];
      }
      if (path === `/businesses/${businessId}/services`) {
        return [
          {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            businessId,
            name: 'Cut',
            description: null,
            durationMinutes: 30,
            bufferBeforeMinutes: 0,
            bufferAfterMinutes: 0,
            price: { amount: 1000, currency: 'EUR' },
            minBookingNoticeMinutes: null,
            bookingHorizonDays: null,
            active: true,
            staffMemberIds: [staffId],
            customFields: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ];
      }
      if (path === `/businesses/${businessId}/staff/${staffId}/working-hours`) {
        return {
          intervals: [{ weekday: 'MONDAY', start: '09:00', end: '17:00' }],
        };
      }
      throw new Error(`unexpected ${path}`);
    });

    await expect(loadChecklist(businessId)).resolves.toEqual({
      hasLogo: true,
      hasStaff: true,
      hasServiceWithStaff: true,
      allActiveHaveHours: true,
    });
  });
});
