# #75 — Add working hours and time off API

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/75
- Status: Implemented
- Related: ADR-0005 (Libraries amendment), #74, grooming note on `24:00` ends

## Goal

Weekly working hours (minutes since midnight, `24:00` → 1440) and time off stored as UTC, with
DST-safe conversion via `@date-fns/tz`. STAFF manage only their linked staff member.

## Approach

- Contracts: `parseHhMmEnd` / schedule schemas reusing `TIME_STEP_MINUTES`.
- `BusinessTime.localToUtc` / `utcToLocal` for Europe/Podgorica (`tzOffset` + round-trip; process-TZ
  independent).
- PUT working-hours replaces the week atomically (locks `staff_members` with `FOR UPDATE`);
  time-off span ≤ 366 days (UTC millisecond comparison — a local span that crosses CEST→CET can be
  rejected an hour early; acceptable for MVP).

## Implementation notes

- Soft-deleting a staff member deletes working hours and any time off with `endsAt > now`
  (includes in-progress entries) and keeps past time off (#75 AC).
- `conflictingBookings` always `[]` until bookings exist.
- Time-off `end` of `T24:00` is rejected by design; all-day off is sent as the next day's `00:00`
  (document for web/mobile editors #83 / #87).
