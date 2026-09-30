# Testing

## Principles

- Every task ships with tests for the behaviour it adds or changes. Bug fixes start with a failing
  test that reproduces the bug.
- Test behaviour through public interfaces, not implementation details.
- Tests are deterministic: no real network, fixed clocks (inject time), seeded data.

## By layer

| Layer        | Tooling                                                                          | What to test                                                                   |
| ------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `packages/*` | Vitest                                                                           | Pure logic: schemas, locale resolution, formatting helpers                     |
| API unit     | Test runner chosen at scaffold (Vitest preferred; Jest if Nest tooling requires) | Services, slot computation, policies (mock Prisma only at repository boundary) |
| API e2e      | Supertest against the Nest app + real Postgres                                   | Endpoints: status codes, validation, authz, DB constraints                     |
| Web          | Vitest + Testing Library; Playwright for critical flows (`apps/web/e2e`)         | Components with logic, forms, i18n rendering; browser account flows            |
| Mobile       | Jest (jest-expo) + React Native Testing Library                                  | Screens with logic, hooks                                                      |

Web note: the shared Vitest base config disables `globals`, so Testing Library's auto-cleanup
(which relies on a global `afterEach`) does not run automatically — register `cleanup()` explicitly
in the app's Vitest setup file (see `apps/web/vitest.setup.ts`) to avoid DOM leaking between tests.

### Web Playwright e2e

Critical account flows live in `apps/web/e2e/*.spec.ts` and run with Playwright (Chromium). They are
**not** part of `pnpm test` / `pnpm check` — unit runs stay fast. CI runs them in the separate `e2e`
job (Postgres + Mailpit + `pnpm dev`).

Locally (with Postgres, Mailpit, and `pnpm dev` already up — see `docs/runbooks/local-dev.md`):

```bash
pnpm --filter @najme/web exec playwright install chromium   # once per machine
MAILPIT_URL=http://localhost:8025 pnpm test:e2e
```

Optional env: `WEB_BASE_URL` (default `http://localhost:3001`), `API_BASE_URL` (default
`http://localhost:3000/api/v1`), `MAILPIT_URL` (default `http://localhost:8025`). Reusable fixtures
under `apps/web/e2e/fixtures/` cover API registration, Mailpit link polling, and UI sign-in — later
phases add more `*.spec.ts` files only.

## Database in tests

- CI provides a PostgreSQL service (see `.github/workflows/ci.yml`); locally use
  `compose.dev.yml`.
- e2e tests share the migrated database. Isolation is by unique suffixes per file (typically
  `randomUUID()` on emails and provider account ids) so parallel suites do not collide. Each file
  tracks the rows it created and deletes them in `afterEach` (child rows cascade from the parent
  delete). Do not rely on truncate-all or transaction rollback across the suite.

## Time

- Inject a clock; never call `Date.now()` directly in scheduling or booking logic.
- Scheduling tests must include DST transition dates for `Europe/Podgorica` (last Sunday of March
  and October).

## Commands

- `pnpm turbo run test --filter=<pkg>` — one package.
- `pnpm turbo run test --filter=...[origin/main]` — packages changed on the branch and dependents.
- `pnpm check` — everything CI runs.
