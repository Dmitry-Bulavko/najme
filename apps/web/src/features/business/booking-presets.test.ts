import { describe, expect, it } from 'vitest';

import {
  BOOKING_HORIZON_DAY_PRESETS,
  CANCELLATION_WINDOW_PRESETS,
  MIN_BOOKING_NOTICE_PRESETS,
  nearestPreset,
  optionsWithCurrentValue,
} from './booking-presets';

describe('booking-presets', () => {
  it('includes R18 defaults', () => {
    expect(CANCELLATION_WINDOW_PRESETS).toContain(120);
    expect(MIN_BOOKING_NOTICE_PRESETS).toContain(60);
    expect(BOOKING_HORIZON_DAY_PRESETS).toContain(60);
  });

  it('picks the nearest preset', () => {
    expect(nearestPreset(100, CANCELLATION_WINDOW_PRESETS)).toBe(120);
    expect(nearestPreset(1, MIN_BOOKING_NOTICE_PRESETS)).toBe(0);
    expect(nearestPreset(50, BOOKING_HORIZON_DAY_PRESETS)).toBe(60);
  });

  it('keeps a non-preset current value as an extra option', () => {
    expect(optionsWithCurrentValue(MIN_BOOKING_NOTICE_PRESETS, 45)).toEqual([
      0, 15, 30, 45, 60, 120, 240, 480,
    ]);
    expect(optionsWithCurrentValue(MIN_BOOKING_NOTICE_PRESETS, 60)).toEqual([
      ...MIN_BOOKING_NOTICE_PRESETS,
    ]);
  });
});
