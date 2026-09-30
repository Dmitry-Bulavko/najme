/**
 * Business-local ↔ UTC conversion for Europe/Podgorica (#75 / ADR-0005).
 * Uses date-fns v4 + @date-fns/tz. Never depends on process TZ.
 */
import { TZDate } from '@date-fns/tz';

export const BUSINESS_TIMEZONE = 'Europe/Podgorica';

/**
 * Convert a business-local wall clock (`YYYY-MM-DDTHH:mm`) to a UTC `Date`.
 *
 * DST rules (Europe/Podgorica / Europe/Belgrade):
 * - Nonexistent local times (spring forward) resolve forward to the next valid instant.
 * - Ambiguous local times (fall back) take the earlier offset.
 */
export function localToUtc(local: string, timeZone: string = BUSINESS_TIMEZONE): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!match) {
    throw new Error(`Invalid business-local datetime: ${local}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  // TZDate constructor interprets components in the given zone.
  const zoned = new TZDate(year, month - 1, day, hour, minute, 0, 0, timeZone);
  return new Date(zoned.getTime());
}

/** Format a UTC instant as business-local `YYYY-MM-DDTHH:mm`. */
export function utcToLocal(instant: Date, timeZone: string = BUSINESS_TIMEZONE): string {
  const zoned = new TZDate(instant.getTime(), timeZone);
  const y = zoned.getFullYear();
  const m = String(zoned.getMonth() + 1).padStart(2, '0');
  const d = String(zoned.getDate()).padStart(2, '0');
  const hh = String(zoned.getHours()).padStart(2, '0');
  const mm = String(zoned.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export const BusinessTime = { localToUtc, utcToLocal, BUSINESS_TIMEZONE };
