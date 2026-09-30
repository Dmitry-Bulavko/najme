# #74 — Add staff members and services API

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/74
- Status: Implemented
- Related: ADR-0013, `docs/architecture/data-model.md`, #73

## Goal

Owners/admins manage bookable staff and services (with custom fields). Solo specialists can be
created via `ownerIsStaff` on business create. STAFF may only read.

## Approach

- Contracts for staff + services (money via `moneySchema` with EUR-only refine).
- Prisma models with CASCADE for assignment/custom-field children; `memberships.staff_member_id`
  unique SET NULL.
- Soft-delete staff clears assignments and unlinks memberships; soft-delete services.
- Custom fields upserted by `key` (stable ids); omitted keys deleted on replace.

### ownerIsStaff display name

Prefer the owner's `displayName`; if null/empty, use the email local-part (before `@`).

## Changes

| Area      | Change                                                                     |
| --------- | -------------------------------------------------------------------------- |
| contracts | staff/service schemas; `ownerIsStaff` on create business                   |
| prisma    | StaffMember, Service, assignments, custom fields, membership.staffMemberId |
| api       | staff + services controllers/services; extend businesses create/list       |

## Test plan

- Unit: custom-field validation helpers if extracted
- e2e: CRUD staff/services; STAFF 403 on writes; ownerIsStaff; soft-delete unlinks; cross-tenant
  staffMemberIds → 422; custom-field upsert/delete

## Implementation notes

- `ownerIsStaff` display name: `User.displayName`, else email local-part, else `"Owner"`.
- Soft-deleting a staff member deletes service assignments and clears `memberships.staff_member_id`.
- Soft-deleting a service deletes assignments; custom-field definitions cascade with the row only on
  hard delete — soft-delete keeps definitions for history until hard delete (not exposed).
