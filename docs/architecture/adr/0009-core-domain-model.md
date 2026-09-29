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
  `PENDING`/`CONFIRMED` bookings. `blocked_range` is a plain, application-computed `tstzrange` column
  (not a `GENERATED ALWAYS AS` column — see "Alternatives considered") written in the same statement
  as `startsAt`/`endsAt`/the buffer-minute snapshot, backed by a `CHECK` constraint that it contains
  `[startsAt, endsAt)`. This cannot be expressed in the Prisma schema language, so it is raw SQL added
  by a Prisma migration (ADR-0002, ADR-0005); the exact DDL, and its verification against local
  Postgres 16, is in `docs/architecture/data-model.md`.
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
- The overlap exclusion constraint, the `blocked_range` column and its `CHECK` constraint must be
  written as raw SQL in every migration that touches `bookings`; `prisma migrate diff`/`db pull` will
  not reproduce them automatically, so schema changes to `bookings` need care not to drop them. Every
  code path that writes a `Booking` (create, reschedule) must compute and set `blocked_range`
  correctly; this is worth a shared repository helper and a unit test, since the `CHECK` constraint
  only catches a wrong value, it does not compute the right one.
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
- **`blocked_range` as a `GENERATED ALWAYS AS (...) STORED` column:** tried first, rejected —
  `timestamptz ± interval` arithmetic depends on the session `TimeZone` setting to resolve DST, so
  Postgres classifies it `STABLE` rather than `IMMUTABLE` and refuses it as a generation expression
  ("generation expression is not immutable"; reproduced against local Postgres 16). A plain column set
  by the application in the same `INSERT`/`UPDATE` as `startsAt`/`endsAt` has no race window (it is one
  statement, and the exclusion constraint still evaluates atomically against it), and a `CHECK`
  constraint guards against a value that does not actually cover `[startsAt, endsAt)`.
- **`BEFORE INSERT OR UPDATE` trigger computing `blocked_range` server-side:** considered instead of
  the application-computed column; would remove the risk of application code forgetting to set it
  correctly, at the cost of moving booking logic into a database trigger that agents working in
  `apps/api` do not see by reading the codebase. Not adopted for M1–M3; revisit if the
  application-computed column proves error-prone in practice.

## Amendment 2026-09-29

The owner answered the open product questions on 2026-09-29 (`docs/product/open-questions.md`
R10–R19; recorded in #67). The schema delta, with the task that lands each change, is authoritative
in `docs/architecture/data-model.md`, section "Amendment 2026-09-29 (owner decisions)". Where the
original decision text above disagrees, this amendment wins.

- **Defaults are now decisions.** Q2, Q3, Q4, Q6 and Q8 are resolved (R10, R11, R18), so the
  "Other open-question defaults" bullet above no longer describes assumptions, and the consequence
  about answering them differently no longer applies. Custom booking fields stay generic. The
  booking-policy defaults stay as modelled: `AUTO` confirmation, a 120-minute cancellation window,
  60-minute minimum notice and a 60-day horizon, plus auto-complete 24 h after `endsAt` and
  `PENDING` expiry at `startsAt`.
- **Clients and guests (R10, R16).** Online self-booking requires a client account and an
  `APPROVED` business. Walk-in and phone bookings that a business member creates need no client
  account. `Booking` gains `source` (`CLIENT` | `BUSINESS`), a nullable `clientUserId`, a
  `guestName` required for walk-ins, and one optional `contactPhone` for both sources (instead of a
  walk-in-only `guestPhone`). The CHECK `bookings_client_or_guest` enforces the combination. This
  replaces "`Booking.clientUserId` is required".
- **Moderation (R11).** `Business.status` still defaults to `PENDING_APPROVAL`. A minimal
  platform-admin flow arrives in M2: approve, reject with a reason, owner resubmit, and a web admin
  page. The full admin area stays in M6. Before approval a business is fully configurable and can
  create walk-in bookings, but it is not listed and clients can't self-book. A platform admin is a
  user with the boolean `User.isPlatformAdmin`, not a role, and is unrelated to the membership role
  `ADMIN`.
- **Tenancy and roles (R12, R14).** `OWNER` may do everything, including deleting the business and
  managing owners. `ADMIN` may do all operational work except deleting the business and changing
  owners. `STAFF` manages their own calendar, bookings, working hours and time off, and reads
  services and staff. Non-members get 404 and members without the role get 403. A cross-tenant id
  in the path is 404; in the request body it is 422 `VALIDATION_FAILED`. Invitations are an email
  link only, expire after 7 days, require a matching email, and are limited to one pending per
  business and email; a business always keeps at least one `OWNER`. The authorization mechanism is
  recorded in ADR-0013 (M2-02).
- **Booking status machine (R15).** Walk-ins (`source = BUSINESS`) start `CONFIRMED`. Decline is
  `CANCELLED` with reason `DECLINED`. A client reschedule in `MANUAL` mode moves a `CONFIRMED`
  booking back to `PENDING` for re-confirmation; a business reschedule keeps the status. The
  cancellation window applies only to `CONFIRMED` bookings; a client may withdraw a `PENDING`
  request at any time. The system expires `PENDING` at `startsAt` (reason `EXPIRED`) and completes
  `CONFIRMED` at `endsAt` + 24 h; only a business member marks `NO_SHOW`. `cancellationReason`
  becomes an enum, with a separate `cancellationNote`.
- **Reschedule history.** A reschedule still updates the same booking row, and each one also
  writes a `BookingReschedule` row with the old and new times and staff member. This is the
  "future `BookingReschedule` log" the original decision left open.
- **`blocked_range` in Prisma.** Declared as `Unsupported("tstzrange")` so migrations keep it.
  Create and reschedule go through a raw-SQL `BookingRepository` that computes it in the same
  statement, as the decision above already requires.
- **Custom-field history.** Definitions are upserted by `key`. `BookingCustomFieldValue` snapshots
  the field's key, label and type, and its definition FK is nullable with `ON DELETE SET NULL`, so
  deleting a definition keeps historic answers.
- **Time and slots (R13).** `Business.timezone` is always `Europe/Podgorica`, not accepted by the
  API and immutable in MVP. `WorkingHours` stores `startMinute`/`endMinute` (minutes since local
  midnight, no overnight shifts) instead of `@db.Time` columns. The slot step is duration + buffer
  before + buffer after, anchored at the working-interval start, and the client picks a specific
  staff member (no "any staff").
- **Business fields.** `city` is a NOT NULL enum of the 25 municipalities, with 8 featured cities.
  Slugs follow fixed rules and are never reused after soft delete. Photos are stored as object
  keys (ADR-0014). Categories are seeded by a migration in M2.
- **FK delete policy.** `CASCADE` from the auth tables to users and from pure configuration
  children to their parents; `RESTRICT` towards soft-deleted parents (users, businesses, services,
  staff members); `SET NULL` for optional links.
- **Later tables.** The placeholders in "Scope" are replaced by named tables: M5 adds
  `NotificationDelivery`, `NotificationPreference`, `DevicePushToken`, `TelegramLink` and
  `TelegramLinkToken` (plus `outbox_events` only if needed); M6 adds `Review`, `Report` and
  `AdminAuditLog`. Reviews (R17) are published immediately and hidden only through reports; they
  can be written up to 30 days after completion and edited for 7 days.
