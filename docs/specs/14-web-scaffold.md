# #14 — Scaffold Next.js web app with i18n routing, tokens and Docker image

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/14
- Status: Implemented
- Related: ADR-0003, ADR-0004, ADR-0007, `docs/conventions/i18n.md`, `docs/conventions/env-vars.md`,
  #9, #11, #12

## Goal

Create `apps/web` (`@najme/web`): a Next.js (latest stable) App Router app with locale-prefixed
routing (`en`/`me`/`ru`/`tr`), the shared design tokens from `@najme/ui-tokens`, a localized
placeholder home page that shows API health status, and a production Docker image, following ADR-0003
and ADR-0004.

## Approach

- **Framework:** Next.js 16 (App Router), TypeScript strict via `@najme/config/tsconfig/react.json`
  (with the `jsx`/`module`/`moduleResolution` overrides Next requires), Tailwind CSS v4 wired through
  `@najme/ui-tokens/theme.css`, Manrope loaded with `next/font/google`.
- **Locale routing:** a custom `proxy.ts` (not `next-intl`'s built-in locale-detection
  middleware) implements the exact ADR-0004 resolution order using `@najme/i18n`'s
  `resolveLocale`/`parseAcceptLanguage`: read the `NEXT_LOCALE` cookie first, else parse
  `Accept-Language`, else fall back to `en`; redirect any path without a supported locale prefix to
  `/{locale}/...` and set the cookie. `next-intl`'s `NextIntlClientProvider`/`getRequestConfig` render
  messages once the locale segment is present; `next-intl`'s own locale detection is not used, so
  there is a single source of truth for resolution order.
- **Messages:** `@najme/i18n`'s `catalogs[locale].common` is passed directly to `next-intl` — no
  separate message files in `apps/web`. New keys (`apiStatus.*`, `languageSwitcher.label`) were added
  to the existing `common` namespace in all four locales (see `docs/conventions/i18n.md` "To add a
  namespace" — extending `common` was simpler than adding a namespace for two small groups of keys,
  and keeps the key-parity/ICU tests in `@najme/i18n` unchanged).
- **Language switcher:** a client component listing `SUPPORTED_LOCALES` with `LOCALE_META[locale].label`
  (native names, not translated), replacing the locale segment of the current path, calling
  `router.replace` and setting the `NEXT_LOCALE` cookie (1 year, `SameSite=Lax`).
- **API status badge:** a server component that fetches `${API_INTERNAL_URL}/health` when
  `API_INTERNAL_URL` is set (production/compose — internal Docker network), otherwise
  `${PUBLIC_URL}/api/v1/health` when `PUBLIC_URL` is set (mirrors the single-origin routing of
  ADR-0007), otherwise renders "unavailable" without fetching (no `API_INTERNAL_URL`/`PUBLIC_URL` and
  no relative URL is meaningful from a server-side `fetch`). The fetch has a 2s timeout
  (`AbortSignal.timeout`), `cache: 'no-store'` (status must be live, not baked into the build), and
  any error/non-2xx/invalid body is caught and rendered as "unavailable" — the page never throws.
- **Dev proxy:** `next.config.ts` `rewrites()` sends `/api/:path*` to `http://localhost:3000` only
  when `NODE_ENV !== 'production'`, mirroring the production Caddy routing (ADR-0007) for local dev
  convenience; it plays no role in the server-side health fetch (which always calls an absolute URL).
- **Docker:** multi-stage `apps/web/Dockerfile`, build context = repo root (matches
  `.github/workflows/deploy.yml`), Node 24, `output: 'standalone'` with
  `outputFileTracingRoot` set to the monorepo root (required for standalone builds in a pnpm
  workspace), non-root `node` user, `EXPOSE 3000`, `ARG GIT_SHA`. `API_INTERNAL_URL`/`PUBLIC_URL` are
  read at request time (`process.env` inside the server component), never inlined at build — the
  image builds without a running API or database.
- **Ports:** dev server on `3001` (`WEB_PORT` in `.env.example`), container listens on `3000` per the
  compose contract.

## Changes

| Area / path                                | Change                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `apps/web`                                 | New Next.js app: middleware, `[locale]` routes, language switcher, status badge, Dockerfile |
| `packages/i18n/src/catalogs/*/common.json` | Added `apiStatus.*` and `languageSwitcher.label` keys                                       |
| `.env.example`                             | `WEB_PORT` already present (added by scaffold conventions); `apps/web/.env.example` added   |
| `.claude/launch.json`                      | New entry to run the web dev server on port 3001                                            |
| `pnpm-workspace.yaml`                      | `allowBuilds` entries for native build scripts pulled in by Next/Tailwind, if any           |

### Contracts / API

No new contracts. The health badge consumes the existing `HealthResponse` shape from
`@najme/contracts` (`{ status: 'ok', ... }`) informally — it treats any 2xx JSON response with
`status === 'ok'` as online, anything else (non-2xx, network error, timeout, malformed body) as
unavailable, without importing the API's own DB-check fields.

### Data model

None.

### UI and i18n

- `/[locale]` home page: app name + tagline (`common.appName`/`common.tagline`, already existed),
  language switcher, API status badge.
- New keys added to the `common` namespace, all four locales: `apiStatus.label`, `apiStatus.online`,
  `apiStatus.unavailable`, `languageSwitcher.label`.

## Test plan

- Unit (Vitest + Testing Library, `apps/web`): language switcher renders native labels and calls the
  expected navigation/cookie side effects; status badge renders localized "online" text on a
  successful fetch and localized "unavailable" text when the fetch fails/throws/times out.
- `@najme/i18n` Vitest suite continues to pass with the new keys (key parity + ICU validity).
- Manual: not applicable in this environment (no Docker daemon); Dockerfile reviewed by inspection
  against the compose contract instead of a build.

## Risks and open questions

- No Docker daemon is available in this environment, so the image cannot be built/run here; it will
  be exercised by #16 and the deploy workflow's `images` job.
- Next.js is deprecating the `middleware.ts` convention in favor of a `proxy.ts` file with the same
  API (see the Next.js 16 release notes); `middleware.ts` still works and is not yet removed. Follow
  up in a later issue once `proxy` is stable/documented, rather than churning this scaffold now.

## Implementation notes

Round 1: app scaffolded (middleware, `[locale]` layout/page, language switcher, API status badge,
Dockerfile, Vitest tests); `pnpm install`/`typecheck` green, but `pnpm --filter @najme/web lint`
crashed (`scopeManager.addGlobals is not a function`) because `eslint-config-next` 16.3.6's flat
config (via the `eslint-plugin-react` it bundles) is not yet compatible with ESLint 10's
language/scope-manager API.

Round 2: merged `origin/main` (#13, the API scaffold), resolving conflicts in `.dockerignore`,
`pnpm-lock.yaml` and `pnpm-workspace.yaml`. Fixed the round-1 issues:

- **Lint:** dropped `eslint-config-next`/`eslint-plugin-react` entirely; `apps/web/eslint.config.js`
  now composes `@najme/config`'s shared base config with `@next/eslint-plugin-next`'s flat
  `core-web-vitals` config (a superset of `recommended`) and `eslint-plugin-react-hooks`'s flat
  `recommended-latest` config — both declare `eslint@^10` support and don't touch the removed
  scope-manager API.
- **Tests:** Vitest's default oxc TS/TSX transform respects `apps/web/tsconfig.json`'s
  `jsx: "preserve"` (required by Next's own compiler) and leaves JSX untransformed, breaking
  component tests. `apps/web/vitest.config.ts` sets `oxc: false` and `esbuild.jsx: 'automatic'` to
  fall back to esbuild's own JSX transform for the test build. Separately, the shared Vitest base
  config disables `globals`, so `@testing-library/react`'s auto-cleanup (which relies on a global
  `afterEach`) never ran, leaking DOM between tests; `apps/web/vitest.setup.ts` now imports
  `cleanup` from `@testing-library/react` and calls it in an explicit `afterEach` (documented in
  `docs/conventions/testing.md`).
- **Dev launch config:** `.claude/launch.json` was rewritten to a different shape by an earlier
  step; restored it to the pre-rewrite format (`configurations[]` with `runtimeExecutable`/
  `runtimeArgs`) and added the `web` entry (port 3001) in that format.
- **Env example:** removed a duplicated `PUBLIC_URL` entry from `apps/web/.env.example` (it is
  defined once, in the root `.env.example`, per `docs/conventions/env-vars.md`).

Round 3: `pnpm format` (formatting fixes to `apps/web/tsconfig.json` and this spec) and finalized
these implementation notes. `pnpm --filter @najme/web lint|typecheck|test|build` and the full
`pnpm check` are green.

Follow-up #31: `middleware.ts` was migrated to `src/proxy.ts` (named `proxy` export, same `config.matcher`), and an unsupported locale-like first segment (`/xx/foo`) is now replaced instead of prefixed.
