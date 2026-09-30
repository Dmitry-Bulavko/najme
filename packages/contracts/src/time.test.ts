import { describe, expect, it } from 'vitest';

import { formatHhMm, parseHhMm, snapHhMm } from './time.js';

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
