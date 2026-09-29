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
docker compose -f compose.dev.yml up -d   # PostgreSQL (POSTGRES_PORT, default 5434) + Mailpit
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
| Metro    | http://localhost:8081        | mobile only, see below                             |

Env: in development the API, web and the Prisma CLI (migrate/generate) load the root `.env` themselves (Node `--env-file-if-exists` /
`process.loadEnvFile`); variables already set in the shell win over the file. Production and Docker
images never read an env file. Turbo runs in strict env mode, so any variable a `dev` task reads
must be listed in that app's `turbo.json`.

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

## Mobile

Kept out of `pnpm dev` (Expo's interactive CLI does not fit turbo's stream UI):

```bash
pnpm --filter @najme/mobile start
```

`EXPO_PUBLIC_API_URL` comes from the root `.env` or `apps/mobile/.env.local`. Simulators can use
`http://localhost:3000/api/v1`; **Expo Go on a physical device needs your machine's LAN IP**, e.g.
`EXPO_PUBLIC_API_URL=http://192.168.1.20:3000/api/v1` (phone on the same Wi-Fi). Restart Metro with
`--clear` after changing it.

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

| Command                                                   | What                            |
| --------------------------------------------------------- | ------------------------------- |
| `pnpm check`                                              | Everything CI runs              |
| `pnpm turbo run test --filter=@najme/<pkg>`               | Tests for one package           |
| `pnpm turbo run lint typecheck --filter=...[origin/main]` | Only what changed on the branch |
| `pnpm format`                                             | Format the repo                 |

## Claude Code

- Cloud sessions run `.claude/hooks/session-start.sh`, which installs dependencies automatically.
- Typical requests: "implement the next task" (`/implement`), `/manager status`,
  `/manager plan "<goal>"`.
