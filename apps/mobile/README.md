# @najme/mobile

Expo (SDK 57) app for iOS and Android, built with expo-router. See ADR-0003 (clients), ADR-0004
(i18n) and `docs/specs/15-mobile-scaffold.md`.

## Run

```bash
pnpm install                      # from the repo root
cp .env.example .env.local        # or set EXPO_PUBLIC_API_URL in the root .env
pnpm --filter @najme/mobile start
```

Then either:

- Press `i`/`a` in the terminal to open an iOS simulator / Android emulator, or
- Scan the QR code with the **Expo Go** app on a physical device (same Wi-Fi network as the dev
  machine).

There is no native build/toolchain in this environment — `pnpm --filter @najme/mobile build` only
runs `expo export --platform web`, which needs no Xcode/Android SDK, and is used to keep a
build/CI check green. EAS builds (`eas build`) are out of scope for this task (see `eas.json`).

## Environment variables

| Name                  | Kind   | Purpose                                                               |
| --------------------- | ------ | --------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | public | Base URL (incl. `/api/v1`) the app calls for the API and health check |

`EXPO_PUBLIC_*` vars are inlined into the JS bundle at build time (never secrets). From Expo Go on
a physical device, use the dev machine's LAN IP instead of `localhost` (see `.env.example`).
`eas.json`'s `preview` and `production` build profiles both point at
`https://najme.dzmitry-bulauka.com/api/v1` (ADR-0007, `docs/runbooks/deploy.md`): the alpha
deployment has a single environment, so there is no separate staging host yet.

## i18n

Locales, resolution order and catalogs come from `@najme/i18n` (ADR-0004). On launch, the app reads
an explicit locale choice from `AsyncStorage` if present, otherwise resolves from the device's
language preferences (`expo-localization`), otherwise falls back to `en`. The Account tab's language
switcher persists the choice for the next launch. Message catalogs are wired into `i18next` +
`react-i18next` via `i18next-icu`, so catalog values keep the same ICU MessageFormat syntax
(plurals, selects) as the API and web.

## Structure

- `src/app` — expo-router routes: `_layout.tsx` (font/locale bootstrap), `(tabs)/` (Discover,
  Bookings, Account placeholders).
- `src/features` — screen-level building blocks (`locale/`, `health/`, `placeholder-screen.tsx`).
- `src/i18n` — i18next bootstrap and locale persistence (`initI18n`, `setLocale`).

Design tokens come from `@najme/ui-tokens` (see that package's README); UI components are **not**
shared with `apps/web` (ADR-0003) — this app uses plain React Native primitives.

## Testing

`pnpm --filter @najme/mobile test` runs Jest (`jest-expo` preset) + React Native Testing Library.
The per-test timeout is 20 s (`jest.testTimeout` in `package.json`): the first render in a file
lazily loads React Native modules, which exceeded Jest's 5 s default on a loaded CI runner while
turbo ran the other packages' tasks in parallel.
`src/__tests__/tabs-layout.test.tsx` covers the acceptance criterion that switching the active
locale changes the rendered tab titles; `src/i18n/index.test.ts` covers locale persistence
(`initI18n`/`setLocale`, including the internal `me` code and a garbage stored value falling back
to device locales).

## Metro and the pnpm workspace

`metro.config.js` watches the whole monorepo (`watchFolders`) and resolves `node_modules` from both
this app and the workspace root, with `unstable_enableSymlinks` on, so `@najme/*` workspace packages
resolve correctly under pnpm's symlinked `node_modules` layout.
