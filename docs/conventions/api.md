# API conventions

## Basics

- Base path `/api/v1`. Breaking changes require `/api/v2` for the affected resources (avoid them).
- JSON only; `camelCase` fields; timestamps as ISO 8601 UTC strings (`2026-10-01T09:00:00.000Z`);
  money as integer minor units + ISO currency (`{ "amount": 2500, "currency": "EUR" }`).
- IDs are opaque strings: **UUID v7** (time-ordered, so they sort and index well; generated
  application-side, not by Postgres' `gen_random_uuid()` which is v4).
- Resource naming: plural nouns, nested only one level for ownership
  (`/businesses/:businessId/services`).

## Contracts

- Define request and response schemas in `packages/contracts/src/<domain>.ts` first (flat files,
  re-exported from `src/index.ts`); export schema + inferred type. The controller validates input
  with the schema and returns data matching the response schema.
- OpenAPI at `/api/v1/docs` (outside production) is NestJS Swagger built from controller
  decorators (`@ApiTags`, `@ApiOperation`, …) — not generated from the zod contracts.

## Errors

Every error response uses the envelope from contracts:

```json
{ "error": { "code": "SLOT_TAKEN", "message": "Human-readable (English) message", "details": {} } }
```

- `code` is a stable `UPPER_SNAKE_CASE` identifier; clients translate codes via i18n, never by
  parsing `message`.
- Status codes: 400 validation (`VALIDATION_FAILED` with field details), 401 unauthenticated,
  403 forbidden, 404 not found, 409 conflict (e.g. `SLOT_TAKEN`), 422 domain rule violated, 429 rate
  limited, 500 unexpected.

## Pagination and filtering

- Cursor pagination for feeds and lists: `?limit=20&cursor=…` → `{ "items": [...], "nextCursor": "…" | null }`.
- Filters as query params, validated by a contract schema; sorting via `?sort=field` / `-field`.

## Auth and authorization

- `Authorization: Bearer <accessToken>`. A global guard protects every route; public endpoints are
  explicitly marked with `@Public()`. Every 401 carries `UNAUTHENTICATED` (session details: ADR-0010).
- **Tenancy (ADR-0013).** Business-scoped routes live under `/businesses/:businessId/…` and use
  `BusinessAccessGuard` + `@BusinessRoles(...)`. Membership is resolved **before** body validation:
  - unknown / soft-deleted business, or non-member → **404** `NOT_FOUND`;
  - member without an allowed role → **403** `FORBIDDEN`;
  - cross-tenant id in the path → 404; in the body → **422** `VALIDATION_FAILED`.
- Namespaces: `/public/*` (unauthenticated), `/businesses/:businessId/*` (members), `/me/*`
  (caller's own data), `/admin/*` (platform admins). Role matrix: OWNER (everything), ADMIN (ops
  except delete business / manage owners), STAFF (own calendar + read services/staff).
- Every business-scoped endpoint gets an e2e test (and the route-walker) proving a non-member
  receives 404.

## Other

- `GET /api/v1/health` returns `{ "status": "ok", "db": "ok", "version": "<git sha>" }`.
- Rate-limit auth endpoints.
- Accept-Language is honoured only for server-rendered text (e.g. emails); API error messages stay in
  English.
