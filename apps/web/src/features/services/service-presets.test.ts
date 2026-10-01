import { describe, expect, it } from 'vitest';

import {
  BUFFER_MINUTE_PRESETS,
  DURATION_MINUTE_PRESETS,
  bufferOptionsWithCurrent,
  durationOptionsWithCurrent,
  isValidBufferMinutes,
  isValidDurationMinutes,
} from './service-presets';

describe('service presets', () => {
  it('curates duration and buffer lists instead of every contract step', () => {
    expect(DURATION_MINUTE_PRESETS).toEqual([
      5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360,
      420, 480, 540, 600, 660, 720,
    ]);
    expect(BUFFER_MINUTE_PRESETS).toEqual([0, 5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240]);
  });

  it('includes a non-preset API value via optionsWithCurrentValue', () => {
    expect(durationOptionsWithCurrent(125)).toContain(125);
    expect(bufferOptionsWithCurrent(35)).toContain(35);
  });

  it('validates by contract range and step 5, not list membership', () => {
    expect(isValidDurationMinutes(125)).toBe(true);
    expect(isValidDurationMinutes(123)).toBe(false);
    expect(isValidDurationMinutes(4)).toBe(false);
    expect(isValidBufferMinutes(35)).toBe(true);
    expect(isValidBufferMinutes(241)).toBe(false);
  });
});
