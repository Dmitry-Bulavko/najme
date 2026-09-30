/**
 * Business-local ↔ UTC conversion for Europe/Podgorica (#75 / ADR-0005).
 * Uses `@date-fns/tz` `tzOffset` only — never the TZDate component constructor, which
 * incorrectly depends on `process.env.TZ` for ambiguous times.
 */
import { TZDate, tzOffset } from '@date-fns/tz';

export const BUSINESS_TIMEZONE = 'Europe/Podgorica';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Convert a business-local wall clock (`YYYY-MM-DDTHH:mm`) to a UTC `Date`.
 *
 * DST rules (Europe/Podgorica / Europe/Belgrade):
 * - Nonexistent local times (spring forward) resolve forward to the next valid instant.
 * - Ambiguous local times (fall back) take the earlier offset (the first occurrence).
 *
 * Algorithm (process-TZ independent): treat the wall components as a naive UTC instant, then
 * subtract each nearby zone offset. Keep candidates that round-trip to the same wall time;
 * if both are valid, take the earlier; if none (gap), advance using the pre-transition offset.
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

  const naiveMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offsetBefore = tzOffset(timeZone, new Date(naiveMs - DAY_MS));
  const offsetAfter = tzOffset(timeZone, new Date(naiveMs + DAY_MS));
  const offsets = [...new Set([offsetBefore, offsetAfter])];

  const candidates = offsets
    .map((offsetMinutes) => new Date(naiveMs - offsetMinutes * 60_000))
    .filter((instant) => utcToLocal(instant, timeZone) === local)
    .sort((a, b) => a.getTime() - b.getTime());

  if (candidates.length > 0) {
    // Ambiguous → earlier instant; unique → that instant.
    // candidates[0] exists: length > 0 was checked above.
    return candidates[0]!;
  }

  // Gap: wall time does not exist — shift forward using the offset from before the change.
  return new Date(naiveMs - offsetBefore * 60_000);
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
