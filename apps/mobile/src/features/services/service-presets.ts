import {
  BOOKING_HORIZON_DAY_PRESETS,
  MIN_BOOKING_NOTICE_PRESETS,
  optionsWithCurrentValue,
} from '@/features/business/booking-presets';

/** Build inclusive minute lists (helper for curated presets). */
export function minuteOptions(min: number, max: number, step: number): number[] {
  const values: number[] = [];
  for (let n = min; n <= max; n += step) {
    values.push(n);
  }
  return values;
}

/**
 * Curated duration presets (contract allows 5–720 step 5). Kept short so mobile Selects
 * stay usable.
 */
export const DURATION_MINUTE_PRESETS: readonly number[] = [
  ...minuteOptions(5, 60, 5),
  75,
  90,
  105,
  120,
  150,
  180,
  210,
  240,
  300,
  360,
  420,
  480,
  540,
  600,
  660,
  720,
];

/** Curated buffer presets (contract allows 0–240 step 5). */
export const BUFFER_MINUTE_PRESETS: readonly number[] = [
  ...minuteOptions(0, 30, 5),
  45,
  60,
  90,
  120,
  180,
  240,
];

/** Service-level notice presets; `null` = inherit business default. */
export const SERVICE_NOTICE_PRESETS: readonly (number | null)[] = [
  null,
  ...MIN_BOOKING_NOTICE_PRESETS,
];

/** Service-level horizon presets (days); `null` = inherit business default. */
export const SERVICE_HORIZON_PRESETS: readonly (number | null)[] = [
  null,
  ...BOOKING_HORIZON_DAY_PRESETS,
];

export function isValidDurationMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= 5 && value <= 720 && value % 5 === 0;
}

export function isValidBufferMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 240 && value % 5 === 0;
}

export function durationOptionsWithCurrent(current: number): number[] {
  return optionsWithCurrentValue(DURATION_MINUTE_PRESETS, current);
}

export function bufferOptionsWithCurrent(current: number): number[] {
  return optionsWithCurrentValue(BUFFER_MINUTE_PRESETS, current);
}

export function optionsWithNullableCurrent(
  presets: readonly (number | null)[],
  current: number | null,
): (number | null)[] {
  if (presets.some((p) => p === current)) {
    return [...presets];
  }
  return [...presets, current].sort((a, b) => {
    if (a === null) return -1;
    if (b === null) return 1;
    return a - b;
  });
}
