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
- Reuse existing `business.schedule.*` i18n keys; add named a11y / deleteNamed keys as needed.

## Changes

| Area / path                                      | Change                                        |
| ------------------------------------------------ | --------------------------------------------- |
| `apps/mobile/.../schedule/*`                     | Nested stack: picker + staff schedule         |
| `apps/mobile/src/features/schedule/*`            | Editor, picker, time off, helpers, tests      |
| `apps/mobile/.../[businessId]/_layout.tsx`       | Schedule tab (role-aware label / hide)        |
| `apps/mobile/.../business-overview.tsx`          | Hours checklist → schedule picker             |
| `apps/mobile/.../staff/staff-form.tsx`           | “Open schedule” for OWNER/ADMIN edit          |
| `packages/i18n/.../business.json`                | Named labels, deleteNamed, shorter mySchedule |
| `docs/specs/87-mobile-working-hours-time-off.md` | This spec                                     |

### Contracts / API

None — consume #75 endpoints and schemas.

### Data model

None.

### UI and i18n

- Hrefs: `/(business)/business/<id>/schedule`, `.../schedule/<staffId>`.
- Namespace `business.schedule.*` (+ `shell.schedule` / `shell.mySchedule`).

## Test plan

- Unit: draft round-trip / overlap / copy / `24:00`; time-off body builder (all-day, timed, DST
  2026-10-25, year-end); schedule hrefs; validation mapping.
- RNTL WorkingHoursEditor: overlap blocks save + row error (Closed / `24:00` / Copy payloads are
  asserted in working-hours-draft unit tests).
- RNTL StaffScheduleView: PUT body, 422 `details.issues` mapping, failed save/create/delete keep
  the editor mounted, all-day create body (timed create body covered by unit), delete via mocked
  `confirm`, refresh on focus, OWNER ignores memberships errors, STAFF forbidden for other
  staffId, back-to-picker uses `canGoBack()`.
- RNTL SchedulePicker: empty CTA, STAFF redirect / no-linked, pull-to-refresh via focus load.

## Risks and open questions

- TimePicker max is `23:55` — until-end-of-day control is required (grooming note).
- Five tabs on a phone is tight; Schedule stays as a primary surface to match web nav.
  STAFF tab label shortened (`My hours` / `Мой график` / `Saatlerim`) to fit ~390px.

## Implementation notes

- Schedule tab under the business dashboard (stack: picker + `[staffId]` editor). STAFF label is
  `shell.mySchedule`; tab hidden via `href: null` when unlinked.
- Feature module ports web #83 helpers (`working-hours-draft`, `schedule-format`,
  `map-schedule-validation`, time-off body builder) and screens (`SchedulePicker`,
  `StaffScheduleView`, `WorkingHoursEditor`, `TimeOffSection`).
- `TimePicker` + “until end of day” for `24:00`; Copy to… uses Select-style modal (sibling
  backdrop + ScrollView); time-off create uses the same pattern with KeyboardAvoidingView.
- Action failures (save/create/delete) use an inline Banner near Save / inside the dialog — they
  never replace the load-error full-screen state.
- Load uses `useFocusEffect` + `RefreshControl` on both the editor and the picker.
- Delete rows are custom (not `ListItem`) so the button stays pressable on web/iOS.
- Overview hours checklist CTA → `/schedule`. Staff edit (OWNER/ADMIN) has “Open schedule”.
