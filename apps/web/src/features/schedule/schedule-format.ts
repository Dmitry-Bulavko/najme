import { parseHhMmEnd } from '@najme/contracts';
import { isLocale, toIntlLocale, type Locale } from '@najme/i18n';

function resolveLocale(locale: string): Locale {
  return isLocale(locale) ? locale : 'en';
}

/**
 * Format a business-local `HH:mm` (or `24:00`) for display using the locale's hour cycle.
 * Uses a fixed UTC date so the wall-clock digits are not shifted by the business timezone.
 */
export function formatLocalHhMm(hhMm: string, locale: string): string {
  if (hhMm === '24:00') {
    return '24:00';
  }
  const parsed = parseHhMmEnd(hhMm);
  if (!parsed || parsed.hours === 24) {
    return hhMm;
  }
  const date = new Date(Date.UTC(2020, 0, 1, parsed.hours, parsed.minutes));
  return new Intl.DateTimeFormat(toIntlLocale(resolveLocale(locale)), {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

/** Format a UTC ISO instant in the business timezone with the locale's date/time style. */
export function formatBusinessDateTime(isoUtc: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(toIntlLocale(resolveLocale(locale)), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(isoUtc));
}

/** Add calendar days to a `YYYY-MM-DD` string (UTC calendar arithmetic). */
export function addCalendarDays(isoDate: string, days: number): string {
  const parts = isoDate.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Build business-local `YYYY-MM-DDTHH:mm` for the create-time-off API. */
export function toBusinessLocalDateTime(date: string, hhMm: string): string {
  return `${date}T${hhMm}`;
}
