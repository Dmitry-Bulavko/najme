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
```

Local services start with:

```bash
docker compose -f compose.dev.yml up -d   # PostgreSQL (port from .env)
pnpm dev                                  # all apps via turbo
```

## `apps/api`

```bash
pnpm --filter @najme/api run db:migrate:dev     # create/apply a dev migration
pnpm --filter @najme/api run db:migrate:deploy  # apply pending migrations (CI/prod contract)
pnpm --filter @najme/api dev                    # watch mode on PORT (default 3000)
pnpm --filter @najme/api test                   # unit + e2e (needs DATABASE_URL, real Postgres)
```

`GET http://localhost:3000/api/v1/health` and, outside production, OpenAPI docs at
`/api/v1/docs`. Env vars are validated with zod at startup — see `apps/api/src/config/env.schema.ts`
and `docs/conventions/env-vars.md`.

Per-app commands, ports and seed scripts are documented in each app's `README.md` (added by the
scaffold tasks — update this runbook when they land).

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
