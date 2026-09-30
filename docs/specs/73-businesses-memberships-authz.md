# #73 — Add businesses, memberships and tenant authorization

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/73
- Status: Implemented
- Related: ADR-0013, `docs/architecture/data-model.md`, `docs/conventions/api.md`, #72

## Goal

Introduce `Business` and `Membership`, a shared `BusinessAccessGuard` + role matrix, create /
read / update / soft-delete business endpoints, `GET /me/businesses`, an injectable `Clock`, and
e2e factories plus a route-walker that proves 404 for non-members on every `:businessId` route.

## Approach

- Contracts first (`business.ts`), then Prisma enums/models + raw-SQL CHECKs/indexes, then Nest
  module with slug generation, guard before body validation, and factories for later M2 tasks.
- `staffMemberId` is omitted from `Membership` until #74 (StaffMember exists); `GET /me/businesses`
  returns `staffMemberId: null`.
- Slug: transliterate → kebab-case → ensure length ≥ 3 and not reserved (suffix `-biz` / numeric
  collision suffixes) → plain unique index so soft-deleted slugs stay reserved.

## Changes

| Area / path                    | Change                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `packages/contracts`           | Business schemas, roles, statuses; `SLUG_TAKEN`, `SLUG_LOCKED`                  |
| `apps/api/prisma`              | City / BusinessStatus / ConfirmationMode / MembershipRole; Business; Membership |
| `apps/api/src/common`          | `Clock` provider                                                                |
| `apps/api/src/businesses`      | Module, service, controllers, slug util, guard, roles decorator                 |
| `apps/api/test/support`        | `createUser`, `createBusiness`, `addMember`, `expectBusinessAuthz`              |
| `docs/architecture/adr/0013-…` | Tenancy, roles, namespaces                                                      |
| `docs/conventions/api.md`      | Align with ADR-0013                                                             |

### Contracts / API

- `POST /businesses` — create (OWNER in same tx); throttle 5/hour/user
- `GET /me/businesses` — caller's memberships
- `GET /businesses/:businessId` — any member, includes `myRole`
- `PATCH /businesses/:businessId` — OWNER/ADMIN profile + booking policy + slug
- `DELETE /businesses/:businessId` — OWNER soft-delete

### Data model

As in data-model.md Business / Membership. FK: memberships → businesses/users `RESTRICT`;
`reviewed_by_user_id` `SET NULL`. No `staffMemberId` column yet.

### UI and i18n

Error strings only: `errors.SLUG_TAKEN`, `errors.SLUG_LOCKED` (en/me/ru/tr).

## Test plan

- Unit: slug transliteration/collision; Clock; businesses service authz branches
- e2e: create/list/get/patch/delete; throttle; SLUG_TAKEN / SLUG_LOCKED; `expectBusinessAuthz`;
  route-walker over every `:businessId` route
- Manual: none

## Risks and open questions

- Guard must run before Zod body pipe so non-members never see 400 validation leaks.
- Reserved-slug list starts from data-model examples; documented in ADR-0013 / this spec.

## Implementation notes

- `Membership.staffMemberId` is added in #74; until then create leaves it null and
  `GET /me/businesses` returns `staffMemberId: null`.
- Create-business throttle is 5/hour **per authenticated user** (`UserThrottlerGuard`).
- Slug fallback for empty/short/reserved bases is `-biz` (not `-x`); collision suffixes are
  `-2`, `-3`, …
- Route-walker discovers Express routes containing `:businessId` after `configureApp` and asserts
  404 `NOT_FOUND` for non-members, random UUIDs, and malformed ids.
