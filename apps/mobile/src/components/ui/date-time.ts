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

/** Snap wall-clock minutes to the nearest step (half rounds up). */
export function snapHhMm(value: string, stepMinutes: number = TIME_STEP_MINUTES): string | null {
  const parsed = parseHhMm(value);
  if (!parsed) {
    return null;
  }

  const total = parsed.hours * 60 + parsed.minutes;
  const snapped = Math.round(total / stepMinutes) * stepMinutes;
  const wrapped = ((snapped % (24 * 60)) + 24 * 60) % (24 * 60);
  return formatHhMm(Math.floor(wrapped / 60), wrapped % 60);
}

export function hhMmToDate(value: string, base: Date = new Date(2000, 0, 1)): Date | null {
  const parsed = parseHhMm(value);
  if (!parsed) {
    return null;
  }
  const date = new Date(base);
  date.setHours(parsed.hours, parsed.minutes, 0, 0);
  return date;
}

export function dateToHhMm(date: Date): string {
  return formatHhMm(date.getHours(), date.getMinutes());
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
