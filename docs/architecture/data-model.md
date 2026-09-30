# Core domain data model

Shared domain model for M1–M7. See ADR-0009 for the key decisions behind it. Prisma schema code and
migrations are out of scope here (implemented incrementally, task by task); this document is the
contract agents align their Prisma models to.

The owner decisions of 2026-09-29 are recorded in
[Amendment 2026-09-29 (owner decisions)](#amendment-2026-09-29-owner-decisions). That section is
authoritative: if anything else in this document disagrees with it, the amendment wins. The entity
sections, the state machine and the integrity rules below have been updated to match it.

## Conventions

- **IDs:** every table has a `String` primary key holding a UUID v7, generated application-side
  (`docs/conventions/api.md`). Never `gen_random_uuid()` (v4).
- **Naming:** Prisma models are `PascalCase` singular (`StaffMember`); table names are `snake_case`
  plural via `@@map` (`staff_members`); fields are `camelCase` in Prisma / TypeScript and map to
  `snake_case` columns via `@map`.
- **Timestamps:** tables whose rows change after insert have `createdAt DateTime @default(now())`
  and `updatedAt DateTime @updatedAt`. Append-only, join and token tables have only `createdAt`
  (`CategoryTranslation` has none). Each entity table below lists exactly the timestamps it has.
  All timestamps are `timestamptz` (UTC). Business-facing instants (bookings, time off) are also
  `timestamptz`; working hours store minutes since local midnight (see "Money and time
  representations").
- **Money:** integer minor units + ISO 4217 currency code, e.g. `priceAmount Int`,
  `priceCurrency String @db.Char(3)`. Never floating point.
- **Raw SQL:** CHECK constraints, partial indexes and exclusion constraints cannot be expressed in
  the Prisma schema; they are raw SQL in the task's Prisma migration.
- **Soft delete:** see "Soft-delete policy" below.
- **Tenant scoping:** see "Tenant scoping" below.

## Amendment 2026-09-29 (owner decisions)

Recorded in #67 from the approved M2–M7 decomposition and the owner's answers
(`docs/product/open-questions.md` R10–R19; ADR-0009 "Amendment 2026-09-29"). "Lands in" names the
task that implements each change. Until that task lands, the change is the target schema, not the
current one.

### Delta

| Entity                        | Change                                                                                                                                                                                                                                          | Lands in                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| User                          | `isPlatformAdmin` (already in the Prisma schema) is the platform-admin capability: a boolean flag, not a role, and unrelated to the membership role `ADMIN`. Exposed as `me.isPlatformAdmin`; set only by the CLI `admin:grant`/`admin:revoke`. | M2-08                          |
| User                          | + `blockedAt`, `blockedReason` (a blocked user gets 403 `ACCOUNT_BLOCKED`)                                                                                                                                                                      | M6-03                          |
| User                          | + `termsAcceptedAt`, `termsVersion`. Account deletion = soft delete + PII scrub; booking and review history stays, anonymized.                                                                                                                  | M7-01, M7-02                   |
| Business                      | `city String?` → Prisma enum `City`, **NOT NULL** (see "Cities")                                                                                                                                                                                | M2-01 contracts/i18n, M2-02 DB |
| Business                      | `timezone` is always `Europe/Podgorica`, **not accepted by the API, immutable in MVP** (see "Timezone")                                                                                                                                         | M2-02                          |
| Business                      | + `logoKey`, `coverKey` (object keys; URLs derived, see "Photo keys"); + `rejectionReason`, `reviewedAt`, `reviewedByUserId` (FK → User, `SET NULL`)                                                                                            | M2-02                          |
| Business                      | Slug rules (see "Slugs")                                                                                                                                                                                                                        | M2-02                          |
| Business                      | CHECKs `cancellation_window_minutes >= 0`, `min_booking_notice_minutes >= 0`, `booking_horizon_days BETWEEN 1 AND 365`                                                                                                                          | M2-02                          |
| Business                      | + `verifiedAt` (M6-03); + `ratingAverage numeric(3,2)`, `ratingCount Int default 0` (M6-01)                                                                                                                                                     | M6-03, M6-01                   |
| Membership                    | A `STAFF` membership must have a linked `staffMemberId` (enforced at invite and role change). At least one `OWNER` per business (app-level, 422 `LAST_OWNER`).                                                                                  | M2-06                          |
| Invitation                    | Partial unique `(business_id, email) WHERE status = 'PENDING'`; 7-day TTL; email link only (**no code in MVP**); the accepting user's email must match                                                                                          | M2-06                          |
| StaffMember                   | `photoUrl` → `photoKey`                                                                                                                                                                                                                         | M2-03                          |
| Service                       | CHECKs `duration_minutes > 0`, `buffer_before_minutes >= 0`, `buffer_after_minutes >= 0`, `price_amount >= 0`. The API accepts EUR only, duration 5–720 in steps of 5, buffers 0–240 in steps of 5.                                             | M2-03                          |
| WorkingHours                  | `startTime`/`endTime @db.Time` → **`startMinute`/`endMinute Int`** (see "Working hours in minutes")                                                                                                                                             | M2-04                          |
| TimeOff                       | CHECK `ends_at > starts_at`; index `(staff_member_id, starts_at)`                                                                                                                                                                               | M2-04                          |
| Booking                       | See "Booking columns and constraints"                                                                                                                                                                                                           | M3-01                          |
| BookingCustomFieldValue       | `fieldDefinitionId` nullable, **`ON DELETE SET NULL`**; + `fieldKey`, `fieldLabel`, `fieldType` snapshots (see "Custom-field snapshots")                                                                                                        | M3-01                          |
| BookingReschedule (new)       | `id, bookingId (CASCADE), previousStartsAt, previousEndsAt, previousStaffMemberId, newStartsAt, newEndsAt, newStaffMemberId, changedByUserId, createdAt`; index `booking_id` (entity section "BookingReschedule")                               | M3-01                          |
| State machine                 | See "State machine changes"                                                                                                                                                                                                                     | M3-01                          |
| Category, CategoryTranslation | Created and **seeded by the migration** (10 categories, hard-coded UUID v7 ids, `sortOrder` 10–100, names in en/me/ru/tr); read-only `GET /categories`. `iconKey` values set in M4-01; + `archivedAt` in M6-04 (never hard-deleted).            | M2-01, M4-01, M6-04            |
| M5 tables                     | `NotificationDelivery`, `NotificationPreference`, `DevicePushToken`, `TelegramLink`, `TelegramLinkToken`; `outbox_events` only if needed (see "M5 and M6 tables")                                                                               | M5                             |
| M6 tables                     | `Review`, `Report`, `AdminAuditLog` (see "M5 and M6 tables")                                                                                                                                                                                    | M6                             |

### Booking columns and constraints (M3-01)

- **Client or guest (R10, R16).**
  - `clientUserId` becomes nullable.
  - Add `source` enum `BookingSource { CLIENT, BUSINESS }`. `CLIENT` is an online self-booking by a
    signed-in client. `BUSINESS` is a walk-in or phone booking that a business member creates for a
    guest, who needs no account.
  - Add `guestName` (1–100 characters): required for `BUSINESS`, null for `CLIENT`.
  - Add `contactPhone`, optional for both sources. It replaces the previously planned `guestPhone`:
    for a walk-in it is the guest's phone entered by the member; for an online booking it is the
    optional "phone for the business" entered by the client. It is unrelated to
    `Business.contactPhone`.
- **CHECK `bookings_client_or_guest`:**

  ```sql
  ALTER TABLE bookings ADD CONSTRAINT bookings_client_or_guest CHECK (
    (source = 'CLIENT' AND client_user_id IS NOT NULL AND guest_name IS NULL)
    OR (source = 'BUSINESS' AND client_user_id IS NULL AND guest_name IS NOT NULL)
  );
  ```

  `contact_phone` is deliberately not part of the CHECK: it may be set or null for either source.

- **Walk-in override:** add `outsideWorkingHours Boolean default false`. It is set when a member
  books outside working hours or inside time off with `allowOutsideWorkingHours` (M3-06).
- **Cancellation:** `cancellationReason` becomes enum
  `BookingCancellationReason { CLIENT_CANCELLED, BUSINESS_CANCELLED, DECLINED, EXPIRED }`, plus a
  `cancellationNote` text column (at most 500 characters).
- **Other CHECKs:** `ends_at > starts_at`; `buffer_before_minutes >= 0` and
  `buffer_after_minutes >= 0`; `price_amount >= 0`;
  `(status = 'CANCELLED') = (cancelled_at IS NOT NULL)`.
- **`blocked_range`:** declared in Prisma as `blockedRange Unsupported("tstzrange")`, so that
  `prisma migrate dev` does not drop it. Prisma Client cannot `create()` a model with a required
  `Unsupported` field, so the two writes that set times (create and reschedule) go through a
  `BookingRepository` (`insert`, `updateTimes`) written as `$queryRaw`, which computes
  `blocked_range` in the same statement. All other booking writes use Prisma and never touch
  `blocked_range`. CI runs
  `prisma migrate diff --from-migrations … --to-schema-datamodel … --exit-code` and expects an
  empty diff, which guards the raw-SQL objects.
- **Exclusion violations:** Postgres `23P01` maps to 409 `SLOT_TAKEN` for both the driver-adapter
  error shape and Prisma `P2010`.
- **Partial indexes for the lifecycle sweeps:** `(ends_at) WHERE status = 'CONFIRMED'` and
  `(starts_at) WHERE status = 'PENDING'`.

### State machine changes (M3-01)

The resulting diagram and the transition table by actor are in "Booking status state machine".

- **Initial status:** `source = CLIENT` starts `CONFIRMED` in `AUTO` mode and `PENDING` in
  `MANUAL` mode. `source = BUSINESS` always starts `CONFIRMED`.
- **Decline** is `PENDING → CANCELLED` with reason `DECLINED`.
- **Client cancel and reschedule:** a client may withdraw a `PENDING` request at any time. The
  cancellation window applies only to `CONFIRMED` bookings: the client may cancel or reschedule one
  only while now < `startsAt` − `cancellationWindowMinutes`, otherwise 422
  `CANCELLATION_WINDOW_PASSED`. For a reschedule the window is checked against the current
  `startsAt`. Business members may cancel and reschedule at any time.
- **Re-confirmation (R15):** in `MANUAL` mode, a client reschedule moves a `CONFIRMED` booking back
  to `PENDING` (status history reason `RESCHEDULED`), and the business must confirm it again. A
  business reschedule keeps the status, and so does a client reschedule in `AUTO` mode.
- **Expiry:** the system moves `PENDING → CANCELLED` with reason `EXPIRED` at `startsAt`.
- **Completion:** the system moves `CONFIRMED → COMPLETED` at `endsAt` + 24 h. The grace period
  lets the business mark a no-show first. A business member may also mark `COMPLETED` or `NO_SHOW`
  from `CONFIRMED`, but only after `startsAt`.
- **`NO_SHOW`** is set only by a business member. The system only auto-completes and expires; it
  never sets `NO_SHOW`.
- **Races:** transitions are conditional updates (`WHERE status = …`); when a concurrent confirm and
  cancel race, exactly one wins and the other gets 409 `BOOKING_STATUS_CONFLICT` (M3-04).

### FK delete policy

Applies to every schema task from M2 on.

- **To `users`:** `CASCADE` from the auth tables (`auth_identities`, `refresh_tokens`,
  `email_tokens`), as today. `RESTRICT` from everything else, except the optional link
  `businesses.reviewed_by_user_id` below. Users are only ever soft-deleted or anonymized, never
  hard-deleted.
- **To `businesses`, `services` and `staff_members`:** `RESTRICT` from `bookings`, `memberships`
  and `invitations` (except the optional staff links below), because these parents are soft-deleted
  only.
- **Pure configuration children:** `CASCADE`. This covers `working_hours` and `time_off` →
  `staff_members`; `service_staff_assignments` → `services` and `staff_members`;
  `service_custom_field_definitions` → `services`; `category_translations` → `categories`; and the
  booking child tables (`booking_custom_field_values`, `booking_status_history`,
  `booking_reschedules`) → `bookings`.
- **Optional links:** `SET NULL`. This covers `memberships.staff_member_id`,
  `invitations.staff_member_id`, `booking_custom_field_values.field_definition_id` and
  `businesses.reviewed_by_user_id`.

### New and changed CHECKs and indexes

| Table                    | CHECK or index                                                                                                                                                                                                                                         | Task  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `businesses`             | CHECK `cancellation_window_minutes >= 0`, `min_booking_notice_minutes >= 0`, `booking_horizon_days BETWEEN 1 AND 365`; index `(status, category_id, city)`; plain unique `slug` (not partial)                                                          | M2-02 |
| `memberships`            | index `(business_id)`                                                                                                                                                                                                                                  | M2-02 |
| `services`               | CHECK `duration_minutes > 0`, `buffer_before_minutes >= 0`, `buffer_after_minutes >= 0`, `price_amount >= 0`                                                                                                                                           | M2-03 |
| `working_hours`          | CHECK `0 <= start_minute AND start_minute < end_minute AND end_minute <= 1440`; index `(staff_member_id, weekday)`                                                                                                                                     | M2-04 |
| `time_off`               | CHECK `ends_at > starts_at`; index `(staff_member_id, starts_at)` (replaces `(staff_member_id, starts_at, ends_at)`)                                                                                                                                   | M2-04 |
| `invitations`            | partial unique `(business_id, email) WHERE status = 'PENDING'`                                                                                                                                                                                         | M2-06 |
| `bookings`               | CHECK `bookings_client_or_guest`, `ends_at > starts_at`, buffers `>= 0`, `price_amount >= 0`, `(status = 'CANCELLED') = (cancelled_at IS NOT NULL)`; partial indexes `(ends_at) WHERE status = 'CONFIRMED'` and `(starts_at) WHERE status = 'PENDING'` | M3-01 |
| `booking_reschedules`    | index `(booking_id)`                                                                                                                                                                                                                                   | M3-01 |
| `businesses`, `services` | `pg_trgm` + `unaccent`, an immutable `f_unaccent()`, GIN trigram indexes on `f_unaccent(lower(businesses.name))` and on `services.name` (ADR-0015)                                                                                                     | M4-01 |

The existing `bookings_blocked_range_contains_range` CHECK and `bookings_no_overlap` exclusion
constraint are unchanged (see "Overlap exclusion constraint"); M3-01 creates them together with the
CHECKs above.

### Business moderation (R11)

- `Business.status` defaults to `PENDING_APPROVAL`. A platform admin (`User.isPlatformAdmin`)
  approves it (`PENDING_APPROVAL` or `REJECTED` → `APPROVED`; sets `approvedAt`, `reviewedAt` and
  `reviewedByUserId`) or rejects it with a reason of 10–500 characters, stored in
  `rejectionReason` (M2-08). An OWNER or ADMIN resubmits a rejected business (`REJECTED` →
  `PENDING_APPROVAL`, clearing the reason). Suspend and unsuspend (`APPROVED` ↔ `SUSPENDED`) arrive
  with the full admin area in M6-03.
- Until it is `APPROVED`, a business is fully configurable by its members and can create walk-in
  and phone bookings, but it is not listed, its public endpoints return 404 and clients can't
  self-book. A `SUSPENDED` business is likewise not public and can't be self-booked; its members
  keep dashboard access (M6-03).

### Roles, memberships and invitations (R12, R14)

The authorization mechanism, endpoint namespaces and the full matrix are recorded in ADR-0013
"Business tenancy, roles and authorization" (written in M2-02).

| Role    | Allowed                                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `OWNER` | Everything, including deleting the business and managing owners (inviting, granting, revoking or removing `OWNER`).     |
| `ADMIN` | All operational work, except deleting the business and changing owners.                                                 |
| `STAFF` | Their own calendar, bookings, working hours and time off (through their linked staff member); reads services and staff. |

- A non-member (or an unknown or deleted business) gets 404 `NOT_FOUND`; a member whose role is not
  allowed gets 403 `FORBIDDEN`.
- A `STAFF` membership always links a staff member. A business always keeps at least one `OWNER`
  (422 `LAST_OWNER`).
- Invitations are an email link only, with no code. The token follows ADR-0011 (32 random bytes,
  base64url, SHA-256 at rest). An invitation expires after 7 days, and the accepting user's email
  must match the invited email (403 `INVITATION_EMAIL_MISMATCH`). There is at most one pending
  invitation per business and email (409 `INVITATION_EXISTS`; stale pending rows are flipped to
  `EXPIRED` first).

### Cities

`Business.city` is the Prisma enum `City`, **NOT NULL**, with the 25 municipalities of Montenegro:
`ANDRIJEVICA`, `BAR`, `BERANE`, `BIJELO_POLJE`, `BUDVA`, `CETINJE`, `DANILOVGRAD`, `GUSINJE`,
`HERCEG_NOVI`, `KOLASIN`, `KOTOR`, `MOJKOVAC`, `NIKSIC`, `PETNJICA`, `PLAV`, `PLJEVLJA`, `PLUZINE`,
`PODGORICA`, `ROZAJE`, `SAVNIK`, `TIVAT`, `TUZI`, `ULCINJ`, `ZABLJAK`, `ZETA`.

The 8 featured cities are shown first, in this display order: `PODGORICA`, `BUDVA`, `KOTOR`, `BAR`,
`HERCEG_NOVI`, `TIVAT`, `NIKSIC`, `ULCINJ` (Podgorica, Budva, Kotor, Bar, Herceg Novi, Tivat,
Nikšić, Ulcinj). `packages/contracts` exports `CITY_CODES`, `citySchema` and `FEATURED_CITIES`, and
display names live in i18n under `common.cities.<CODE>` in all four locales (M2-01). The Prisma enum
is created with the `Business` model in M2-02.

### Timezone

`Business.timezone` stays a column but is always `Europe/Podgorica`. The API does not accept it in
any create or update request, and it is immutable in MVP. This settles "timezone change after
bookings exist": it cannot happen.

### Photo keys

The database stores object-storage keys, never URLs: `Business.logoKey`, `Business.coverKey` and
`StaffMember.photoKey`. Keys have the form
`businesses/<businessId>/<logo|cover|staff>/<uuidv7>.<ext>` (ADR-0014 "Object storage", M2-05).
API responses expose the derived `logoUrl`, `coverUrl` and `photoUrl`: absolute URLs built from
`STORAGE_PUBLIC_BASE_URL`, or null.

### Working hours in minutes

- `WorkingHours.startMinute` and `endMinute` are `Int` minutes since local midnight in the business
  timezone. They replace `startTime`/`endTime @db.Time`, which avoids Prisma's Time ↔ Date pitfalls.
- CHECK `0 <= start_minute AND start_minute < end_minute AND end_minute <= 1440`; `1440` means
  24:00. There are no overnight shifts.
- Intervals on the same weekday must not overlap (touching is fine). This is app-level validation:
  the API replaces a staff member's whole week in one transaction.
- API shape (M2-04): `{intervals: [{weekday, start: 'HH:mm', end: 'HH:mm'}]}`, where `end` may be
  `24:00`, times are on a 5-minute step and a day has at most 6 intervals.

### Slugs

- Pattern `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–60 characters, and not a reserved word (`admin`, `api`,
  `business`, `new`, …).
- Generated from the name with transliteration (č/ć/š/ž/đ, Cyrillic, Turkish); a collision is
  auto-suffixed `-2`, `-3`, ….
- A plain unique index (not partial on `deleted_at`), so a slug is **never reused**, even after
  soft delete.
- Editable only until the business is `APPROVED`: 409 `SLUG_TAKEN`, 422 `SLUG_LOCKED`.

### Custom-field snapshots

- `ServiceCustomFieldDefinition` rows are upserted by `key` when a service is saved: at most 10 per
  service, and definitions missing from the request are deleted (M2-03).
- `BookingCustomFieldValue.fieldDefinitionId` is nullable with `ON DELETE SET NULL`. Each value
  snapshots `fieldKey`, `fieldLabel` and `fieldType` at booking time, so deleting or editing a
  definition keeps historic answers readable with their original label.

### M5 and M6 tables

Columns are designed in their own tasks; names and purposes are fixed here.

| Table                    | Purpose                                                                                                          | Task  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----- |
| `NotificationDelivery`   | Delivery log per recipient, channel and event, with a unique `dedupeKey` so a retry never sends twice.           | M5-01 |
| `NotificationPreference` | Per user × channel × category on/off switch; a missing row means enabled.                                        | M5-01 |
| `DevicePushToken`        | A user's Expo push tokens per platform; dead tokens are deleted.                                                 | M5-04 |
| `TelegramLink`           | Links a user to one Telegram chat for bot notifications.                                                         | M5-06 |
| `TelegramLinkToken`      | Short-lived, single-use token behind the `t.me/<bot>?start=` link.                                               | M5-06 |
| `outbox_events`          | Transactional outbox, only if pg-boss enqueue inside the Prisma transaction proves unworkable.                   | M5-01 |
| `Review`                 | One review per `COMPLETED` client-source booking: rating 1–5, comment, `PUBLISHED`/`HIDDEN`, one business reply. | M6-01 |
| `Report`                 | A user's report of a business or a review, resolved or dismissed by a platform admin.                            | M6-02 |
| `AdminAuditLog`          | Every platform-admin action, written in the same transaction as the action.                                      | M6-02 |

## Entities

### User

| Field               | Type             | Null? | Notes                                                                                |
| ------------------- | ---------------- | ----- | ------------------------------------------------------------------------------------ |
| id                  | String (uuid v7) | no    | PK                                                                                   |
| email               | String           | no    | unique, lowercased/normalized                                                        |
| emailVerifiedAt     | DateTime         | yes   |                                                                                      |
| displayName         | String           | yes   |                                                                                      |
| avatarUrl           | String           | yes   |                                                                                      |
| localePreference    | String           | no    | one of `en`/`me`/`ru`/`tr`, default `en` (ADR-0004)                                  |
| isPlatformAdmin     | Boolean          | no    | default `false`; the platform-admin flag (not a role); set only by CLI `admin:grant` |
| createdAt/updatedAt | DateTime         | no    |                                                                                      |
| deletedAt           | DateTime         | yes   | soft delete                                                                          |

Relations: has many `AuthIdentity`, `RefreshToken`, `EmailToken`, `Membership`, `Booking` (as client), `Review`.

Later columns (see the amendment): `blockedAt`, `blockedReason` (M6-03); `termsAcceptedAt`,
`termsVersion` (M7-02).

### AuthIdentity

One row per login method (ADR-0002: password, Google, Apple).

| Field               | Type              | Null? | Notes                                    |
| ------------------- | ----------------- | ----- | ---------------------------------------- |
| id                  | String (uuid v7)  | no    | PK                                       |
| userId              | String            | no    | FK → User                                |
| provider            | enum AuthProvider | no    | `PASSWORD`, `GOOGLE`, `APPLE`            |
| providerAccountId   | String            | yes   | external subject id; null for `PASSWORD` |
| passwordHash        | String            | yes   | argon2id; only set for `PASSWORD`        |
| createdAt/updatedAt | DateTime          | no    |                                          |

Constraints: unique `(userId, provider)`; unique `(provider, providerAccountId)` where
`providerAccountId is not null`.

### RefreshToken

| Field             | Type             | Null? | Notes                          |
| ----------------- | ---------------- | ----- | ------------------------------ |
| id                | String (uuid v7) | no    | PK                             |
| userId            | String           | no    | FK → User                      |
| tokenHash         | String           | no    | unique; raw token never stored |
| issuedAt          | DateTime         | no    |                                |
| expiresAt         | DateTime         | no    |                                |
| revokedAt         | DateTime         | yes   |                                |
| replacedByTokenId | String           | yes   | rotation chain                 |
| userAgent         | String           | yes   |                                |
| ipAddress         | String           | yes   |                                |
| createdAt         | DateTime         | no    |                                |

### EmailToken

Single-use token for email verification and password reset (raw token only ever sent by email).

| Field     | Type                   | Null? | Notes                            |
| --------- | ---------------------- | ----- | -------------------------------- |
| id        | String (uuid v7)       | no    | PK                               |
| userId    | String                 | no    | FK → User                        |
| purpose   | enum EmailTokenPurpose | no    | `VERIFY_EMAIL`, `RESET_PASSWORD` |
| tokenHash | String                 | no    | unique; raw token never stored   |
| expiresAt | DateTime               | no    |                                  |
| usedAt    | DateTime               | yes   | set when consumed                |
| createdAt | DateTime               | no    |                                  |

### Business

| Field                     | Type                  | Null? | Notes                                                                           |
| ------------------------- | --------------------- | ----- | ------------------------------------------------------------------------------- |
| id                        | String (uuid v7)      | no    | PK                                                                              |
| name                      | String                | no    |                                                                                 |
| slug                      | String                | no    | unique, never reused; public URL; rules in the amendment ("Slugs")              |
| categoryId                | String                | no    | FK → Category                                                                   |
| description               | String                | yes   |                                                                                 |
| timezone                  | String                | no    | always `Europe/Podgorica`; not accepted by the API, immutable in MVP (ADR-0005) |
| city                      | enum City             | no    | one of the 25 municipalities (amendment, "Cities")                              |
| address                   | String                | yes   |                                                                                 |
| contactPhone              | String                | yes   |                                                                                 |
| contactEmail              | String                | yes   |                                                                                 |
| logoKey                   | String                | yes   | object key; the API exposes `logoUrl`                                           |
| coverKey                  | String                | yes   | object key; the API exposes `coverUrl`                                          |
| confirmationMode          | enum ConfirmationMode | no    | `AUTO` \| `MANUAL`, default `AUTO` (R18)                                        |
| cancellationWindowMinutes | Int                   | no    | default `120` (R18); CHECK `>= 0`                                               |
| minBookingNoticeMinutes   | Int                   | no    | default `60` (R18); earliest a slot may start from now; CHECK `>= 0`            |
| bookingHorizonDays        | Int                   | no    | default `60` (R18); how far ahead slots are offered; CHECK between 1 and 365    |
| status                    | enum BusinessStatus   | no    | `PENDING_APPROVAL` (default), `APPROVED`, `REJECTED`, `SUSPENDED` (R11)         |
| approvedAt                | DateTime              | yes   |                                                                                 |
| rejectionReason           | String                | yes   | set by a platform admin's reject (10–500 characters); cleared on resubmit       |
| reviewedAt                | DateTime              | yes   | when a platform admin last approved or rejected it                              |
| reviewedByUserId          | String                | yes   | FK → User, `SET NULL`; the platform admin who did                               |
| createdAt/updatedAt       | DateTime              | no    |                                                                                 |
| deletedAt                 | DateTime              | yes   | soft delete                                                                     |

Relations: has many `Membership`, `Invitation`, `StaffMember`, `Service`, `Booking`, `Review`.

Later columns (see the amendment): `verifiedAt` (M6-03); `ratingAverage`, `ratingCount` (M6-01).

### Membership

A user's role inside a business (glossary: OWNER / ADMIN / STAFF; role matrix in the amendment).

| Field               | Type                | Null? | Notes                                                                                                                                                                                        |
| ------------------- | ------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                  | String (uuid v7)    | no    | PK                                                                                                                                                                                           |
| userId              | String              | no    | FK → User                                                                                                                                                                                    |
| businessId          | String              | no    | FK → Business                                                                                                                                                                                |
| role                | enum MembershipRole | no    | `OWNER`, `ADMIN`, `STAFF`                                                                                                                                                                    |
| staffMemberId       | String              | yes   | FK → StaffMember (unique, `SET NULL`); the bookable resource this member operates as; required for `STAFF` (app-level). Column added in #74 (M2-03); create-business `ownerIsStaff` sets it. |
| createdAt/updatedAt | DateTime            | no    |                                                                                                                                                                                              |

Constraints: unique `(userId, businessId)`. At least one `OWNER` per business (app-level,
`LAST_OWNER`).

### Invitation

An email-link invitation to join a business (amendment, "Roles, memberships and invitations"). Rows
move through a status lifecycle and are never deleted; a resend rotates the token and expiry in
place.

| Field               | Type                  | Null? | Notes                                                                        |
| ------------------- | --------------------- | ----- | ---------------------------------------------------------------------------- |
| id                  | String (uuid v7)      | no    | PK                                                                           |
| businessId          | String                | no    | FK → Business                                                                |
| email               | String                | no    | invitee, need not have an account yet; the accepting user's email must match |
| role                | enum MembershipRole   | no    |                                                                              |
| staffMemberId       | String                | yes   | FK → StaffMember (`SET NULL`), pre-links the invite; required for `STAFF`    |
| invitedByUserId     | String                | no    | FK → User                                                                    |
| tokenHash           | String                | no    | unique; SHA-256 of the emailed token (ADR-0011 scheme)                       |
| status              | enum InvitationStatus | no    | `PENDING`, `ACCEPTED`, `EXPIRED`, `REVOKED`                                  |
| expiresAt           | DateTime              | no    | 7 days after it was sent or resent                                           |
| acceptedAt          | DateTime              | yes   |                                                                              |
| createdAt/updatedAt | DateTime              | no    |                                                                              |

Constraints: partial unique `(businessId, email) WHERE status = 'PENDING'`.

### StaffMember

The bookable resource (glossary). May exist without a linked `Membership`/user account.

| Field               | Type             | Null? | Notes                                                       |
| ------------------- | ---------------- | ----- | ----------------------------------------------------------- |
| id                  | String (uuid v7) | no    | PK                                                          |
| businessId          | String           | no    | FK → Business                                               |
| displayName         | String           | no    |                                                             |
| photoKey            | String           | yes   | object key; the API exposes `photoUrl`                      |
| active              | Boolean          | no    | default `true`; hides from booking without deleting history |
| createdAt/updatedAt | DateTime         | no    |                                                             |
| deletedAt           | DateTime         | yes   | soft delete                                                 |

Relations: has many `WorkingHours`, `TimeOff`, `Booking`; many-to-many with `Service` via
`ServiceStaffAssignment`; optionally referenced by one `Membership`.

### Service

| Field                   | Type             | Null? | Notes                                                                      |
| ----------------------- | ---------------- | ----- | -------------------------------------------------------------------------- |
| id                      | String (uuid v7) | no    | PK                                                                         |
| businessId              | String           | no    | FK → Business                                                              |
| name                    | String           | no    | business-entered, single language (Q7)                                     |
| description             | String           | yes   |                                                                            |
| durationMinutes         | Int              | no    | CHECK `> 0`; the API accepts 5–720 in steps of 5                           |
| bufferBeforeMinutes     | Int              | no    | default `0`; blocked time before the slot; CHECK `>= 0`; API 0–240, step 5 |
| bufferAfterMinutes      | Int              | no    | default `0`; blocked time after the slot; CHECK `>= 0`; API 0–240, step 5  |
| priceAmount             | Int              | no    | minor units; CHECK `>= 0`                                                  |
| priceCurrency           | String           | no    | ISO 4217; the API accepts `EUR` only                                       |
| minBookingNoticeMinutes | Int              | yes   | overrides `Business.minBookingNoticeMinutes` when set                      |
| bookingHorizonDays      | Int              | yes   | overrides `Business.bookingHorizonDays` when set                           |
| active                  | Boolean          | no    | default `true`                                                             |
| createdAt/updatedAt     | DateTime         | no    |                                                                            |
| deletedAt               | DateTime         | yes   | soft delete                                                                |

Relations: many-to-many with `StaffMember` via `ServiceStaffAssignment`; has many
`ServiceCustomFieldDefinition`, `Booking`.

### ServiceStaffAssignment

Join table: which staff members can perform a service.

| Field         | Type             | Null? | Notes            |
| ------------- | ---------------- | ----- | ---------------- |
| id            | String (uuid v7) | no    | PK               |
| serviceId     | String           | no    | FK → Service     |
| staffMemberId | String           | no    | FK → StaffMember |
| createdAt     | DateTime         | no    |                  |

Constraints: unique `(serviceId, staffMemberId)`.

### ServiceCustomFieldDefinition

Generic custom booking fields per service (R18, formerly open question Q2: generic, not
transfer-specific). Upserted by `key` when the service is saved (amendment, "Custom-field
snapshots").

| Field               | Type                 | Null? | Notes                                                                                  |
| ------------------- | -------------------- | ----- | -------------------------------------------------------------------------------------- |
| id                  | String (uuid v7)     | no    | PK                                                                                     |
| serviceId           | String               | no    | FK → Service                                                                           |
| key                 | String               | no    | stable identifier matching `^[a-z][a-z0-9_]{0,39}$`, e.g. `pickup_address`             |
| label               | String               | no    | business-entered, single language (Q7); 1–80 characters                                |
| type                | enum CustomFieldType | no    | `TEXT`, `NUMBER`, `SELECT`                                                             |
| required            | Boolean              | no    | default `false`                                                                        |
| options             | Json                 | yes   | `SELECT` only, 1–20 options with unique values: `[{ "value": "...", "label": "..." }]` |
| sortOrder           | Int                  | no    | default `0`                                                                            |
| createdAt/updatedAt | DateTime             | no    |                                                                                        |

Constraints: unique `(serviceId, key)`.

### WorkingHours

Weekly recurring availability of a staff member, in local wall-clock minutes (ADR-0005; amendment,
"Working hours in minutes"). Several rows per weekday are allowed (e.g. split shifts), but they
must not overlap.

| Field               | Type             | Null? | Notes                                                                     |
| ------------------- | ---------------- | ----- | ------------------------------------------------------------------------- |
| id                  | String (uuid v7) | no    | PK                                                                        |
| staffMemberId       | String           | no    | FK → StaffMember                                                          |
| weekday             | enum Weekday     | no    | `MONDAY` … `SUNDAY`                                                       |
| startMinute         | Int              | no    | minutes since local midnight, business timezone                           |
| endMinute           | Int              | no    | minutes since local midnight; after `startMinute`, at most `1440` (24:00) |
| createdAt/updatedAt | DateTime         | no    |                                                                           |

Constraints: CHECK `0 <= start_minute AND start_minute < end_minute AND end_minute <= 1440` (no
overnight shifts); no overlapping intervals on the same weekday (app-level).

### TimeOff

One-off unavailability (vacation, sick day, break). Stored as an absolute UTC range; the API takes
business-local wall-clock input and converts it on the server.

| Field               | Type             | Null? | Notes                                   |
| ------------------- | ---------------- | ----- | --------------------------------------- |
| id                  | String (uuid v7) | no    | PK                                      |
| staffMemberId       | String           | no    | FK → StaffMember                        |
| startsAt            | DateTime         | no    | `timestamptz`                           |
| endsAt              | DateTime         | no    | `timestamptz`, after `startsAt` (CHECK) |
| reason              | String           | yes   |                                         |
| createdAt/updatedAt | DateTime         | no    |                                         |

### Booking

The reservation of a staff member for a service at a time range, for a client or a walk-in guest
(glossary). Columns and constraints added by the amendment: "Booking columns and constraints".

| Field               | Type                           | Null? | Notes                                                                                      |
| ------------------- | ------------------------------ | ----- | ------------------------------------------------------------------------------------------ |
| id                  | String (uuid v7)               | no    | PK                                                                                         |
| businessId          | String                         | no    | FK → Business; denormalized for tenant scoping and indexes                                 |
| serviceId           | String                         | no    | FK → Service                                                                               |
| staffMemberId       | String                         | no    | FK → StaffMember                                                                           |
| source              | enum BookingSource             | no    | `CLIENT` (online self-booking) or `BUSINESS` (walk-in or phone booking by a member)        |
| clientUserId        | String                         | yes   | FK → User; set exactly when `source = CLIENT` (CHECK `bookings_client_or_guest`, R10)      |
| guestName           | String                         | yes   | 1–100 characters; set exactly when `source = BUSINESS`                                     |
| contactPhone        | String                         | yes   | optional for both sources: the guest's phone, or the client's phone for the business (R16) |
| createdByUserId     | String                         | no    | FK → User; the client, or the business member who created a walk-in                        |
| startsAt            | DateTime                       | no    | `timestamptz`, UTC                                                                         |
| endsAt              | DateTime                       | no    | `timestamptz`, UTC, after `startsAt` (CHECK)                                               |
| bufferBeforeMinutes | Int                            | no    | snapshot of `Service.bufferBeforeMinutes` at booking time                                  |
| bufferAfterMinutes  | Int                            | no    | snapshot of `Service.bufferAfterMinutes` at booking time                                   |
| status              | enum BookingStatus             | no    | `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`, `NO_SHOW`                                |
| priceAmount         | Int                            | no    | snapshot of `Service.priceAmount` at booking time                                          |
| priceCurrency       | String                         | no    | snapshot of `Service.priceCurrency`                                                        |
| outsideWorkingHours | Boolean                        | no    | default `false`; a member booked outside working hours with the override (M3-06)           |
| cancelledAt         | DateTime                       | yes   | set exactly when `status = CANCELLED` (CHECK)                                              |
| cancelledByUserId   | String                         | yes   | FK → User; null when the system expired the booking                                        |
| cancellationReason  | enum BookingCancellationReason | yes   | `CLIENT_CANCELLED`, `BUSINESS_CANCELLED`, `DECLINED`, `EXPIRED`                            |
| cancellationNote    | String                         | yes   | at most 500 characters                                                                     |
| notes               | String                         | yes   | business-internal note                                                                     |
| blockedRange        | `Unsupported("tstzrange")`     | no    | written only through raw SQL; see "Overlap exclusion constraint"                           |
| createdAt/updatedAt | DateTime                       | no    |                                                                                            |

Price and buffers are **snapshotted** on the booking row so later edits to the service do not change
historical bookings or the already-computed blocked range.

`blocked_range tstzrange` is derived from `starts_at`, `ends_at` and the buffer snapshots, and is
used by the exclusion constraint. Prisma declares it as `Unsupported("tstzrange")` so migrations
keep it, but Prisma Client never writes it: create and reschedule go through the raw-SQL
`BookingRepository` (see "Integrity rules").

Relations: has many `BookingCustomFieldValue`, `BookingStatusHistory`, `BookingReschedule`;
optionally one `Review`.

### BookingCustomFieldValue

An answer to a service's custom field, with a snapshot of the definition (amendment, "Custom-field
snapshots").

| Field             | Type                 | Null? | Notes                                                   |
| ----------------- | -------------------- | ----- | ------------------------------------------------------- |
| id                | String (uuid v7)     | no    | PK                                                      |
| bookingId         | String               | no    | FK → Booking                                            |
| fieldDefinitionId | String               | yes   | FK → ServiceCustomFieldDefinition, `ON DELETE SET NULL` |
| fieldKey          | String               | no    | snapshot of the definition's `key`                      |
| fieldLabel        | String               | no    | snapshot of the definition's `label`                    |
| fieldType         | enum CustomFieldType | no    | snapshot of the definition's `type`                     |
| value             | Json                 | no    | typed per `fieldType`                                   |
| createdAt         | DateTime             | no    |                                                         |

Constraints: unique `(bookingId, fieldDefinitionId)`.

### BookingStatusHistory

Append-only audit trail of every status transition (see state machine below).

| Field           | Type               | Null? | Notes                                                                         |
| --------------- | ------------------ | ----- | ----------------------------------------------------------------------------- |
| id              | String (uuid v7)   | no    | PK                                                                            |
| bookingId       | String             | no    | FK → Booking                                                                  |
| fromStatus      | enum BookingStatus | yes   | null for the initial row                                                      |
| toStatus        | enum BookingStatus | no    |                                                                               |
| changedByUserId | String             | yes   | FK → User; null when `changedBySystem`                                        |
| changedBySystem | Boolean            | no    | default `false`; `true` for the lifecycle sweep (auto-complete, expiry)       |
| reason          | String             | yes   | e.g. `RESCHEDULED` when a client reschedule sends a booking back to `PENDING` |
| createdAt       | DateTime           | no    |                                                                               |

### BookingReschedule

Append-only reschedule history (new in M3-01): one row per reschedule, by a client or a business
member. It keeps the old and new times on the same booking id.

| Field                 | Type             | Null? | Notes                                                      |
| --------------------- | ---------------- | ----- | ---------------------------------------------------------- |
| id                    | String (uuid v7) | no    | PK                                                         |
| bookingId             | String           | no    | FK → Booking, `ON DELETE CASCADE`; indexed                 |
| previousStartsAt      | DateTime         | no    | `timestamptz`                                              |
| previousEndsAt        | DateTime         | no    | `timestamptz`                                              |
| previousStaffMemberId | String           | no    | FK → StaffMember                                           |
| newStartsAt           | DateTime         | no    | `timestamptz`                                              |
| newEndsAt             | DateTime         | no    | `timestamptz`                                              |
| newStaffMemberId      | String           | no    | FK → StaffMember; a reschedule may change the staff member |
| changedByUserId       | String           | no    | FK → User; the client or member who rescheduled            |
| createdAt             | DateTime         | no    |                                                            |

### Category

Platform-managed classification (glossary), with translations. Created and seeded with the 10
initial categories by the M2-01 migration (not by `db seed`, so production gets them).

| Field               | Type             | Null? | Notes                                                            |
| ------------------- | ---------------- | ----- | ---------------------------------------------------------------- |
| id                  | String (uuid v7) | no    | PK; hard-coded for the seeded categories                         |
| slug                | String           | no    | unique, stable key                                               |
| iconKey             | String           | yes   | platform-neutral key, mapped on each client; values set in M4-01 |
| sortOrder           | Int              | no    | default `0`; seeded categories use 10–100                        |
| createdAt/updatedAt | DateTime         | no    |                                                                  |

Later columns (see the amendment): `archivedAt` (M6-04). Categories are archived, never
hard-deleted.

### CategoryTranslation

| Field      | Type             | Null? | Notes                                 |
| ---------- | ---------------- | ----- | ------------------------------------- |
| id         | String (uuid v7) | no    | PK                                    |
| categoryId | String           | no    | FK → Category                         |
| locale     | String           | no    | one of `en`/`me`/`ru`/`tr` (ADR-0004) |
| name       | String           | no    |                                       |

Constraints: unique `(categoryId, locale)`.

## Later tables (M5–M6)

The notification, review, report and audit tables are named, with their purpose, in the
amendment ("M5 and M6 tables"). Their columns are designed in their own tasks.

## Entity-relationship diagram

```mermaid
erDiagram
    USER ||--o{ AUTH_IDENTITY : has
    USER ||--o{ REFRESH_TOKEN : has
    USER ||--o{ MEMBERSHIP : has
    USER |o--o{ BOOKING : "books (client; null for guests)"
    USER ||--o{ INVITATION : "invited by"

    BUSINESS ||--o{ MEMBERSHIP : has
    BUSINESS ||--o{ INVITATION : has
    BUSINESS ||--o{ STAFF_MEMBER : employs
    BUSINESS ||--o{ SERVICE : offers
    BUSINESS ||--o{ BOOKING : scopes
    BUSINESS }o--|| CATEGORY : "classified as"

    MEMBERSHIP }o--o| STAFF_MEMBER : "operates as"

    STAFF_MEMBER ||--o{ WORKING_HOURS : has
    STAFF_MEMBER ||--o{ TIME_OFF : has
    STAFF_MEMBER ||--o{ BOOKING : performs
    STAFF_MEMBER }o--o{ SERVICE : "via ServiceStaffAssignment"

    SERVICE ||--o{ SERVICE_CUSTOM_FIELD_DEFINITION : defines
    SERVICE ||--o{ BOOKING : "booked as"

    BOOKING ||--o{ BOOKING_CUSTOM_FIELD_VALUE : has
    BOOKING ||--o{ BOOKING_STATUS_HISTORY : has
    BOOKING ||--o{ BOOKING_RESCHEDULE : has
    SERVICE_CUSTOM_FIELD_DEFINITION |o--o{ BOOKING_CUSTOM_FIELD_VALUE : "answered by (SET NULL)"

    CATEGORY ||--o{ CATEGORY_TRANSLATION : has
```

## Booking status state machine

Amended 2026-09-29 (amendment, "State machine changes").

```mermaid
stateDiagram-v2
    [*] --> PENDING: client books online\n(confirmationMode = MANUAL)
    [*] --> CONFIRMED: client books online (AUTO),\nor member creates a walk-in (source = BUSINESS)

    PENDING --> CONFIRMED: business member confirms
    PENDING --> CANCELLED: client withdraws (any time),\nmember declines (DECLINED),\nor system at startsAt (EXPIRED)

    CONFIRMED --> PENDING: client reschedules\n(MANUAL mode only)
    CONFIRMED --> CANCELLED: client cancels before the window,\nor member cancels (any time)
    CONFIRMED --> COMPLETED: member marks complete after startsAt,\nor system at endsAt + 24 h
    CONFIRMED --> NO_SHOW: business member marks no-show,\nafter startsAt

    CANCELLED --> [*]
    COMPLETED --> [*]
    NO_SHOW --> [*]
```

| From        | To          | Actor  | Rule                                                                                                                       |
| ----------- | ----------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| (new)       | `PENDING`   | client | online booking (`source = CLIENT`), `MANUAL` mode                                                                          |
| (new)       | `CONFIRMED` | client | online booking (`source = CLIENT`), `AUTO` mode                                                                            |
| (new)       | `CONFIRMED` | member | walk-in or phone booking (`source = BUSINESS`), in either mode                                                             |
| `PENDING`   | `CONFIRMED` | member | confirm                                                                                                                    |
| `PENDING`   | `CANCELLED` | client | withdraw, any time (`CLIENT_CANCELLED`)                                                                                    |
| `PENDING`   | `CANCELLED` | member | decline (`DECLINED`)                                                                                                       |
| `PENDING`   | `CANCELLED` | system | at `startsAt` (`EXPIRED`)                                                                                                  |
| `CONFIRMED` | `CANCELLED` | client | only while now < `startsAt` − `cancellationWindowMinutes` (`CLIENT_CANCELLED`); otherwise 422 `CANCELLATION_WINDOW_PASSED` |
| `CONFIRMED` | `CANCELLED` | member | any time (`BUSINESS_CANCELLED`)                                                                                            |
| `CONFIRMED` | `PENDING`   | client | reschedule in `MANUAL` mode (history reason `RESCHEDULED`); needs re-confirmation                                          |
| `CONFIRMED` | `COMPLETED` | member | after `startsAt`                                                                                                           |
| `CONFIRMED` | `COMPLETED` | system | at `endsAt` + 24 h                                                                                                         |
| `CONFIRMED` | `NO_SHOW`   | member | after `startsAt`                                                                                                           |

Notes:

- Only `PENDING` and `CONFIRMED` are "active" for the overlap exclusion constraint; `CANCELLED`,
  `COMPLETED` and `NO_SHOW` never block a slot.
- **Cancellation window direction:** the window applies only to `CONFIRMED` bookings. A client may
  cancel or reschedule a `CONFIRMED` booking only while more than
  `Business.cancellationWindowMinutes` remain before `startsAt` (for a reschedule, the current
  `startsAt`); inside the window the request is rejected with 422 `CANCELLATION_WINDOW_PASSED`
  rather than silently allowed. A `PENDING` request can be withdrawn or rescheduled by the client
  at any time. Business members may cancel or reschedule at any time. The policy is evaluated at
  the time of the action.
- **Reschedule** (vision: clients and businesses can reschedule) updates `startsAt` / `endsAt` (and
  optionally `staffMemberId`) on the same `Booking` row while it is `PENDING` or `CONFIRMED`,
  through the raw-SQL `BookingRepository.updateTimes`, which recomputes `blocked_range`. It is
  re-validated against the exclusion constraint like a new booking (409 `SLOT_TAKEN` on a race),
  and every reschedule writes a `BookingReschedule` row. A client's new time must be a computed
  slot (excluding the booking's own range); a member may reschedule outside working hours only with
  the `allowOutsideWorkingHours` override. The status does not change, except that a client
  reschedule of a `CONFIRMED` booking in `MANUAL` mode moves it to `PENDING`.
- Every transition writes a `BookingStatusHistory` row; `changedBySystem = true` marks automatic
  transitions.
- "System" transitions are the pg-boss cron `booking-lifecycle-sweep` (every 5 minutes, M3-07,
  ADR-0006). It uses conditional updates that re-check the current status, so a re-run is a no-op
  and a `CANCELLED` booking is never marked `COMPLETED`. The system only auto-completes and
  expires; it never sets `NO_SHOW`, which is a business member's decision.
- All transitions are conditional updates (`WHERE status = …`); the loser of a race gets 409
  `BOOKING_STATUS_CONFLICT`.

## Integrity rules

### Overlap exclusion constraint (ADR-0005)

Prisma cannot express exclusion constraints, so this constraint is raw SQL in a migration (the
`btree_gist` extension is already enabled by the baseline migration
`apps/api/prisma/migrations/20260928184345_init`).

Buffers extend the range a booking blocks. A `GENERATED ALWAYS AS (...) STORED` column cannot express
this: `timestamptz ± interval` depends on the session's `TimeZone` setting to resolve DST, so Postgres
classifies it `STABLE`, not `IMMUTABLE`, and rejects it as a generation expression ("generation
expression is not immutable"; reproduced against local Postgres 16). Instead `blocked_range` is a
plain, `NOT NULL` column that the application computes and writes in the same `INSERT`/`UPDATE`
statement as `starts_at`/`ends_at`/the buffer snapshot — one statement, so there is no race window for
the exclusion constraint to miss. A `CHECK` constraint is the safety net that stops a row from ever
being written with a `blocked_range` narrower than `[starts_at, ends_at)`:

```sql
ALTER TABLE bookings
  ADD COLUMN blocked_range tstzrange NOT NULL,
  ADD CONSTRAINT bookings_blocked_range_contains_range
    CHECK (blocked_range @> tstzrange(starts_at, ends_at, '[)'));

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    staff_member_id WITH =,
    blocked_range WITH &&
  )
  WHERE (status IN ('PENDING', 'CONFIRMED'));
```

The application (or a repository helper shared by create/reschedule) always sets
`blocked_range = tstzrange(starts_at - buffer_before_minutes * interval '1 minute', ends_at +
buffer_after_minutes * interval '1 minute', '[)')` before writing. An alternative considered was a
`BEFORE INSERT OR UPDATE` trigger that derives `blocked_range` server-side instead of relying on the
application to set it correctly; that removes the "application must remember to compute it" risk at
the cost of logic living in the database instead of the codebase agents mostly work in. We chose the
application-computed column for M1–M3: it keeps all booking logic in the `bookings`/`scheduling`
modules, and the `CHECK` constraint still rejects an incorrectly computed value outright.

The API maps a violation (Postgres error `23P01`) to `409 SLOT_TAKEN` (`docs/conventions/api.md`).

**Verified** against local Postgres 16 (`psql postgresql://najme:najme@localhost:5432/najme_test`,
inside `BEGIN; … ROLLBACK;`, using the DDL above plus a minimal `bookings` test table and
`CREATE EXTENSION IF NOT EXISTS btree_gist`):

- Two `PENDING`/`CONFIRMED` rows for the same `staff_member_id` with overlapping `blocked_range` →
  `ERROR: conflicting key value violates exclusion constraint "bookings_no_overlap"` (`23P01`).
- The same overlap with the first row `CANCELLED` → both inserts succeed.
- A row whose `blocked_range` does not contain `[starts_at, ends_at)` → rejected by
  `bookings_blocked_range_contains_range`.

**Notes (amendment 2026-09-29):**

- In `schema.prisma` the column is declared as `blockedRange Unsupported("tstzrange")`. A column
  Prisma does not know about would be dropped by the next `prisma migrate dev`.
- Prisma Client cannot `create()` a model with a required `Unsupported` field, so the "repository
  helper shared by create/reschedule" above is the `BookingRepository` (`insert`, `updateTimes`),
  written as `$queryRaw` that computes `blocked_range` in the same statement. No other code path
  writes `blocked_range`.
- The `23P01` mapping covers both the driver-adapter error shape and Prisma `P2010` (raw query
  failed).
- CI keeps `prisma migrate diff --from-migrations … --to-schema-datamodel … --exit-code`
  empty, so a schema change cannot silently drop the raw-SQL objects.

### Other unique constraints

- `users.email` unique.
- `auth_identities` unique `(user_id, provider)`; unique `(provider, provider_account_id)` where
  `provider_account_id IS NOT NULL`.
- `refresh_tokens.token_hash` unique.
- `memberships` unique `(user_id, business_id)`.
- `memberships` unique `staff_member_id` (nullable; at most one membership operates as a given staff
  member).
- `invitations.token_hash` unique.
- `invitations` partial unique `(business_id, email) WHERE status = 'PENDING'`.
- `businesses.slug` unique — a plain unique index, not partial on `deleted_at`, so a slug is never
  reused after soft delete.
- `service_staff_assignments` unique `(service_id, staff_member_id)`.
- `service_custom_field_definitions` unique `(service_id, key)`.
- `booking_custom_field_values` unique `(booking_id, field_definition_id)`.
- `categories.slug` unique.
- `category_translations` unique `(category_id, locale)`.

### Required indexes

- `bookings (staff_member_id, starts_at)` — calendar and availability queries; the exclusion
  constraint's GiST index on `(staff_member_id, blocked_range)` also serves overlap lookups.
- `bookings (business_id, starts_at)` — business calendar across all staff.
- `bookings (client_user_id, starts_at)` — "my bookings".
- `bookings (ends_at) WHERE status = 'CONFIRMED'` and
  `bookings (starts_at) WHERE status = 'PENDING'` — the lifecycle sweeps (partial, raw SQL).
- `booking_reschedules (booking_id)`.
- `working_hours (staff_member_id, weekday)`.
- `time_off (staff_member_id, starts_at)`.
- `services (business_id)`, `staff_members (business_id)`, `memberships (business_id)`,
  `invitations (business_id)` — tenant-scoped listing.
- `businesses (status, category_id, city)` — marketplace search/discovery.
- `refresh_tokens (user_id)`.

### Tenant scoping

Every table owned by a business carries a path back to `businessId`: directly (`Business`,
`Membership`, `Invitation`, `StaffMember`, `Service`, `Booking` — denormalized onto `Booking` for
simpler queries and indexes even though it is derivable via `serviceId`/`staffMemberId`), or
transitively through `StaffMember`/`Service`/`Booking` (`WorkingHours`, `TimeOff`,
`ServiceCustomFieldDefinition`, `ServiceStaffAssignment`, the booking child tables). Every
business-scoped API endpoint (`/businesses/:businessId/*`) filters by `businessId` and resolves the
caller's `Membership` and role in that business before validating the body (`BusinessAccessGuard`
plus `@BusinessRoles(...)`, M2-02, ADR-0013):

- an unknown or deleted business, or a caller who is not a member, gets **404** `NOT_FOUND`;
- a member whose role is not allowed gets **403** `FORBIDDEN`;
- resource-level rules, such as a `STAFF` member acting only on their own staff member, are
  enforced in services, not only at the query level (403 otherwise).

**Cross-tenant FK consistency.** A `Booking` references `serviceId` and `staffMemberId`; a
`ServiceStaffAssignment` references `serviceId` and `staffMemberId`. Nothing in a plain foreign key
stops those rows from belonging to a _different_ `businessId` than the booking/assignment itself.
The rule is **application-level validation, not a database constraint**: when creating or updating a
`Booking` or `ServiceStaffAssignment` (or any other row that references another business-owned
row), the service layer loads the referenced rows and checks their `businessId`. The error depends
on where the reference is:

- an ID in the **path** that does not exist, is soft-deleted or belongs to another business →
  **404** `NOT_FOUND` (the three cases are indistinguishable);
- an ID in the **request body** that does not exist, is soft-deleted or belongs to another business
  → **422** `VALIDATION_FAILED`, with the offending field in `details` (e.g.
  `details.staffMemberIds`). Note the status is 422, not the 400 used for schema validation.

Every endpoint that writes one of these rows gets an e2e test asserting a cross-tenant reference is
rejected (`docs/conventions/testing.md`), the same way business-scoped routes are tested against
non-members (the business authz test helper and the route-walker e2e added in M2-02).

Composite foreign keys (`(business_id, service_id)` referencing a composite unique key
`services (business_id, id)`, and likewise for `staff_member_id`) would let Postgres enforce this
instead of the application. We do not adopt them now: they would require every referencing table to
also carry and index `business_id` purely for the FK shape (already true for `Booking`, but not for
`ServiceStaffAssignment`), and Prisma's relation modeling for composite FKs is more awkward than a
single-column FK plus a service-layer check. Revisit this as an ADR-0009 amendment if cross-tenant
bugs show up in practice.

### Availability inputs

Per ADR-0005, slots are computed server-side (M3-02) from staff working hours minus time off minus
existing active bookings (with buffers), limited by **minimum notice** and **booking horizon**.
Those last two are modeled as `Business.minBookingNoticeMinutes` (default `60`) and
`Business.bookingHorizonDays` (default `60`), each optionally overridden per `Service` when set (e.g.
a transfer service needing more lead time than a haircut). The owner confirmed these defaults on
2026-09-29 (R18).

Slot rules (R13):

- The client picks a specific staff member; there is no "any staff" option.
- Candidate starts lie on a grid anchored at the start of each working interval, with step =
  `durationMinutes + bufferBeforeMinutes + bufferAfterMinutes`. With zero buffers the step equals
  the service duration, and bookings pack back-to-back.
- A candidate's blocked range must fit inside the working interval and must not overlap time off
  or the blocked range of an active booking.
- Walk-in and phone bookings by a member ignore minimum notice and horizon, but never overlaps
  (M3-06).

### Soft-delete policy

- Soft-deleted (`deletedAt` timestamp) so booking history and audit trails remain valid after
  removal: `User`, `Business`, `StaffMember`, `Service`. Account deletion (M7-01) is a soft delete
  plus a PII scrub. A soft-deleted business returns 404 on every route, and its slug is never
  reused.
- `active` boolean (not deletion) temporarily hides a `StaffMember` or `Service` from booking without
  losing history; soft delete is for permanent removal.
- Soft-deleting a staff member removes their service assignments, unlinks their membership and
  deletes their working hours and future time off (M2-03, M2-04). From M3-06 it is refused with 422
  `STAFF_HAS_FUTURE_BOOKINGS` while they have future active bookings, and deleting a business with
  future active bookings is refused with 422 `BUSINESS_HAS_FUTURE_BOOKINGS`.
- Rows with a status lifecycle are never deleted: `Booking` rows end in `CANCELLED`, `COMPLETED` or
  `NO_SHOW`; `Invitation` rows move `PENDING` → `ACCEPTED` / `EXPIRED` / `REVOKED` and are updated
  in place (a resend rotates the token and expiry), so they are not append-only.
- Append-only: `BookingStatusHistory`, `BookingReschedule`, `BookingCustomFieldValue` (and, from M6,
  `AdminAuditLog`).
- Hard-deleted: configuration rows (`WorkingHours`, replaced as a whole week; `TimeOff`;
  `ServiceStaffAssignment`; `ServiceCustomFieldDefinition`, whose answers keep their snapshots) and
  `Membership` (a removed member or one who left). Token rows (`RefreshToken`, `EmailToken`) are
  marked revoked or used in place.
- Categories are archived (`archivedAt`, M6-04), never hard-deleted.
- Default Prisma queries exclude soft-deleted rows (e.g. a repository-layer `deletedAt: null` filter
  or a Prisma Client extension); this is an implementation detail for the tasks that add these
  models.

### Money and time representations

- Money: integer minor units + ISO 4217 currency code, matching `docs/conventions/api.md`. Snapshotted
  onto `Booking` at creation time so later price changes do not alter historical bookings.
- Time: all instants (`Booking.startsAt/endsAt`, `TimeOff.startsAt/endsAt`, all `createdAt/updatedAt`)
  are `timestamptz` in UTC. `WorkingHours.startMinute/endMinute` are local wall-clock minutes since
  midnight (no date, no timezone) interpreted in `Business.timezone` (always `Europe/Podgorica`) at
  slot-computation time, so a fixed 09:00–17:00 shift stays 09:00–17:00 local across DST
  transitions (ADR-0005). Slot computation must therefore reproject working hours into UTC per day,
  not store a UTC offset once.

## Product decisions this model depends on

The open questions this model originally assumed defaults for (Q2, Q3, Q4, Q6, Q8) were resolved on
2026-09-29 as R10, R11 and R18 in `docs/product/open-questions.md`, together with R12–R17 (roles,
slots, invitations, re-confirmation, contact phone, reviews). The amendment above records the
resulting schema. Q7 (translation of business-entered texts) is still open; the model stores those
texts in a single language chosen by the business.
