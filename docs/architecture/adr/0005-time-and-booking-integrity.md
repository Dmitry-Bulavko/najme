# ADR-0005: Time handling and booking integrity

- Status: Accepted
- Date: 2026-09-28

## Context

Booking is the core of the product. Bugs in time zones, DST transitions or concurrent booking
requests directly cause double bookings and lost trust.

## Decision

- **Storage:** all instants are stored as `timestamptz` in UTC. Booking time ranges use start/end
  instants plus an application-computed `blocked_range tstzrange` column (start/end extended by
  service buffers) that the overlap exclusion constraint runs against; see
  `docs/architecture/data-model.md` and ADR-0009 for why it is not a `GENERATED ALWAYS AS` column.
- **Business timezone:** every business has an IANA timezone (default `Europe/Podgorica`). Working
  hours are stored as local wall-clock times per weekday and interpreted in the business timezone,
  so DST transitions are handled when computing slots.
- **Slots are computed server-side** only, from: staff working hours − time off − existing active
  bookings (with service buffers) − minimum notice − booking horizon. Clients receive ready-made
  slots and never compute availability.
- **No double bookings:** a PostgreSQL exclusion constraint (`btree_gist`) forbids overlapping
  ranges for the same staff member among active bookings (`PENDING`, `CONFIRMED`). The API maps the
  constraint violation to a `409 SLOT_TAKEN` error. This is created with raw SQL in a Prisma
  migration.
- **Libraries:** **`date-fns` v4** plus **`@date-fns/tz`** (chosen in #75). `BusinessTime` helpers
  convert business-local wall clock ↔ UTC without relying on the process timezone. Prefer this
  stack over a Temporal polyfill for MVP scheduling.
- **Tests:** slot computation has unit tests covering DST switch days in `Europe/Podgorica`,
  overlapping time off, buffers and back-to-back bookings; the constraint has an e2e test with
  concurrent requests. `BusinessTime` unit tests cover spring-forward (2026-03-29) and fall-back
  (2026-10-25) in `Europe/Podgorica`.

## Consequences

- Double-booking protection does not depend on application-level locking.
- Every date shown to users must be converted from UTC to the business timezone.
