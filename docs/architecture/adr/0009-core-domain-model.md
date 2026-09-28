# ADR-0009: Core domain model

- Status: Accepted
- Date: 2026-09-28

## Context

M1–M6 tasks implement the Prisma schema and endpoints for users, businesses, staff, services,
schedules, bookings and the category catalogue incrementally, by different agents. Without one
agreed model up front, schema conventions (naming, tenancy, soft delete) and booking integrity would
drift between tasks, and the overlap-prevention design (ADR-0005) would be bolted on late instead of
shaping the schema from the start. The full entity list, fields and diagrams live in
`docs/architecture/data-model.md`; this ADR records the decisions behind it.

## Decision

- **Scope:** the model covers `User`, `AuthIdentity`, `RefreshToken`, `Business`, `Membership`,
  `Invitation`, `StaffMember`, `Service` (+ staff assignment, buffers, custom booking field
  definitions), `WorkingHours`, `TimeOff`, `Booking` (+ custom field values, status history),
  `Category` (+ translations), and placeholders for `Review`, `Device`/`PushToken`,
  `NotificationPreference`, `TelegramLink`. Salons with multiple staff members are supported from
  the first release (`docs/product/open-questions.md` R1); a solo specialist is a business with one
  `StaffMember`.
- **IDs:** UUID v7, generated application-side, per `docs/conventions/api.md`. Prisma models are
  `PascalCase` singular; tables are `snake_case` plural via `@@map`; columns are `snake_case` via
  `@map` on `camelCase` Prisma fields.
- **Tenancy:** every business-owned row carries a path to `businessId`, direct or transitive. It is
  denormalized directly onto `Booking` (rather than only reachable via `serviceId`/`staffMemberId`)
  because almost every booking query is tenant-scoped and the business calendar view needs it
  without extra joins. Authorization still re-checks `Membership`/role in application code, not just
  via the foreign key (`docs/conventions/api.md`).
- **Money:** integer minor units + ISO 4217 currency, never floating point, consistent with
  `docs/conventions/api.md`. `Service` holds the current price; `Booking` snapshots
  `priceAmount`/`priceCurrency` (and the service's buffer minutes) at creation time so later service
  edits never change historical or already-scheduled bookings.
- **Time:** all instants are `timestamptz` UTC (ADR-0005). `WorkingHours` stores local wall-clock
  time per weekday, interpreted in `Business.timezone` at slot-computation time, so shifts stay
  correct across DST transitions instead of drifting by the DST offset. `TimeOff` and `Booking` use
  absolute UTC ranges.
- **Booking integrity:** a Postgres exclusion constraint (`btree_gist`, already enabled by the
  baseline migration) forbids overlapping `blocked_range` values for the same `staffMemberId` among
  `PENDING`/`CONFIRMED` bookings. `blocked_range` is a generated, stored `tstzrange` column computed
  from `startsAt`/`endsAt` and the buffer-minute snapshot on the row, so buffers are enforced by the
  same constraint without an application-level race. This cannot be expressed in the Prisma schema
  language, so it is raw SQL added by a Prisma migration (ADR-0002, ADR-0005); the exact DDL is in
  `docs/architecture/data-model.md`.
- **Status machine:** `Booking.status` is `PENDING → CONFIRMED → {COMPLETED, NO_SHOW}` or
  `→ CANCELLED` from either active state, with every transition recorded in
  `BookingStatusHistory` (who: client, business member, or system job, per ADR-0006). Reschedule
  updates `startsAt`/`endsAt` in place, re-validated by the same exclusion constraint, rather than
  creating a new booking — the calendar view and notification history stay tied to one booking id.
- **Soft delete:** `User`, `Business`, `StaffMember`, `Service` get a nullable `deletedAt`, because
  `Booking`/`BookingStatusHistory` reference them and must remain readable after removal. Everything
  else is either append-only or safe to hard-delete. `StaffMember.active` / `Service.active` (not
  deletion) is the day-to-day way to hide a resource from booking.
- **Custom booking fields (open question Q2):** generic, per-service field definitions
  (`ServiceCustomFieldDefinition`: text/number/select) with typed answers on
  `BookingCustomFieldValue`, rather than a transfer-specific pickup/drop-off/passenger-count schema.
  This covers transfers (pickup, drop-off, passenger count as custom fields) and any future service
  type without new tables, at the cost of weaker typing than dedicated columns.
- **Other open-question defaults baked into the model:** `Business.confirmationMode` defaults to
  `AUTO` (Q3), `Business.cancellationWindowMinutes` defaults to `120` (Q4),
  `Booking.clientUserId` is required — no anonymous booking (Q6), `Business.status` defaults to
  `PENDING_APPROVAL` and requires platform-admin approval before `APPROVED` (Q8). These are
  assumptions, not resolved product decisions; see `docs/product/open-questions.md`.

## Consequences

- M1–M3 tasks implement this model incrementally in `apps/api/prisma/schema.prisma` and can rely on
  table/column names, tenancy and soft-delete conventions already being agreed rather than
  re-litigating them per task.
- The overlap exclusion constraint and its generated column must be written as raw SQL in every
  migration that touches `bookings`; `prisma migrate diff`/`db pull` will not reproduce it
  automatically, so schema changes to `bookings` need care not to drop it.
- If Q2, Q3, Q4, Q6 or Q8 are answered differently from their default before M2/M3, the affected
  field (type, default value, or nullability) changes in a schema migration; the shape of the rest of
  the model is unaffected.

## Alternatives considered

- **Reschedule as cancel + new booking:** rejected — loses the single booking id that notifications,
  reviews and calendar history reference, and doubles `BookingStatusHistory` bookkeeping for what is
  one user action.
- **Transfer-specific fields on `Service`/`Booking`:** rejected for MVP per Q2's default; would need a
  new migration for every future service type needing custom data (e.g. a dentist's insurance
  number).
- **Computing the blocked range in application code before insert:** rejected — races under
  concurrent requests, which is exactly the failure ADR-0005's exclusion constraint exists to
  prevent; a generated column keeps the buffer maths inside the same atomic constraint check.
