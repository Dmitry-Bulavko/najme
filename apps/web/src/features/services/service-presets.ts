/** Minute values for service duration Select (contract: 5–720, step 5). */
export function minuteOptions(min: number, max: number, step: number): number[] {
  const values: number[] = [];
  for (let n = min; n <= max; n += step) {
    values.push(n);
  }
  return values;
}

export const DURATION_MINUTE_OPTIONS = minuteOptions(5, 720, 5);
export const BUFFER_MINUTE_OPTIONS = minuteOptions(0, 240, 5);

/** Service-level notice presets; `null` = inherit business default. */
export const SERVICE_NOTICE_PRESETS = [null, 0, 15, 30, 60, 120, 240, 480] as const;

/** Service-level horizon presets (days); `null` = inherit business default. */
export const SERVICE_HORIZON_PRESETS = [null, 7, 14, 30, 60, 90, 180, 365] as const;

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
