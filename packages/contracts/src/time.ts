/** Five-minute step for business schedule / booking time controls. */
export const TIME_STEP_MINUTES = 5;

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseHhMm(value: string): { hours: number; minutes: number } | null {
  const match = HH_MM.exec(value.trim());
  if (!match) {
    return null;
  }
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

export function formatHhMm(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Snap wall-clock minutes to the nearest `stepMinutes` grid (half rounds up).
 *
 * Clamps to the last slot of the day (`23:55` for the default 5-minute step) instead of wrapping
 * to `00:00`, so the value always remains on the same calendar day.
 */
export function snapHhMm(value: string, stepMinutes: number = TIME_STEP_MINUTES): string | null {
  const parsed = parseHhMm(value);
  if (!parsed) {
    return null;
  }

  const total = parsed.hours * 60 + parsed.minutes;
  const snapped = Math.round(total / stepMinutes) * stepMinutes;
  // Clamp: do not roll over into the next day.
  const maxMinutes = 24 * 60 - stepMinutes;
  const clamped = Math.min(snapped, maxMinutes);
  return formatHhMm(Math.floor(clamped / 60), clamped % 60);
}
