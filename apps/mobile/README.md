# @najme/mobile

Expo (SDK 57) app for iOS and Android, built with expo-router. See ADR-0003 (clients), ADR-0004
(i18n), ADR-0010 (auth) and `docs/specs/55-mobile-auth.md`.

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

There is no native build/toolchain required for CI — `pnpm --filter @najme/mobile build` only runs
`expo export --platform web`. EAS builds (`eas build`) are out of scope until M7 (see `eas.json`).

## Auth and development builds

Email/password sign-in works in Expo Go. **Google Sign-In does not**: it needs a development or
production build with the native `@react-native-google-signin/google-signin` module.

```bash
pnpm --filter @najme/mobile exec npx expo run:ios
# or
pnpm --filter @najme/mobile exec npx expo run:android
```

Set both `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (public; also
list them in the API's `GOOGLE_CLIENT_IDS`, task #58). The button stays hidden when env or
`GET /auth/providers` says Google is off, and in Expo Go / web export, so those surfaces never
crash.

The refresh token lives in `expo-secure-store`; the access token stays in memory (ADR-0010). The
client always sends `X-Client: mobile`.

## Environment variables

| Name                               | Kind   | Purpose                                                               |
| ---------------------------------- | ------ | --------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`              | public | Base URL (incl. `/api/v1`) the app calls for the API and health check |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | public | iOS Google OAuth client ID; unset hides the Google button             |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | public | Web client ID used as `webClientId` for ID tokens                     |

`EXPO_PUBLIC_*` vars are inlined into the JS bundle at build time (never secrets). From Expo Go on
a physical device, use the dev machine's LAN IP instead of `localhost` (see `.env.example`).
`eas.json`'s `preview` and `production` build profiles both point at
`https://najme.dzmitry-bulauka.com/api/v1` (ADR-0007, `docs/runbooks/deploy.md`): the alpha
deployment has a single environment, so there is no separate staging host yet.

## i18n

Locales, resolution order and catalogs come from `@najme/i18n` (ADR-0004). On launch, the app reads
an explicit locale choice from `AsyncStorage` if present, otherwise resolves from the device's
language preferences (`expo-localization`), otherwise falls back to `en`. Every catalog namespace
except `emails` is registered in i18next (`auth`, `errors`, `common`, `mobile`, `shell`, …). The
Account tab's language switcher persists the choice; after sign-in the account `locale` wins.

## Structure

- `src/app` — expo-router routes: `_layout.tsx` (font/locale/auth bootstrap), `(tabs)/`, `(auth)/`.
- `src/features` — screen-level building blocks (`auth/`, `locale/`, `health/`).
- `src/lib/api` — typed fetch client with SecureStore refresh and auth mutex.
- `src/i18n` — i18next bootstrap and locale persistence (`initI18n`, `setLocale`).

Design tokens come from `@najme/ui-tokens` (see that package's README); UI components are **not**
shared with `apps/web` (ADR-0003) — this app uses plain React Native primitives.

## Testing

`pnpm --filter @najme/mobile test` runs Jest (`jest-expo` preset) + React Native Testing Library.
The per-test timeout is 20 s (`jest.testTimeout` in `package.json`): the first render in a file
lazily loads React Native modules, which exceeded Jest's 5 s default on a loaded CI runner while
turbo ran the other packages' tasks in parallel.

## Metro and the pnpm workspace

`metro.config.js` watches the whole monorepo (`watchFolders`) and resolves `node_modules` from both
this app and the workspace root, with `unstable_enableSymlinks` on, so `@najme/*` workspace packages
resolve correctly under pnpm's symlinked `node_modules` layout.
