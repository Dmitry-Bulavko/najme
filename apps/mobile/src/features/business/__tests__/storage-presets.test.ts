import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';

import {
  APP_MODE_STORAGE_KEY,
  LAST_BUSINESS_STORAGE_KEY,
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
import { mapWithConcurrency } from '@/features/business/load-checklist';

beforeEach(async () => {
  await AsyncStorage.clear();
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
