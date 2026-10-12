# #87 — Build the mobile working-hours editor and time off

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/87
- Status: Implemented
- Related: #75, #83, #86, UI-STD, ADR-0005, ADR-0013

## Goal

Owners/admins and linked staff edit weekly working hours and time off on mobile at parity with
web #83. STAFF only reach their own schedule. Client validation reuses `@najme/contracts` schedule
helpers (including `24:00` ends). Times are labelled Europe/Podgorica and formatted per locale.

## Approach

- Nested Schedule tab under the business dashboard (same stack pattern as Staff/Services).
- STAFF tab label = `shell.mySchedule`; hide the tab when unlinked (`href: null`).
- OWNER/ADMIN → picker at `/schedule`; STAFF redirect to `/schedule/[staffMemberId]`.
- Port web draft/format/validation helpers into `apps/mobile/src/features/schedule/`.
- Controls: `TimePicker`, `DatePicker`, `SwitchRow`, `Chip` (copy-to days), `confirm` (delete).
- Explicit “until end of day” toggle (TimePicker cannot express `24:00`).
- Reuse existing `business.schedule.*` i18n keys; no new contracts or ADR.

## Changes

| Area / path                                      | Change                                   |
| ------------------------------------------------ | ---------------------------------------- |
| `apps/mobile/.../schedule/*`                     | Nested stack: picker + staff schedule    |
| `apps/mobile/src/features/schedule/*`            | Editor, picker, time off, helpers, tests |
| `apps/mobile/.../[businessId]/_layout.tsx`       | Schedule tab (role-aware label / hide)   |
| `apps/mobile/.../business-overview.tsx`          | Hours checklist → schedule picker        |
| `docs/specs/87-mobile-working-hours-time-off.md` | This spec                                |

### Contracts / API

None — consume #75 endpoints and schemas.

### Data model

None.

### UI and i18n

- Hrefs: `/(business)/business/<id>/schedule`, `.../schedule/<staffId>`.
- Namespace `business.schedule.*` (+ `shell.schedule` / `shell.mySchedule`).

## Test plan

- Unit: draft round-trip / overlap / copy / `24:00`; time-off body builder; schedule hrefs.
- RNTL: picker empty CTA; STAFF redirect path resolution; forbidden for other staffId;
  working-hours closed + until-end-of-day; time-off create all-day body; delete confirm.

## Risks and open questions

- TimePicker max is `23:55` — until-end-of-day control is required (grooming note).
- Five tabs on a phone is tight; Schedule stays as a primary surface to match web nav.

## Implementation notes

- Schedule tab under the business dashboard (stack: picker + `[staffId]` editor). STAFF label is
  `shell.mySchedule`; tab hidden via `href: null` when unlinked.
- Feature module ports web #83 helpers (`working-hours-draft`, `schedule-format`,
  `map-schedule-validation`, time-off body builder) and screens (`SchedulePicker`,
  `StaffScheduleView`, `WorkingHoursEditor`, `TimeOffSection`).
- `TimePicker` + “until end of day” for `24:00`; Copy to… uses a modal with `Chip`s; time-off
  create uses a bottom sheet modal with `DatePicker`/`TimePicker`/`SwitchRow`.
- Overview hours checklist CTA → `/schedule`. Staff edit (OWNER/ADMIN) has “Open schedule”.
- No new i18n keys — reused `business.schedule.*` / `shell.schedule` / `shell.mySchedule`.
