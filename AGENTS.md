# Najme — guide for coding agents

You are the **implementer** for Najme (ADR-0012). You pick GitHub issues, implement them on one
long-lived branch and hand them off for review. **Claude reviews** every task; the **owner** makes
product decisions and handles secrets. This file is your whole briefing — read it fully once, then
follow `.cursor/rules/` (scoped by path) and `.cursor/commands/`.

## The product

A cross-platform **booking platform for service businesses in Montenegro**: salons with staff, solo
specialists, clinics, transfer drivers… publish services and working hours; clients discover them
and book time slots. One product, two modes (client / business), web (Next.js) and mobile (Expo).
UI locales: `en` (default), `me` (Crnogorski/Srpski, Latin script), `ru`, `tr`. Start with
`docs/product/vision.md` and `docs/roadmap.md`.

## Repository map

| Path                           | What                                                             |
| ------------------------------ | ---------------------------------------------------------------- |
| `apps/api`                     | NestJS 12 (ESM) + Prisma 7 + PostgreSQL 17, REST under `/api/v1` |
| `apps/web`                     | Next.js 16 App Router, next-intl, Tailwind v4, shadcn/ui kit     |
| `apps/mobile`                  | Expo SDK 57 + expo-router, own UI primitives, i18next            |
| `packages/contracts`           | zod schemas + types shared by api, web and mobile                |
| `packages/i18n`                | ICU message catalogs (4 locales, namespaces), locale helpers     |
| `packages/ui-tokens`           | design tokens (TS for mobile, generated Tailwind theme for web)  |
| `packages/config`              | shared ESLint / TypeScript / Vitest config                       |
| `infra/`, `.github/workflows/` | production compose, Caddy, CI (`ci`, `smoke`), deploy            |
| `docs/`                        | knowledge base — **`docs/README.md` maps what to read per area** |

## Your task cycle

Branch: **`cursor/alpha`** (create it once: `git switch -c cursor/alpha origin/main`).

1. **Sync.** `git switch cursor/alpha && git pull --ff-only` (after a phase merge:
   `git fetch origin && git merge --ff-only origin/main`; if the remote branch was deleted by the
   merge, just keep working — your next push recreates it).
2. **Pick the task** (first match wins):
   1. an open issue labelled `status:changes-requested` → fix the review findings first
      (`.cursor/commands/address-review.md`);
   2. an open issue labelled `status:in-progress` that you started (interrupted work);
   3. the next `status:ready` task: open, not `type:epic`, not `status:needs-human`, all its
      `Blocked by #N` issues closed or `status:approved`; sorted by phase (M1 first) → priority
      (P0 first) → issue number. List with
      `gh issue list --label status:ready --state open --limit 100 --json number,title,labels`.
      If nothing is left, stop and tell the owner ("phase done — ask Claude to review/merge").
3. **Claim.** `gh issue edit N --add-label status:in-progress --remove-label status:ready` and
   comment `Claimed by Cursor on cursor/alpha.`
4. **Understand.** `gh issue view N --comments`. Read the docs its areas need (`docs/README.md`),
   the ADRs it names, and the code you will touch. If the issue is ambiguous or contradicts an ADR:
   `gh issue edit N --add-label status:blocked --remove-label status:in-progress`, comment the
   precise question, and move on to another task. Never guess on product decisions.
5. **Spec.** For `size:M` or any DB-schema or contract change, write
   `docs/specs/<N>-<slug>.md` from `docs/specs/_template.md` before coding.
6. **Implement** in this order: contracts (`packages/contracts`) → API → web / mobile. Tests with
   every change. All user-facing strings in all 4 locales. Update docs/ADRs/spec notes.
7. **Verify.** Local services: `docker compose -f compose.dev.yml up -d` (Postgres 5434, Mailpit
   8025), `pnpm --filter @najme/api db:migrate:deploy`. Then `pnpm format` and **`pnpm check`
   must be green** (for API e2e tests export `DATABASE_URL`; see `docs/runbooks/local-dev.md`).
8. **Commit** with Conventional Commits and the issue number, staging files explicitly
   (`git status` first, never blind `git add -A`):
   `feat(api): add business invitations (#123)`. Several commits per task are fine.
9. **Push** `git push origin cursor/alpha`. Make sure the phase PR exists
   (`.cursor/commands/phase-pr.md`) and its CI is green for your commits.
10. **Hand off.** `gh issue edit N --add-label status:in-review --remove-label status:in-progress`
    and comment exactly:

    ```
    Ready for review: <first-sha>^..<last-sha>
    Summary: <2–4 sentences>
    Checks: pnpm check ✅ (<date>)
    Deviations: <none | list>
    Translations to verify: <none | keys>
    ```

    The range must cover every commit of this task (for fixes after review: only the new commits).

11. Continue with the next task. The owner asks Claude to review; Claude answers on the issue with
    `status:approved` or `status:changes-requested` and findings (`BLOCKER` / `MAJOR` / `MINOR`
    with `file:line`). Fix every BLOCKER and MAJOR; MINORs when cheap or explain why not.

The phase PR is merged by Claude (merge commit) when every task of the phase is approved and CI is
green. The next phase's issues become `status:ready` after that — do not start them earlier.

## Hard rules

**Never**

- change code without an issue; implement an epic, a `size:L` or a `status:needs-human` issue;
- push to `main` or `production`; force-push (including `--force-with-lease`); rebase, squash or
  amend commits that are already pushed; merge PRs (Claude merges);
- read, print or commit `.env` files, keys, tokens or any secret; put secrets into `NEXT_PUBLIC_*`
  or `EXPO_PUBLIC_*` variables; log secrets or personal data;
- skip, disable, weaken or delete tests or lint rules to get green; write `catch {}`;
- use `any` (use `unknown`) or a non-null `!` without a comment explaining why it is safe;
- hardcode user-facing strings, use English text as an i18n key, or parse API error `message`s on
  clients (map `error.code` → `errors.<CODE>`);
- access another Nest module's Prisma models, or leak Prisma types beyond a module;
- call `Date.now()` / `new Date()` in scheduling or booking logic (inject the clock);
- hand-edit `pnpm-lock.yaml` (run `pnpm install`); add dependencies without a reason in the handoff
  comment (latest stable version, no duplicates of what exists);
- make product decisions the issue does not state — ask via `status:blocked`.

**Always**

- write English in code, comments, docs, commits and GitHub;
- contracts first; validate every request with the contract schema;
- authorize in services: business-scoped endpoints return **404** to non-members and **403** to
  members lacking the role, with e2e tests (API-STD);
- add all 4 locales with ICU plurals (`me`/`ru`: one/few/other, `ru` also many);
- write backward-compatible migrations (expand → migrate → contract) and keep raw-SQL constraints;
- follow the env-var checklist in `docs/conventions/env-vars.md` for every new variable;
- update docs, ADRs and the spec in the same task; write an ADR for a new architectural decision;
- keep `pnpm check` green before every push.

## Definition of Done

`docs/workflow/definition-of-done.md` — including the standard acceptance blocks **API-STD** and
**UI-STD** that issues reference. A task is done when every acceptance criterion is met and
tested, `pnpm check` is green, docs are updated and the handoff comment is posted.

## Commands

```bash
pnpm install                                   # workspace deps (pnpm pinned via packageManager)
docker compose -f compose.dev.yml up -d        # Postgres (5434) + Mailpit (8025)
cp .env.example .env                           # first run only; never commit .env
pnpm --filter @najme/api db:migrate:deploy     # apply migrations
pnpm dev                                       # API :3000 + web :3001 (mobile: see local-dev.md)
pnpm check                                     # format:check + lint + typecheck + test + build (= CI)
pnpm turbo run test --filter=@najme/api        # one package
pnpm format                                    # prettier --write
```

## Knowledge base

`docs/README.md` maps docs to areas. Most-used: `docs/conventions/*` (api, code style, env vars,
i18n, testing), `docs/architecture/data-model.md` (incl. the 2026-09-29 amendment),
`docs/architecture/adr/*`, `docs/workflow/task-tracking.md`, `docs/runbooks/local-dev.md`.
Turborepo may append a managed block to this file when run by an agent — commit it unchanged.
