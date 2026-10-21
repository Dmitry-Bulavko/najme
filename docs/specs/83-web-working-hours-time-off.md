# #83 — Build the web working-hours editor and time off

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/83
- Status: Implemented
- Related: #75, `docs/specs/75-working-hours-time-off.md`, UI-STD, ADR-0013

## Goal

Owners/admins and linked staff edit weekly working hours and time off in the browser. STAFF only
reach their own schedule (other staffIds show 403). Client validation reuses `@najme/contracts`
schedule helpers (including `24:00` ends). Times are labelled Europe/Podgorica and formatted per
locale.

## Approach

- Thin App Router pages under `BusinessShell`; feature module `apps/web/src/features/schedule/`.
- Staff schedule at `/business/[businessId]/staff/[staffId]/schedule`.
- OWNER/ADMIN schedule nav → `/business/[businessId]/schedule` staff picker (also checklist CTA).
- STAFF nav → “My schedule” → linked `staffMemberId` from `GET /me/businesses`.
- Weekly editor: 7 weekday rows, Closed toggle, multi-interval add/remove, “until end of day”
  (`24:00`), Copy to… other days (Popover + checkbox group); validate with
  `putWorkingHoursRequestSchema` before PUT; per-row errors mapped from `intervals[i]` paths.
- Time off: one GET `from=-2y`, client-split upcoming/past; Dialog create (all-day → local `00:00`
  → next-day `00:00`), AlertDialog delete; show `conflictingBookings` warning after create
  (empty until M3).
- No local reimplementation of overlap/order/step rules — contracts only.

## Changes

| Area / path                           | Change                                         |
| ------------------------------------- | ---------------------------------------------- |
| `apps/web/.../schedule/*`             | Editor, picker, helpers, tests                 |
| `apps/web/.../staff/.../schedule/`    | Thin schedule page                             |
| `apps/web/.../schedule/page.tsx`      | Staff picker / STAFF redirect                  |
| `apps/web/.../business-nav*` + shell  | Role-aware schedule href + “My schedule” label |
| `packages/i18n/.../business.json`     | `schedule.*` (+ shell label) in en/me/ru/tr    |
| `docs/specs/83-web-working-hours-…md` | This spec                                      |

### Contracts / API

None — consume #75 endpoints and schemas.

### Data model

None.

### UI and i18n

- Namespace `business.schedule.*` (and `shell.mySchedule` for STAFF nav).
- Timezone label from `business.timezone`.
- Native `<input type="time">` / `TimeInput` follow the **browser** locale/hour-cycle, not
  necessarily the app locale. Per-day summaries next to each weekday use `formatLocalHhMm`
  (`Intl` + `toIntlLocale`) so en shows 12-hour and me/ru/tr show 24-hour — that summary meets
  the locale-formatting acceptance criterion.

## Test plan

- Load/save working hours PUT body shape; Closed + Copy to (keyboard); overlap via contracts schema
  with per-row errors; until-end-of-day; removing last interval closes the day.
- STAFF 403 UI for another staffId; unlinked STAFF `noLinkedStaff`; time-off all-day next-day
  `00:00` (incl. DST / year-end); timed body; empty-date submit; delete; timezone label.
- Picker OWNER list / empty / error+Retry; STAFF redirect / unlinked.
- Failed PUT / POST / DELETE toasts; view load error + Retry.
- Nav: My schedule label; hidden when STAFF unlinked; Staff item not active on `/schedule`.

## Risks and open questions

- STAFF without `staffMemberId`: hide/disable My schedule and show an empty/no-link state on
  picker redirect.
- `TimeInput` cannot express `24:00` — explicit “until end of day” control required.

## Implementation notes

- Feature module `apps/web/src/features/schedule/`; pages at staff schedule + `/schedule` picker.
- Nav: STAFF → `shell.mySchedule` + linked `staffMemberId`; OWNER/ADMIN → picker. Checklist hours
  CTA already pointed at `/schedule` (now the picker). Staff nav prefix match excludes
  `…/schedule` so only one item is `aria-current`.
- Working-hours draft validates with `putWorkingHoursRequestSchema`; “until end of day” → `24:00`.
  Zod/API `intervals[i]` paths map onto draft rows for `aria-invalid` / described-by messages plus
  a summary alert.
- All-day time off → `startDateT00:00` / next calendar day after `endDate` at `00:00` (never `T24:00`).
  Empty dates are guarded (`addCalendarDays` returns null; `superRefine` skips body build).
- Time off: single GET with `from` two years ago; client-filter upcoming (`endsAt > now`) vs past.
- `conflictingBookings` warning shown after create (empty until M3).
- No new ADR.
