# Code style

Formatting is automatic (Prettier, root config). Linting and TypeScript settings come from
`@najme/config` (`packages/config`): its `tsconfig/*.json` presets and its ESLint flat config are
the source of truth — every package and app extends/imports them rather than redefining rules. See
`packages/config/README.md` for how to consume each preset. These rules cover what tools cannot
enforce.

## TypeScript

- `strict: true` everywhere. No `any` (use `unknown` + narrowing); no non-null `!` without a comment
  explaining why it is safe.
- Prefer types inferred from zod schemas (`z.infer<typeof X>`) over hand-written duplicates.
- Named exports only (except where a framework requires default exports: Next.js pages/layouts,
  expo-router routes).
- File names: `kebab-case.ts`; React components `PascalCase` inside `kebab-case.tsx` files.
- No barrel files inside apps (except a single UI-kit barrel such as
  `apps/mobile/src/components/ui/index.ts`); packages expose a curated `src/index.ts`.

## Structure

- Keep functions small and pure where possible; isolate I/O at the edges (controllers, repositories,
  API clients).
- API (NestJS): `module/controller/service` per bounded context; controllers are thin (validate →
  call service → map to contract type); business rules live in services; Prisma access in services
  or small repository classes. No cross-module Prisma access — call the owning module's service.
- Web/mobile: route files stay thin; feature code in `src/features/<feature>/` (components, hooks,
  api calls); shared primitives in `src/components/ui/`.

## Errors and logging

- Throw typed domain errors in services; the global filter maps them to the API error envelope.
- Never swallow errors silently (`catch {}` is a review blocker). Log with context; never log
  secrets, tokens, passwords or full personal data.

## Comments and docs

- Comment _why_, not _what_. Public functions in packages get a one-line JSDoc.
- Behaviour changes update the relevant doc in `docs/` in the same PR.

## Dependencies

- Use the latest stable version when adding a dependency; prefer well-maintained, widely used
  packages. Justify new runtime dependencies in the PR description.
- Never add a dependency to do something the platform or an existing dependency already does.
- pnpm (v12) enforces a supply-chain policy: versions published very recently are not installed
  (`minimumReleaseAge`); pnpm resolves the newest version that passes. Do not add
  `minimumReleaseAgeExclude` entries to `pnpm-workspace.yaml` unless a task explicitly needs a
  just-released fix — say why in the PR.
- Turborepo ≥ 2.11.5 may write a managed `AGENTS.md` block when run by an agent. If it appears,
  commit it unchanged in the same PR (or set `"agentGuidance": false` in `turbo.json`) so the
  working tree stays clean.
- Every package declares, as `devDependencies`, each CLI its own scripts invoke (e.g. `eslint`,
  `tsc`, `tsup`, `vitest`) — never rely on a globally installed binary happening to be on `PATH`.
  CI and other machines will not have it, and turbo tasks will fail with an exit code like 127.
