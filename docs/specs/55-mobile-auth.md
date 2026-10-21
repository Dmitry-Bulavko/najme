# #55 — Mobile auth: sign-up, sign-in, password reset request, Google, secure session

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/55
- Status: Implemented
- Related: ADR-0010, ADR-0003, ADR-0004, #45 (UI kit), #48/#49/#50 (API), #52/#53 (web auth), #58 (Google IDs)

## Goal

Mobile users can register, sign in (email/password or Google), request a password reset, and keep
a secure session across restarts. Verification/reset links stay on web (no deep links in M1).

## Approach

Mirror web auth (#52/#53) with mobile differences from ADR-0010: `X-Client: mobile`, refresh token
in JSON body stored in `expo-secure-store`, access token in memory only. Google uses
`@react-native-google-signin/google-signin` (dev builds only); hide the button in Expo Go, on web
export, or when providers/env are missing so Expo Go and `expo export --platform web` never crash.

i18next loads every catalog namespace except `emails` and `notifications` (via shared
`UI_NAMESPACES`) so new UI namespaces need no wiring. Auth UI strings reuse the existing `auth`
catalog; API errors use `errors:<CODE>`.

## Changes

| Area / path                                             | Change                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/mobile/src/lib/api/`                              | Typed fetch client, SecureStore refresh, auth mutex, single-flight |
| `apps/mobile/src/features/auth/`                        | AuthProvider, forms, Google button, unverified banner, sign-in CTA |
| `apps/mobile/src/app/(auth)/`                           | Sign-in, sign-up, forgot-password screens                          |
| `apps/mobile/src/app/(tabs)/`                           | Anonymous CTAs; authenticated account + unverified banner; tab bar |
| `apps/mobile/src/i18n/`, `test-utils/i18n.tsx`          | Shared `UI_NAMESPACES` (all except `emails` + `notifications`)     |
| `app.config.ts`, env examples, turbo, README, local-dev | Google plugin + `EXPO_PUBLIC_GOOGLE_*`                             |

### Contracts / API

No contract changes. Uses existing `/auth/*`, `/me`, `authSession`, `authProviders`.

### Data model

None.

### UI and i18n

- Routes: `(auth)/sign-in`, `sign-up`, `forgot-password`; Discover stays public.
- Namespaces: every UI catalog except `emails` and `notifications` (`UI_NAMESPACES`).
- New mobile keys only if needed for bookings anonymous CTA / account signed-in chrome.

## Test plan

- Unit (Jest + RNTL, mocks for SecureStore, fetch, Google): form validation + error mapping;
  session restore; refresh single-flight; sign-out clears storage; Google button visibility.
- Manual: Expo Go hides Google without crash; `expo export --platform web` green; tab labels in
  `ru`/`me` not clipped (simulator/emulator when available).

## Risks and open questions

- Google client IDs from #58 may be unset — button must stay hidden.
- Native Google module requires a development build; document in README / local-dev.

## Implementation notes

- Typed mobile API client (`X-Client: mobile`), SecureStore refresh, `withAuthMutex` for #56, and
  single-flight refresh landed in `apps/mobile/src/lib/api/`.
- AuthProvider restores via refresh → `/me`, applies account locale, exposes sign-in/up/Google/out.
- `(auth)` screens reuse the shared `auth` i18n catalog; Bookings/Account show `SignInCta` when
  anonymous; Account shows unverified banner + sign-out when signed in.
- Google button gated on providers + both `EXPO_PUBLIC_GOOGLE_*` IDs + native module (hidden in
  Expo Go / web export). Config plugin uses a placeholder iOS URL scheme when IDs are unset in
  non-production profiles; **production EAS builds throw** if the iOS client ID is missing (#148).
- i18next loads every catalog namespace except `emails` and `notifications`. Tab bar height is
  safe-area aware with an explicit label line-height; base height raised in #148 so labels are not
  clipped on the Expo web export at 390×844.
- Screenshots of tab labels on device were not attached (no simulator in this environment); covered
  by layout metrics + existing tabs-layout locale test.

Status: Implemented
