# #88 — Add a dev seed and the M2 end-to-end test

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/88
- Status: Implemented
- Related: #57, #79, #83, #84, `docs/runbooks/local-dev.md`, ADR-0013

## Goal

Developers get realistic, idempotent demo data via `pnpm --filter @najme/api db:seed` (refused in
production). CI proves the M2 exit flow in Playwright: owner setup → staff invite/accept →
platform-admin approval, reusing the #57 fixtures, with traces uploaded on failure.

## Approach

- **Seed** as a Prisma 7 `migrations.seed` script (`prisma db seed` / `db:seed` package script).
  Fixed emails and UUIDs so reruns update rather than duplicate. Argon2id password hashes match
  the auth module. Production guard checks `NODE_ENV === 'production'` and exits non-zero.
  Categories come from the migration seed (lookup by `hair` slug); no booking rows.
- **Playwright** `apps/web/e2e/m2-exit-flow.spec.ts` extends `./fixtures` (Mailpit, register,
  sign-in). CI `e2e` job runs `db:seed` after migrate so the seeded admin can approve. Spec does
  not upload photos (MinIO optional). Trace/screenshot/video already `retain-on-failure`; CI
  already uploads `test-results/` and `playwright-report/`.

## Changes

| Area / path                         | Change                                                         |
| ----------------------------------- | -------------------------------------------------------------- |
| `apps/api/src/dev-seed/`            | Seed constants + `runDevSeed` + production guard (not in dist) |
| `apps/api/prisma/seed.ts`           | CLI entry for `prisma db seed`                                 |
| `apps/api/prisma.config.ts`         | `migrations.seed` (`tsx` devDependency)                        |
| `apps/api/tsconfig*.json`           | Exclude `src/dev-seed` from build; include seed entry files    |
| `apps/api/package.json`             | `db:seed` script                                               |
| `apps/web/e2e/m2-exit-flow.spec.ts` | M2 exit Playwright flow                                        |
| `.github/workflows/ci.yml`          | `db:generate` + `db:seed` before Playwright                    |
| `docs/runbooks/local-dev.md`        | Seed command + account table + re-run semantics                |

### Contracts / API

None.

### Data model

No migration. Seed writes into existing tables only (users, auth identities, businesses,
memberships, staff, services, custom fields, working hours).

### UI and i18n

None (e2e asserts existing English catalog strings).

## Test plan

- Unit: production guard rejects `NODE_ENV=production`; allows other values.
- Unit/integration (when `DATABASE_URL` available): seed twice → same user/business ids, expected
  staff/service/hours counts, Demo Salon `APPROVED`, second business `PENDING_APPROVAL`.
- Playwright: M2 exit flow (CI `e2e` job).
- Manual: `pnpm --filter @najme/api db:seed` against local Postgres; sign in with documented
  accounts.

## Risks and open questions

- Docker/Postgres may be unavailable locally; seed and e2e still ship ready for CI.
- Long browser flow — raise the M2 spec timeout; keep workers at 1.
- STAFF nav label is `shell.mySchedule` ("My hours" in en); assert that string and absence of
  Team/Settings (issue wording "My schedule").

## Implementation notes

- Seed logic lives in `apps/api/src/dev-seed/` (unit-tested production guard + e2e shape/
  idempotency). Excluded from `tsconfig.build.json` so passwords never ship in the API image.
  `prisma/seed.ts` is the Prisma 7 CLI entry; `migrations.seed` runs `tsx prisma/seed.ts`.
- Users upsert by email; businesses match fixed ids and refuse a foreign slug collision. Demo
  Salon children reset+recreate inside a transaction; approval timestamps stay stable on re-seed.
- Playwright: create staff/service assert edit URLs; Copy uses `exact: true`; STAFF opens only
  Alex’s schedule (Sam’s is forbidden); admin pending list loads more until the row appears.
- CI `e2e` job runs `db:generate` then `db:seed` after migrate; artifact `playwright-e2e`.
