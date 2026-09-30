# Local development

## Prerequisites

- Node.js 24 LTS (`.nvmrc`; `nvm use`). Node 22 also works for local dev.
- pnpm via Corepack: `corepack enable pnpm` (version pinned in root `package.json`).
- Docker (for PostgreSQL and other local services).
- For mobile: Expo tooling per the Expo docs (Xcode / Android Studio or a physical device with a
  development build).

## First run

```bash
corepack enable pnpm
pnpm install
cp .env.example .env
docker compose -f compose.dev.yml up -d   # PostgreSQL, Mailpit, MinIO (+ minio-init)
pnpm --filter @najme/api db:migrate:deploy  # first run only: create the schema
pnpm dev                                  # builds shared packages, then API + web
```

`pnpm dev` builds `packages/*` first (turbo `dev` depends on `^build`), then starts:

| Service  | URL                          | Notes                                              |
| -------- | ---------------------------- | -------------------------------------------------- |
| API      | http://localhost:3000/api/v1 | `/health`, OpenAPI docs at `/api/v1/docs`          |
| Web      | http://localhost:3001/en     | API badge shows "Online" when API + DB is up       |
| Postgres | localhost:5434               | from `compose.dev.yml`                             |
| Mailpit  | http://localhost:8025        | inbox for every email the API sends (SMTP on 1025) |
| MinIO    | http://localhost:9000        | S3 API; console at :9001 (user/pass from `.env`)   |
| Metro    | http://localhost:8081        | mobile only, see below                             |

Env: in development the API, web and the Prisma CLI (migrate/generate) load the root `.env` themselves (Node `--env-file-if-exists` /
`process.loadEnvFile`); variables already set in the shell win over the file. Production and Docker
images never read an env file. Turbo runs in strict env mode, so any variable a `dev` task reads
must be listed in that app's `turbo.json`.

The API `dev` runner (`apps/api/scripts/dev.mjs`) only passes `--env-file-if-exists=../../.env` when
that file exists. On Node 22, watch mode also watches the env-file path and would crash with
`ENOENT` if the flag pointed at a missing file; Node 24 is more tolerant. You can still run with
exported shell variables and no root `.env` (for example in a fresh worktree).

API code changes are recompiled with `tsc --watch` and the process restarts; changes to shared
packages need `pnpm --filter @najme/<pkg> build` (no watch mode).

## Email (Mailpit)

In development the API sends email over SMTP to Mailpit (`compose.dev.yml`, `SMTP_HOST=localhost`,
`SMTP_PORT=1025`). Open http://localhost:8025 to read them, e.g. the sign-up verification link
(`http://localhost:3001/<locale>/verify-email?token=…`) or the password reset link. Nothing is
delivered to real addresses. Mailpit keeps messages in memory; restart the container to clear them.

The Mailpit-backed API e2e suite (`test/auth-mailpit.e2e-spec.ts`) runs when `MAILPIT_URL` is set
(`MAILPIT_URL=http://localhost:8025 pnpm --filter @najme/api test`); without it the suite is skipped
and the fake-mailer suite still covers the same flows. CI always sets it.

## Object storage (MinIO)

Photo uploads use S3-compatible storage (ADR-0014). Locally that is MinIO from `compose.dev.yml`
(API `:9000`, console `:9001`) via the pinned Pigsty community image (`pgsty/minio`, because
Docker Hub `minio/minio` was removed). `minio-init` runs `apps/api/scripts/storage-init.mjs` to
create the `najme` bucket and allow anonymous read under `businesses/*`. CORS for the web origin is
set on the MinIO process via `MINIO_API_CORS_ALLOW_ORIGIN`.

`STORAGE_*` defaults in `.env.example` match those containers. The API builds the S3 client lazily,
so `pnpm dev` still boots if MinIO is down — uploads fail only when first used. After pulling,
copy any new `STORAGE_*` keys from `.env.example` into your local `.env` or the API will refuse to
start.

**Physical devices:** set **both** `STORAGE_ENDPOINT` and `STORAGE_PUBLIC_BASE_URL` to your
machine’s LAN IP (the presign `url` is built from `STORAGE_ENDPOINT`), e.g.
`http://192.168.1.20:9000` and `http://192.168.1.20:9000/najme`, not `localhost`. Same rule as
`EXPO_PUBLIC_API_URL`.

### Web Playwright e2e (account flow)

With the stack from "First run" already healthy (API `:3000`, web `:3001`, Mailpit `:8025`):

```bash
pnpm --filter @najme/web exec playwright install chromium   # once per machine
MAILPIT_URL=http://localhost:8025 pnpm test:e2e
```

Specs are under `apps/web/e2e/`. Plain `pnpm test` / `pnpm check` do **not** run them. On failure,
Playwright writes traces and screenshots under `apps/web/test-results/` (gitignored).

## Mobile

Kept out of `pnpm dev` (Expo's interactive CLI does not fit turbo's stream UI):

```bash
pnpm --filter @najme/mobile start
```

`EXPO_PUBLIC_API_URL` comes from the root `.env` or `apps/mobile/.env.local`. Simulators can use
`http://localhost:3000/api/v1`; **Expo Go on a physical device needs your machine's LAN IP**, e.g.
`EXPO_PUBLIC_API_URL=http://192.168.1.20:3000/api/v1` (phone on the same Wi-Fi). Restart Metro with
`--clear` after changing it.

### Development builds and Google sign-in (#55)

Expo Go is fine for email/password auth. Google Sign-In needs a **development build** because
`@react-native-google-signin/google-signin` is a native module:

```bash
# With Xcode / Android SDK installed on your machine:
pnpm --filter @najme/mobile exec npx expo run:ios
# or
pnpm --filter @najme/mobile exec npx expo run:android
```

Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (and API
`GOOGLE_CLIENT_IDS`, see #58). Without them — or in Expo Go — the "Continue with Google" button
stays hidden and the app does not crash. `pnpm --filter @najme/mobile build` (`expo export
--platform web`) must keep working without native Google.

See `apps/mobile/README.md` for the full mobile auth notes.

## Other API commands

```bash
pnpm --filter @najme/api run db:generate        # regenerate the Prisma client
pnpm --filter @najme/api run db:migrate:dev     # create/apply a dev migration
pnpm --filter @najme/api run db:migrate:deploy  # apply pending migrations (CI/prod contract)
pnpm --filter @najme/api test                   # unit + e2e (needs DATABASE_URL, real Postgres)
```

The package scripts (`test`, `typecheck`, `build`) no longer regenerate the Prisma client. After a
schema change, run `pnpm --filter @najme/api db:generate`, or any turbo task such as
`pnpm turbo run typecheck --filter=@najme/api`, which runs `db:generate` first.

## Troubleshooting

- `Invalid environment configuration` (API): root `.env` is missing or lacks `DATABASE_URL`.
- Badge shows "Unavailable": API not running, or both `API_INTERNAL_URL` and `PUBLIC_URL` are
  unset or point at the wrong API (`API_INTERNAL_URL` is optional; the badge falls back to
  `PUBLIC_URL` + `/api/v1`), or the DB is unreachable (`/api/v1/health` returns `db: "error"`); check `POSTGRES_PORT` matches `DATABASE_URL`.
- `Can't resolve '@najme/...'`: packages are not built; run `pnpm turbo run build --filter='./packages/*'`.
- `EADDRINUSE`: a previous dev run is still alive on 3000/3001; stop it.

## Everyday commands

| Command                                                   | What                                     |
| --------------------------------------------------------- | ---------------------------------------- |
| `pnpm check`                                              | Everything CI runs (not Playwright)      |
| `pnpm test:e2e`                                           | Web Playwright account e2e (needs stack) |
| `pnpm turbo run test --filter=@najme/<pkg>`               | Tests for one package                    |
| `pnpm turbo run lint typecheck --filter=...[origin/main]` | Only what changed on the branch          |
| `pnpm format`                                             | Format the repo                          |

## Claude Code

- Cloud sessions run `.claude/hooks/session-start.sh`, which installs dependencies automatically.
- Typical requests: "ревью" / `/review`, `/manager status`, `/manager plan "<goal>"`;
  `/implement` only as the fallback when Cursor is unavailable (ADR-0012).
