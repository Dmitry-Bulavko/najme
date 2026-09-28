# #15 — Scaffold Expo mobile app with expo-router, i18n and tokens

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/15
- Status: Implemented
- Related: ADR-0003, ADR-0004, `docs/conventions/i18n.md`, `docs/conventions/env-vars.md`, #9, #11,
  #12, #14

## Goal

Create `apps/mobile` (`@najme/mobile`): an Expo (latest SDK) app with expo-router, a Discover /
Bookings / Account tab placeholder, an in-app language switcher for the four UI locales (persisted
on device), shared design tokens, an API status check, and CI-checked lint/typecheck/tests — no
native builds in this task.

## Approach

- **Framework:** Expo SDK 57 (`expo@~57.0.25`, `react-native@0.86.3`, `react@19.2.3` — the versions
  `create-expo-app` resolves for this SDK), expo-router, TypeScript strict via
  `expo/tsconfig.base` (Expo's own preset is required by the router's typed-routes plugin) with the
  same stricter flags `@najme/config/tsconfig/base.json` uses added on top
  (`noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`).
- **`app.config.ts`:** replaces the template's `app.json` so config can grow typed/environment-aware
  logic later without a migration. `name: "Najme"`, `slug: "najme"`, `scheme: "najme"`,
  `ios.bundleIdentifier`/`android.package: "me.najme.app"`.
- **`eas.json`:** `development` (internal distribution, dev client), `preview` (internal, `preview`
  channel) and `production` (auto-incrementing, `production` channel) build profiles, each with an
  `EXPO_PUBLIC_API_URL`. No `eas build`/`eas submit` is run in this task (M7).
- **i18n:** `i18next` + `react-i18next`, with `i18next-icu` as the formatting engine so catalog
  values keep the same ICU MessageFormat syntax (plurals, selects) `@najme/i18n` and the API use,
  instead of i18next's own `{{var}}` interpolation. `src/i18n/index.ts`'s `initI18n()` resolves the
  locale on launch following ADR-0004's order: an explicit choice read from `AsyncStorage` first,
  then `expo-localization`'s device language list, then `@najme/i18n`'s `resolveLocale` falls back to
  `en`. `setLocale()` (used by the language switcher) persists the choice and calls
  `i18next.changeLanguage`. Resources are `flattenMessages(catalogs[locale].common)`, per
  `@najme/i18n`'s README guidance for flat-key consumers.
- **Tabs:** `src/app/(tabs)/_layout.tsx` renders `expo-router`'s `Tabs` with three placeholder
  screens (`index` = Discover, `bookings`, `account`), titled via `useTranslation()` so they
  re-render when the locale changes. `src/features/placeholder-screen.tsx` is the shared layout for
  the Discover/Bookings placeholder body copy; Account additionally renders `LanguageSwitcher` and
  `ApiStatusBadge`.
- **Language switcher:** `src/features/locale/language-switcher.tsx`, a row of `Pressable` options
  (one per `SUPPORTED_LOCALES` entry, native label from `LOCALE_META`) — no UI components are shared
  with `apps/web` (ADR-0003).
- **API status:** `src/features/health/use-api-status.ts` fetches
  `${EXPO_PUBLIC_API_URL}/health` once on mount with a 2s timeout (`AbortController` + `setTimeout`,
  since `AbortSignal.timeout` support varies across Hermes/RN versions), validates the body with
  `@najme/contracts`'s `healthResponseSchema`, and never throws into the UI — any error, timeout,
  missing env var, non-2xx or invalid body resolves to `'unavailable'`.
- **Fonts:** `@expo-google-fonts/manrope` (actual Manrope `.ttf` assets, rather than hand-sourcing
  font files) loaded via `expo-font`'s `useFonts` in the root layout, with the regular weight
  registered under the family name `"Manrope"` so `tokens.typography.fontFamily` resolves directly;
  Medium/Bold/ExtraBold are registered under suffixed family names for text needing a specific
  weight (React Native does not vary weight from a single non-variable font file the way CSS does).
- **Tokens:** `@najme/ui-tokens`'s `tokens` object is used directly in `StyleSheet.create` calls
  (colors, spacing, radius, typography) per that package's documented mobile usage.
- **Metro / pnpm:** `metro.config.js` sets `watchFolders` to the monorepo root and
  `resolver.nodeModulesPaths` to both the app's and the root's `node_modules`, with
  `unstable_enableSymlinks`/`unstable_enablePackageExports` on, so `@najme/*` workspace packages
  resolve under pnpm's symlinked layout.
- **Lint:** `eslint-config-expo` and `eslint-plugin-react` do not yet support ESLint 10's flat
  config/scope-manager API (same issue `apps/web` hit with `eslint-config-next`, see
  `docs/specs/14-web-scaffold.md`), so `eslint.config.mjs` composes `@najme/config`'s shared
  TypeScript rules with `eslint-plugin-react-hooks`'s flat `recommended-latest` config directly.
- **Tests:** Jest (`jest-expo` preset) + `@testing-library/react-native`.
  `src/__tests__/tabs-layout.test.tsx` mocks `expo-router`'s `Tabs`/`Tabs.Screen` (rendering
  `options.title` as plain text, since the real components render native tab-bar chrome that isn't
  observable in a unit test) and renders the real `TabsLayout` component through an
  `I18nextProvider`, asserting the English titles render by default and the `me` titles render after
  `i18next.changeLanguage('me')`. `src/i18n/index.test.ts` covers `initI18n`/`setLocale`
  persistence against the AsyncStorage jest mock: an explicit `me` choice survives a fresh
  `initI18n()` call (#34), and a garbage stored value falls back to the (mocked) device locales.
- **`build` script:** `expo export --platform web`, which needs no native toolchain, keeps a `build`
  check green in CI without `expo prebuild`/`eas build`.

## Changes

| Area / path                                | Change                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `apps/mobile`                              | New Expo app: expo-router tabs, i18n bootstrap, language switcher, API status, tokens |
| `packages/i18n/src/catalogs/*/common.json` | Added `tabs.*` and `screens.*` keys                                                   |
| `.env.example`                             | Added `EXPO_PUBLIC_API_URL`; `apps/mobile/.env.example` added                         |
| `pnpm-workspace.yaml`                      | `allowBuilds` entries for native build scripts pulled in by Expo/RN, if any           |

### Contracts / API

No new contracts. The API status hook consumes the existing `healthResponseSchema` from
`@najme/contracts`, same as `apps/web`'s status badge.

### Data model

None.

### UI and i18n

- Tabs: Discover (`tabs.discover` / `screens.discover.*`), Bookings (`tabs.bookings` /
  `screens.bookings.*`), Account (`tabs.account` / `screens.account.title`).
- Reused existing `apiStatus.*`, `languageSwitcher.label`, `states.loading` keys from `apps/web`'s
  work on the `common` namespace.
- New keys added to the `common` namespace, all four locales: `tabs.discover`, `tabs.bookings`,
  `tabs.account`, `screens.discover.title`, `screens.discover.body`, `screens.bookings.title`,
  `screens.bookings.body`, `screens.account.title`.

## Test plan

- Unit (Jest + React Native Testing Library, `apps/mobile`): switching the active locale changes the
  rendered tab titles (`src/app/(tabs)/_layout.test.tsx`).
- `@najme/i18n` Vitest suite continues to pass with the new keys (key parity + ICU validity).
- Manual: not applicable in this environment (no simulator/emulator/Expo Go device); `expo export
--platform web` is used as the CI-safe `build` check instead.

## Risks and open questions

- No native toolchain/simulator is available in this environment, so the app was never run inside
  Expo Go or a simulator; `expo export --platform web` and the Jest suite are the only executable
  verification here. A human/CI-with-device pass is recommended before relying on this scaffold for
  real screens.
- `eas.json`'s `preview` and `production` `EXPO_PUBLIC_API_URL` both point at the single alpha
  domain, `https://najme.dzmitry-bulauka.com/api/v1` (ADR-0007); split them once a separate staging
  environment exists.

## Implementation notes

Round 1: scaffolded with `create-expo-app` (to pin the exact SDK 57 dependency versions), then
stripped the template down to the placeholder tabs/i18n/tokens this issue needs. See "Risks and open
questions" above for what could not be exercised in this environment.
