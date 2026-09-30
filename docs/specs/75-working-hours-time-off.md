# #75 — Add working hours and time off API

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/75
- Status: Implemented
- Related: ADR-0005 (Libraries amendment), #74, grooming note on `24:00` ends

## Goal

Weekly working hours (minutes since midnight, `24:00` → 1440) and time off stored as UTC, with
DST-safe conversion via `date-fns` + `@date-fns/tz`. STAFF manage only their linked staff member.

## Approach

- Contracts: `parseHhMmEnd` / schedule schemas reusing `TIME_STEP_MINUTES`.
- `BusinessTime.localToUtc` / `utcToLocal` for Europe/Podgorica.
- PUT working-hours replaces the week atomically; time-off span ≤ 366 days.

## Implementation notes

- Soft-deleting a staff member deletes working hours and future time off (#75 AC).
- `conflictingBookings` always `[]` until bookings exist.
