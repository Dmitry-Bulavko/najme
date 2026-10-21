import { describe, expect, it } from '@jest/globals';

import { formatHhMm, formatIsoDate, parseHhMm, parseIsoDate, snapHhMm } from '../date-time';

describe('snapHhMm', () => {
  it('snaps to a 5-minute grid', () => {
    expect(snapHhMm('09:02')).toBe('09:00');
    expect(snapHhMm('09:03')).toBe('09:05');
    expect(snapHhMm('09:08')).toBe('09:10');
  });

  it('clamps to 23:55 instead of wrapping to 00:00', () => {
    expect(snapHhMm('23:58')).toBe('23:55');
  });

  it('formats HH:mm', () => {
    expect(formatHhMm(9, 5)).toBe('09:05');
    expect(parseHhMm('23:59')).toEqual({ hours: 23, minutes: 59 });
  });
});

describe('ISO date helpers', () => {
  it('round-trips YYYY-MM-DD', () => {
    const parsed = parseIsoDate('2026-09-30');
    expect(parsed && formatIsoDate(parsed)).toBe('2026-09-30');
  });

  it('rejects invalid calendar dates', () => {
    expect(parseIsoDate('2026-02-31')).toBeNull();
    expect(parseIsoDate('26-09-30')).toBeNull();
  });
});
