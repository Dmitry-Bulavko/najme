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
docker compose -f compose.dev.yml up -d   # PostgreSQL on POSTGRES_PORT (default 5434)
pnpm --filter @najme/api db:migrate:deploy  # first run only: create the schema
pnpm dev                                  # builds shared packages, then API + web
```

`pnpm dev` builds `packages/*` first (turbo `dev` depends on `^build`), then starts:

| Service  | URL                          | Notes                                        |
| -------- | ---------------------------- | -------------------------------------------- |
| API      | http://localhost:3000/api/v1 | `/health`, OpenAPI docs at `/api/v1/docs`    |
| Web      | http://localhost:3001/en     | API badge shows "Online" when API + DB is up |
| Postgres | localhost:5434               | from `compose.dev.yml`                       |
| Metro    | http://localhost:8081        | mobile only, see below                       |

Env: in development the API and web load the root `.env` themselves (Node `--env-file-if-exists` /
`process.loadEnvFile`); variables already set in the shell win over the file. Production and Docker
images never read an env file. Turbo runs in strict env mode, so any variable a `dev` task reads
must be listed in that app's `turbo.json`.

API code changes are recompiled with `tsc --watch` and the process restarts; changes to shared
packages need `pnpm --filter @najme/<pkg> build` (no watch mode).

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
pnpm --filter @najme/api run db:migrate:dev     # create/apply a dev migration
pnpm --filter @najme/api run db:migrate:deploy  # apply pending migrations (CI/prod contract)
pnpm --filter @najme/api test                   # unit + e2e (needs DATABASE_URL, real Postgres)
```

## Troubleshooting

- `Invalid environment configuration` (API): root `.env` is missing or lacks `DATABASE_URL`.
- Badge shows "Unavailable": API not running, or `API_INTERNAL_URL` is unset/wrong, or the DB is
  unreachable (`/api/v1/health` returns `db: "error"`); check `POSTGRES_PORT` matches `DATABASE_URL`.
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
