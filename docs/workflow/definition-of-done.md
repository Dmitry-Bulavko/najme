# Definition of done

A task is done when **all** of the following hold. The reviewer checks this list.

## Always

- [ ] Every acceptance criterion in the issue is met and demonstrably tested.
- [ ] `pnpm check` passes locally (format, lint, typecheck, test, build for affected packages).
- [ ] New/changed behaviour has tests (see `docs/conventions/testing.md`).
- [ ] No hardcoded user-facing strings; new i18n keys exist in `en`, `me`, `ru`, `tr`.
- [ ] No secrets, tokens or personal data in code, logs, fixtures or commits.
- [ ] Docs updated where behaviour or conventions changed; new decisions recorded as ADRs.
- [ ] Commits follow Conventional Commits and reference the issue.

## When applicable

- [ ] API change: schema in `packages/contracts` first; e2e tests for status codes, validation and
      authorization; OpenAPI still generates.
- [ ] DB change: Prisma migration committed; migration is backward compatible with the previous
      app version (ADR-0007); seed data updated if needed.
- [ ] New env var: checklist in `docs/conventions/env-vars.md` completed.
- [ ] UI change: works in all four locales, on narrow (mobile web) and wide layouts; loading, empty
      and error states handled.
- [ ] Size-M task: spec in `docs/specs/` with final implementation notes.
- [ ] New dependency: latest stable version, justified in the PR body.
