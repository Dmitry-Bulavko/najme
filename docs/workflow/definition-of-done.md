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

## Standard acceptance blocks

Issues say "API-STD applies" or "UI-STD applies" instead of repeating the block. The block is part
of the issue's acceptance criteria, and the reviewer checks it like any other criterion.

### API-STD

1. Schemas go in `packages/contracts` first. Controllers validate with zod, and OpenAPI still
   generates.
2. Business-scoped endpoints have e2e tests using the business authz test helper (added in M2-02):
   - a non-member gets **404**;
   - a member whose role isn't allowed gets **403**;
   - a cross-tenant ID in the path gets 404, and in the body gets 422 `VALIDATION_FAILED`;
   - the route-walker test stays green.
3. New error codes go into `ERROR_CODES` and into `errors.json` for en/me/ru/tr.
4. Schema changes:
   - a committed Prisma migration that is backward compatible (ADR-0007);
   - CHECKs, partial indexes and exclusions as raw SQL;
   - `data-model.md` updated.
5. Time comes from the injected `Clock`.
6. A spec in `docs/specs/` for size M or any schema or contract change.
7. `pnpm check` is green.

### UI-STD

1. All strings in the named namespace(s) for en/me/ru/tr, and API errors shown via `errors.<CODE>`.
2. Every data view has three states:
   - loading, as a skeleton;
   - empty, with a CTA;
   - error, with a message and a retry.

   Mutations show a spinner and disable the button, then show a toast.

3. Forms use react-hook-form with the contract zod schemas, and `VALIDATION_FAILED.details` is
   mapped onto fields.
4. Times are formatted with `Intl` in the **business timezone** and the locale's BCP-47 tag.
5. Web works on narrow and wide layouts and from the keyboard. Mobile is keyboard-aware and
   safe-area-correct, and `expo export --platform web` still passes.
6. Tests: Vitest + RTL on web, Jest + RNTL on mobile, with the API mocked.
7. Role-aware: actions the role can't perform are hidden, and a 403 is still handled.
