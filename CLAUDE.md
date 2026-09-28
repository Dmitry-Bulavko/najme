# Najme — agent guide

Najme is a cross-platform **booking platform for service businesses** in Montenegro. Businesses
(salons with staff, solo specialists, transfer drivers, clinics…) publish services and working
hours; clients discover them and book a time slot. One product, two modes (client / business), on
web (Next.js) and mobile (Expo). UI locales: `en` (default), `me` (Crnogorski/Srpski, Latin), `ru`,
`tr`.

## Where things are

| Path                     | What                                                                  |
| ------------------------ | --------------------------------------------------------------------- |
| `apps/api`               | NestJS + Prisma + PostgreSQL REST API (`/api/v1`)                     |
| `apps/web`               | Next.js App Router web app (public pages + business dashboard)        |
| `apps/mobile`            | Expo + expo-router app (iOS/Android)                                  |
| `packages/*`             | Shared code: `config`, `contracts` (zod), `i18n`, `ui-tokens`         |
| `infra/`                 | Production Docker Compose, Caddy, server scripts                      |
| `docs/`                  | Knowledge base for agents — **start at `docs/README.md`**             |
| `.claude/agents, skills` | Agentic workflow: `implementer`, `reviewer`, `/implement`, `/manager` |

Apps and packages are scaffolded by roadmap tasks; if a path does not exist yet, it has not been
built.

## Golden rules

1. **Every change is tied to a GitHub issue.** No issue → ask `/manager` to create one first. See
   `docs/workflow/task-tracking.md`.
2. **Branches:** `task/<issue>-<short-slug>` from `origin/main`. If the environment assigns a
   designated branch (cloud sessions), use that branch instead.
3. **Never push to `main` or `production` directly.** Changes land via PR; releases go through
   `/manager release`. Never force-push shared branches.
4. **Commits:** Conventional Commits with the issue number: `feat(api): add health endpoint (#12)`.
5. **Done means** `docs/workflow/definition-of-done.md`: tests, lint, typecheck, build green;
   docs/ADRs updated; no secrets committed.
6. **No hardcoded UI strings.** Every user-facing string goes through i18n with all four locales
   (`docs/conventions/i18n.md`).
7. **API shapes live in `packages/contracts`** (zod) and are consumed by api, web and mobile.
8. **Architectural decisions** get an ADR in `docs/architecture/adr/`. Follow existing ADRs; if you
   need to deviate, write a new ADR that supersedes the old one.
9. Everything written to the repo or GitHub (code, docs, issues, PRs, commits) is in **English**.

## Commands

```bash
pnpm install              # install workspace deps (pnpm version pinned via packageManager)
pnpm check                # format:check + lint + typecheck + test + build (what CI runs)
pnpm turbo run test --filter=<pkg>...   # scope tasks to a package and its dependents
pnpm format               # prettier --write
```

Local services and env: `docs/runbooks/local-dev.md`. Deploy: `docs/runbooks/deploy.md`.

## Agentic workflow (short)

- `/implement [issue]` — orchestrator: picks the next ready task, runs `implementer` → `reviewer`
  loop, opens the PR, waits for CI, squash-merges.
- `/manager [status|plan|new|groom|advance|release]` — backlog and roadmap owner.
- Details: `docs/workflow/agentic-workflow.md`.
