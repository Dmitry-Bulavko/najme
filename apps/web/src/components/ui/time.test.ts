import { describe, expect, it } from 'vitest';

import { formatHhMm, parseHhMm, snapHhMm } from './time';

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

describe('snapHhMm', () => {
  it('snaps to a 5-minute grid', () => {
    expect(snapHhMm('09:02')).toBe('09:00');
    expect(snapHhMm('09:03')).toBe('09:05');
    expect(snapHhMm('09:07')).toBe('09:05');
    expect(snapHhMm('09:08')).toBe('09:10');
  });

  it('clamps to 23:55 instead of wrapping to 00:00', () => {
    expect(formatHhMm(0, 0)).toBe('00:00');
    expect(snapHhMm('23:58')).toBe('23:55');
  });
});
