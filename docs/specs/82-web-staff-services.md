# #82 — Build web staff and services management

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/82
- Status: Implemented
- Related: ADR-0013, `docs/architecture/data-model.md` (Custom-field snapshots), #74, #78,
  #81, UI-STD

## Goal

Owners and admins manage staff and services in the browser (assignments, custom booking fields).
STAFF see read-only lists. Empty states include CTAs.

## Approach

- Feature modules under `apps/web/src/features/staff` and `features/services`, thin App Router
  pages under the existing `BusinessShell`.
- Reuse kit `MoneyInput` (minor units), `Select` (duration/buffers), `Checkbox` (staff
  assignments), `AlertDialog` (delete), `ImageUpload` (`STAFF_PHOTO` after create).
- Linked member on the staff list: join `GET .../members` (OWNER/ADMIN) by `staffMemberId`.
  STAFF cannot call members → column shows “not linked” without a members fetch.
- Custom-field keys auto-slug from label (`^[a-z][a-z0-9_]{0,39}$`), editable until first
  successful save; save sends full `customFields` array (replace semantics).
- Map `VALIDATION_FAILED` for `staffMemberIds` (zod issues and `{ staffMemberIds: [...] }`
  details) and nested `customFields` paths onto form fields.

## Changes

| Area / path                           | Change                                                |
| ------------------------------------- | ----------------------------------------------------- |
| `apps/web/.../staff/*`                | List, create, edit routes + feature components        |
| `apps/web/.../services/*`             | List, create, edit + custom-field editor              |
| `packages/i18n/.../business.json`     | `staff.*`, `services.*`, `customFields.*` (4 locales) |
| `docs/specs/82-web-staff-services.md` | This spec                                             |

### Contracts / API

None — consume existing staff/services contracts and endpoints from #74.

### Data model

None.

### UI and i18n

- Routes: `/business/[businessId]/staff`, `.../staff/new`, `.../staff/[staffId]`,
  `.../services`, `.../services/new`, `.../services/[serviceId]`.
- Namespace `business` keys for staff, services and custom fields (en/me/ru/tr).
- Nav already has staff/services segments (#80); no placeholder pages remain.

## Test plan

- Unit/RTL: staff list empty/CTA/read-only STAFF; staff delete confirm; service form duration/
  price/`staffMemberIds` error mapping; custom-field slug + lock after save; remove note.
- Manual: create staff → upload photo; create service with SELECT field and staff checkboxes.

## Risks and open questions

- Photo only after create (API requires `staffId` for `STAFF_PHOTO`) — create redirects to edit.
- Members list is OWNER/ADMIN-only; STAFF list omits named linked member.

## Implementation notes

- Staff photo only on edit (API needs `staffId`); create redirects to edit.
- Linked member via `GET .../members` for OWNER/ADMIN; STAFF list shows “—” without fetch.
- Custom-field editor keeps local drafts; keys lock after a successful save round-trip.
- No new ADR; nav segments from #80 already pointed at these routes.
