# #86 — Build mobile staff and services management

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/86
- Status: Implemented
- Related: ADR-0013, `docs/specs/82-web-staff-services.md`, `docs/specs/85-mobile-business-mode.md`,
  UI-STD, #74, #82, #85

## Goal

Owners and admins manage staff and services on mobile at parity with web #82 (lists, editors,
photo upload, custom booking fields). STAFF see read-only lists. Working hours stay out of scope
(#87).

## Approach

- Convert Staff and Services tab stubs into nested stacks (same pattern as More under #85).
- Port web feature logic from `apps/web/src/features/staff/*` and `features/services/*` into
  mobile feature modules; adapt controls to the mobile UI kit (`Select`, `SwitchRow`, `MoneyInput`,
  `Chip`, `FormField`, `ListItem`, `confirm`, `Avatar`, `Screen`, `Section`, `Banner`).
- Extend `BusinessImageUpload` for `STAFF_PHOTO` + `staffId` (attach/delete staff photo endpoints).
  Photo only on edit; create navigates to edit. On Expo web: preview stays, edit actions hidden.
- `canEdit` = `myRole` OWNER|ADMIN via `useBusinessContext()`. STAFF skip the members fetch.
- Reuse existing `business.staff.*`, `business.services.*`, `business.customFields.*` i18n keys;
  add keys only if missing.
- No new contracts or ADR — consume #74 APIs and #82 validation mapping.

## Changes

| Area / path                                 | Change                                              |
| ------------------------------------------- | --------------------------------------------------- |
| `apps/mobile/.../staff/*`, `.../services/*` | Nested stacks: list / new / `[id]`                  |
| `apps/mobile/src/features/staff/*`          | Staff list + form                                   |
| `apps/mobile/src/features/services/*`       | Service list + form, custom fields, presets, map    |
| `apps/mobile/.../business-image-upload.tsx` | `STAFF_PHOTO` attach path + `photoUrl` callback     |
| `packages/i18n/.../business.json`           | Only if a mobile-specific key is missing            |
| `docs/specs/86-mobile-staff-services.md`    | This spec                                           |
| `docs/specs/85-mobile-business-mode.md`     | Note staff/services are no longer stubs (if needed) |

### Contracts / API

None — reuse staff/services/upload contracts from #74.

### Data model

None.

### UI and i18n

- Hrefs: `/(business)/business/<id>/staff`, `.../staff/new`, `.../staff/<staffId>`, same for
  services (`businessHref()` where helpful).
- Namespace `business` (already registered on mobile).
- Tab headers hidden so nested stacks own titles (More pattern).

## Test plan

- RNTL: staff list empty CTA / STAFF read-only; staff delete `confirm`; service form MoneyInput +
  presets; STAFF read-only services; custom-field key slug lock after save; STAFF_PHOTO upload
  path; service form validation details mapping.
- Unit: `mapServiceValidationErrors`, slug helpers (ported).

## Risks and open questions

- Photo only after create (API requires `staffId` for `STAFF_PHOTO`) — create navigates to edit with
  `?created=1` so the edit screen shows the created banner once.
- Members list is OWNER/ADMIN-only; STAFF skip the members fetch and show “—” (`linkedUnknown`)
  instead of “Not linked”.

## Implementation notes

- Nested stacks under Staff and Services tabs (list / new / `[id]`); tab headers hidden so stacks
  own titles (More pattern from #85).
- Feature modules mirror web #82: `staff-list`/`staff-form`, `service-list`/`service-form`,
  `custom-fields-editor`, `service-presets`, `slug-custom-field-key`, `map-service-validation`.
- `BusinessImageUpload` supports `STAFF_PHOTO` + `staffId` (PUT/DELETE
  `/businesses/:id/staff/:staffId/photo`); create navigates to edit for photo; Expo web keeps
  preview and hides edit actions. DELETE logo/cover/staff-photo returns 204 — clear the matching
  URL via `onChanged` without parsing a body.
- Staff selection uses `Chip`; active toggles use `SwitchRow`; deletes use `confirm({ destructive })`.
- `MoneyInput` commits on every change (same as web #82): valid → `onChange(minor)`; invalid
  non-empty → `onChange(null)` + `onDraftInvalidChange(true)`; draft text stays visible. Service
  form tracks `priceDraftInvalid` and blocks submit with `services.errors.priceInvalid`.
- Lists refetch on focus (`useFocusEffect`); spinner only when there is no data yet; pull-to-refresh
  via `RefreshControl`. Form back uses `router.back()` when possible.
- Linked member via `GET .../members` for OWNER/ADMIN; STAFF show em dash without a members fetch.
- Label-in-name a11y keys: `staff.editNamed` / `deleteNamed`, `services.editNamed` / `deleteNamed`,
  `customFields.removeOptionNamed`.
- No new ADR or contracts.
