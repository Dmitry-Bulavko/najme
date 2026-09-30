import { formatHhMm, parseHhMm } from '@najme/contracts';

export { formatHhMm, parseHhMm, snapHhMm, TIME_STEP_MINUTES } from '@najme/contracts';

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
