# #72 — Category and city catalogue

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/72
- Status: Implemented
- Related: `docs/architecture/data-model.md` (Category, Cities), ADR-0004, ADR-0005, #67

## Goal

Ship reference data every business needs: a seeded, translated, read-only category catalogue with
a public `GET /categories` endpoint, and Montenegro's 25 municipalities as contracts + i18n keys.
Confirm the 2026-09-29 owner decisions (#67) are already on `main` before any schema work.

## Approach

- **Categories** live in Postgres (`Category` + `CategoryTranslation`), created and seeded by a
  backward-compatible migration with hard-coded UUID v7 ids and `ON CONFLICT DO NOTHING`, so
  production and every environment get the same catalogue without `db seed`.
- **Cities** stay out of Prisma until #73 (`Business` + `City` enum). This task only exports
  `CITY_CODES` / `citySchema` / `FEATURED_CITIES` from contracts and display names under
  `common.cities.<CODE>` in all four locales.
- Public list endpoint returns the requested locale's name (fallback `en`), sorted by `sortOrder`,
  with a short public cache header. No new ADR.

## Changes

| Area / path                                   | Change                                                        |
| --------------------------------------------- | ------------------------------------------------------------- |
| `packages/contracts/src/cities.ts`            | `CITY_CODES`, `citySchema`, `FEATURED_CITIES`                 |
| `packages/contracts/src/categories.ts`        | query + category response schemas                             |
| `packages/contracts/src/index.ts`             | re-exports                                                    |
| `apps/api/prisma/schema.prisma`               | `Category`, `CategoryTranslation`                             |
| `apps/api/prisma/migrations/…_categories/`    | tables + idempotent seed of 10 categories × 4 locales         |
| `apps/api/src/categories/`                    | public `GET /categories` module                               |
| `packages/i18n/.../common.json` (en/me/ru/tr) | `cities.<CODE>` for all 25 municipalities                     |
| contracts + API e2e tests                     | city↔i18n parity; locale, fallback, validation, Cache-Control |

### Contracts / API

- `GET /api/v1/categories?locale=<en\|me\|ru\|tr>` — `@Public()`, no auth.
- Response: `[{ id, slug, name, iconKey, sortOrder }]` sorted by `sortOrder` ascending.
- Invalid / missing `locale` → 400 `VALIDATION_FAILED`.
- Missing translation for a category → English name.
- `Cache-Control: public, max-age=300`.

### Data model

Prisma models match `data-model.md` exactly. Seed: slugs `transfer`, `cleaning`, `dentist`,
`nails`, `hair`, `massage`, `beauty`, `repair`, `babysitting`, `tutoring`; `sortOrder` 10…100 step
10; `iconKey` null; names en/me/ru/tr. `City` enum / `Business` deferred to #73.

### UI and i18n

No UI screens. Keys: `common.cities.<CODE>` × 25 × 4 locales (`me` Latin with diacritics, `ru`
Cyrillic).

## Test plan

- Unit (contracts): `CITY_CODES` length 25; `FEATURED_CITIES` subset and order; schemas parse;
  every locale's `common.cities` keys equal `CITY_CODES`.
- e2e (API): `GET /categories?locale=en` returns 10 seeded rows sorted; `locale=me` returns me
  names; delete one non-en translation → that row falls back to en; invalid locale → 400;
  Cache-Control header present.
- Manual: none required beyond migrate + smoke.

## Risks and open questions

- Category display names for me/ru/tr are implementer translations — list under "Translations to
  verify" in the handoff.
- Seed UUIDs are fixed forever; later admin CRUD (M6) must not redefine them.

## Implementation notes

- 2026-09-29 decisions already on `main` via #67 (`data-model.md` amendment, cities list,
  Category tables); nothing missing for this issue.
- Seed UUIDs generated with `uuid` v7 at implement time; fixed in the migration forever.
- Category me/ru/tr names are implementer translations (verify with a native speaker).
- `City` Prisma enum deferred to #73 as specified.
