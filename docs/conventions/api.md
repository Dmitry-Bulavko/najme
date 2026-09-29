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

- Define request and response schemas in `packages/contracts/src/<domain>/…` first; export schema +
  inferred type. The controller validates input with the schema and returns data matching the
  response schema.
- OpenAPI docs are generated from the same schemas and served at `/api/v1/docs` outside production.

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
- Authorization is checked in services, not only guards: business-scoped endpoints verify the user's
  membership and role in that business. Every business-scoped endpoint gets an e2e test proving a
  non-member receives 403/404.

## Other

- `GET /api/v1/health` returns `{ "status": "ok", "db": "ok", "version": "<git sha>" }`.
- Rate-limit auth endpoints.
- Accept-Language is honoured only for server-rendered text (e.g. emails); API error messages stay in
  English.
