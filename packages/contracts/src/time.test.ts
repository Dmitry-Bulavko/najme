import { describe, expect, it } from 'vitest';

import {
  businessLocalDateTimeSchema,
  createTimeOffRequestSchema,
  putWorkingHoursRequestSchema,
} from './schedule.js';
import {
  formatHhMm,
  hhMmEndToMinutes,
  isValidIntervalEnd,
  isValidIntervalStart,
  minutesToHhMmEnd,
  parseHhMm,
  parseHhMmEnd,
  snapHhMm,
} from './time.js';

describe('parseHhMm', () => {
  it('parses valid HH:mm', () => {
    expect(parseHhMm('09:30')).toEqual({ hours: 9, minutes: 30 });
    expect(parseHhMm('23:59')).toEqual({ hours: 23, minutes: 59 });
  });

  it('rejects invalid values', () => {
    expect(parseHhMm('9:30')).toBeNull();
    expect(parseHhMm('24:00')).toBeNull();
    expect(parseHhMm('12:60')).toBeNull();
    expect(parseHhMm('')).toBeNull();
  });
});

describe('parseHhMmEnd / hhMmEndToMinutes / minutesToHhMmEnd', () => {
  it('accepts 24:00 as end of day', () => {
    expect(parseHhMmEnd('24:00')).toEqual({ hours: 24, minutes: 0 });
    expect(hhMmEndToMinutes('24:00')).toBe(1440);
    expect(minutesToHhMmEnd(1440)).toBe('24:00');
  });

  it('rejects 24:00 as an interval start', () => {
    expect(isValidIntervalStart('24:00')).toBe(false);
    expect(isValidIntervalEnd('24:00')).toBe(true);
  });
});

describe('formatHhMm', () => {
  it('pads single-digit values', () => {
    expect(formatHhMm(0, 0)).toBe('00:00');
    expect(formatHhMm(9, 5)).toBe('09:05');
  });
});

describe('snapHhMm', () => {
  it('snaps to a 5-minute grid', () => {
    expect(snapHhMm('09:02')).toBe('09:00');
    expect(snapHhMm('09:03')).toBe('09:05');
    expect(snapHhMm('09:07')).toBe('09:05');
    expect(snapHhMm('09:08')).toBe('09:10');
  });

  it('clamps to 23:55 instead of wrapping to 00:00', () => {
    expect(snapHhMm('23:58')).toBe('23:55');
    expect(snapHhMm('23:57')).toBe('23:55');
  });

  it('returns null for invalid input', () => {
    expect(snapHhMm('')).toBeNull();
    expect(snapHhMm('9:30')).toBeNull();
  });
});

describe('putWorkingHoursRequestSchema', () => {
  it('allows touching intervals on the same weekday', () => {
    const parsed = putWorkingHoursRequestSchema.safeParse({
      intervals: [
        { weekday: 'MONDAY', start: '09:00', end: '12:00' },
        { weekday: 'MONDAY', start: '12:00', end: '17:00' },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects overlapping intervals', () => {
    const parsed = putWorkingHoursRequestSchema.safeParse({
      intervals: [
        { weekday: 'MONDAY', start: '09:00', end: '13:00' },
        { weekday: 'MONDAY', start: '12:00', end: '17:00' },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects end <= start, off-grid times, and a 7th interval on one day', () => {
    expect(
      putWorkingHoursRequestSchema.safeParse({
        intervals: [{ weekday: 'TUESDAY', start: '12:00', end: '09:00' }],
      }).success,
    ).toBe(false);
    expect(
      putWorkingHoursRequestSchema.safeParse({
        intervals: [{ weekday: 'TUESDAY', start: '09:03', end: '12:00' }],
      }).success,
    ).toBe(false);
    expect(
      putWorkingHoursRequestSchema.safeParse({
        intervals: Array.from({ length: 7 }, (_, i) => ({
          weekday: 'WEDNESDAY' as const,
          start: `${String(8 + i).padStart(2, '0')}:00`,
          end: `${String(8 + i).padStart(2, '0')}:30`,
        })),
      }).success,
    ).toBe(false);
  });
});

describe('businessLocalDateTimeSchema', () => {
  it('rejects impossible calendar dates', () => {
    expect(businessLocalDateTimeSchema.safeParse('2026-02-30T09:00').success).toBe(false);
    expect(businessLocalDateTimeSchema.safeParse('2026-13-01T09:00').success).toBe(false);
    expect(businessLocalDateTimeSchema.safeParse('2026-01-15T09:00').success).toBe(true);
  });

  it('rejects createTimeOff when end is not after start', () => {
    expect(
      createTimeOffRequestSchema.safeParse({
        start: '2026-01-15T17:00',
        end: '2026-01-15T09:00',
      }).success,
    ).toBe(false);
  });
});
