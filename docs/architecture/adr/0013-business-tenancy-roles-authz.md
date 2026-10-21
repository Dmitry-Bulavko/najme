# ADR-0013: Business tenancy, roles and authorization

- Status: Accepted
- Date: 2026-09-30
- Related: #73, `docs/architecture/data-model.md` (Roles, Tenant scoping), ADR-0010

## Context

M2 introduces multi-tenant businesses. Every business-scoped route must share one authorization
rule so agents and reviewers do not invent per-endpoint behaviour. Owner decisions R11 / R12 / R18
fix moderation defaults, the role matrix and booking-policy defaults.

## Decision

### Role matrix

| Role    | Capabilities                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------------- |
| `OWNER` | Everything, including soft-deleting the business and managing owners                                  |
| `ADMIN` | All operational work except deleting the business and changing owners                                 |
| `STAFF` | Own calendar, bookings, working hours and time off (via linked staff member); read services and staff |

### Status codes

- Unknown business id, soft-deleted business, or caller is not a member → **404** `NOT_FOUND`
  (the three cases are indistinguishable).
- Member whose role is not in `@BusinessRoles(...)` → **403** `FORBIDDEN`.
- Cross-tenant id in the **path** → 404; in the **body** → **422** `VALIDATION_FAILED`.

### Guard order

`BusinessAccessGuard` resolves membership **before** body validation, so a non-member never
learns that a route exists via a 400 validation response. The resolved membership is injected for
resource checks (STAFF-own, etc.).

### Endpoint namespaces

| Prefix                      | Audience                                                    |
| --------------------------- | ----------------------------------------------------------- |
| `/public/*`                 | Unauthenticated discovery / booking surfaces                |
| `/businesses/:businessId/*` | Authenticated members of that business                      |
| `/me/*`                     | The caller's own resources (including `GET /me/businesses`) |
| `/admin/*`                  | Platform admins (`isPlatformAdmin`)                         |

### Slugs

- Generated from the business name with Latin/Cyrillic/Turkish transliteration.
- Pattern `^[a-z0-9]+(-[a-z0-9]+)*$`, length 3–60, not a reserved word
  (`admin`, `api`, `business`, `new`, `me`, `public`, `auth`, `health`, `categories`, `cities`).
- If transliteration yields empty, shorter than 3, or a reserved word, append `-biz` (then
  `-biz-2`, …) or numeric collision suffixes (`-2`, `-3`, …) until unique.
- Plain unique index (including soft-deleted rows) — never reuse a slug.
- Editable until `APPROVED`; afterwards `422 SLUG_LOCKED`. Collision → `409 SLUG_TAKEN`.

### Clock

New modules inject an injectable `Clock` (`now(): Date`). Tests fix it. Existing auth may keep
calling `new Date()` until migrated.

## Consequences

- Every new `:businessId` route must declare `@BusinessRoles(...)` and be covered by the
  route-walker e2e (non-member and random id → 404).
- `docs/conventions/api.md` follows this ADR for tenancy wording.
