# #79 — Add platform-admin moderation (API and web page)

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/79
- Status: Implemented
- Related: ADR-0013, `docs/architecture/data-model.md` (Business moderation), #73, #78, #52

## Goal

Expose `me.isPlatformAdmin`, let a platform admin list/approve/reject businesses, let owners
resubmit after rejection, and ship a minimal web admin page plus `admin:grant` / `admin:revoke`
CLIs.

## Approach

- Contracts first: extend `meSchema`; add `admin.ts` list/detail/reject schemas using existing
  `pagination` helpers.
- Nest `admin/` module with `PlatformAdminGuard` that re-reads `User.isPlatformAdmin` from the DB
  on every request. Wrong-state transitions via conditional `updateMany` → 409 `CONFLICT`.
- Resubmit stays on `BusinessesController` (OWNER/ADMIN).
- Web: nested `admin` i18n namespace, `/[locale]/admin/businesses` gated with `notFound()`, account
  menu link when `me.isPlatformAdmin`.

## Changes

| Area / path    | Change                                                         |
| -------------- | -------------------------------------------------------------- |
| contracts      | `me.isPlatformAdmin`; admin list/detail/reject; pagination use |
| api `admin/`   | guard, list/get/approve/reject; route-walker e2e               |
| api businesses | `POST …/resubmit`                                              |
| api scripts    | `admin:grant` / `admin:revoke`                                 |
| i18n           | `admin` namespace (en/me/ru/tr)                                |
| web            | admin businesses page + account-menu link                      |
| runbooks       | local-dev + deploy CLI docs                                    |

### Contracts / API

- `GET /me` → `isPlatformAdmin`
- `GET /admin/businesses?status&cursor&limit` (default `PENDING_APPROVAL`, oldest first)
- `GET /admin/businesses/:id`
- `POST /admin/businesses/:id/approve`
- `POST /admin/businesses/:id/reject { reason }`
- `POST /businesses/:businessId/resubmit`

### Data model

No migration — moderation columns already exist on `Business`.

### UI and i18n

`/[locale]/admin/businesses`: tabs Pending / Rejected / Approved, detail panel, approve + reject
dialog. Namespace `admin`.

## Test plan

- Unit: CLI unknown email exit code; me mapper includes the flag.
- e2e: grant path via prisma in test; list/approve/reject/resubmit; wrong-state 409; non-admin
  route-walker 403 on every `/admin/*`.
- Web: RTL for tabs/actions with mocked API; account menu link visibility.

## Risks and open questions

- First consumer of cursor pagination contracts.
- No email on approve/reject (out of scope).

## Implementation notes

- Category name comes from the English `CategoryTranslation` (slug fallback).
- Admin list cursor is opaque base64url `{ createdAt, id }` for oldest-first pagination.
- Web account-menu Admin link uses `admin.menuLink`; page gated with `notFound()` for
  non-admins. Resubmit UI stays out of scope (#80).
- `request.test.ts` now only checks spread namespaces (`common`/`shell`); nested catalogs may
  share root keys.
