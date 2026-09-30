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

/**
 * Like {@link parseHhMm}, but also accepts `24:00` (end of day → 1440 minutes).
 * Used for working-hours interval ends (#75).
 */
export function parseHhMmEnd(value: string): { hours: number; minutes: number } | null {
  const trimmed = value.trim();
  if (trimmed === '24:00') {
    return { hours: 24, minutes: 0 };
  }
  return parseHhMm(trimmed);
}

/** Minutes since local midnight; `24:00` → 1440. */
export function hhMmEndToMinutes(value: string): number | null {
  const parsed = parseHhMmEnd(value);
  if (!parsed) {
    return null;
  }
  return parsed.hours * 60 + parsed.minutes;
}

export function minutesToHhMmEnd(totalMinutes: number): string {
  if (totalMinutes === 1440) {
    return '24:00';
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return formatHhMm(hours, minutes);
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

export const weekdaySchemaValues = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

/** HH:mm on a 5-minute step, or `24:00` for interval ends. */
export function isValidIntervalEnd(
  value: string,
  stepMinutes: number = TIME_STEP_MINUTES,
): boolean {
  const minutes = hhMmEndToMinutes(value);
  if (minutes === null) {
    return false;
  }
  return minutes % stepMinutes === 0;
}

/** HH:mm on a 5-minute step (not `24:00`). */
export function isValidIntervalStart(
  value: string,
  stepMinutes: number = TIME_STEP_MINUTES,
): boolean {
  const parsed = parseHhMm(value);
  if (!parsed) {
    return false;
  }
  return (parsed.hours * 60 + parsed.minutes) % stepMinutes === 0;
}
