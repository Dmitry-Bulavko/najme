export const CANCELLATION_WINDOW_PRESETS = [0, 30, 60, 120, 240, 1440, 2880, 10080] as const;

export const MIN_BOOKING_NOTICE_PRESETS = [0, 15, 30, 60, 120, 240, 480] as const;

export const BOOKING_HORIZON_DAY_PRESETS = [7, 14, 30, 60, 90, 180, 365] as const;

export type CancellationWindowPreset = (typeof CANCELLATION_WINDOW_PRESETS)[number];
export type MinBookingNoticePreset = (typeof MIN_BOOKING_NOTICE_PRESETS)[number];
export type BookingHorizonDayPreset = (typeof BOOKING_HORIZON_DAY_PRESETS)[number];

/** Prefer the nearest preset when an unexpected value arrives from the API. */
export function nearestPreset<T extends number>(value: number, presets: readonly T[]): T {
  let best = presets[0]!;
  let bestDist = Math.abs(value - best);
  for (const preset of presets) {
    const dist = Math.abs(value - preset);
    if (dist < bestDist) {
      best = preset;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Select options: presets plus the current stored value when it is not a preset, so a
 * round-trip save cannot silently rewrite API/mobile/seed values.
 */
export function optionsWithCurrentValue(presets: readonly number[], current: number): number[] {
  if (presets.includes(current)) {
    return [...presets];
  }
  return [...presets, current].sort((a, b) => a - b);
}
