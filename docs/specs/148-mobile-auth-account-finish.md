# #148 — Finish mobile auth and account

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/148
- Status: Implemented
- Related: #55, #56, #144, ADR-0010, `docs/specs/55-mobile-auth.md`

## Goal

Close the remaining M1 mobile auth/account gaps: password change survives an expired access
token, shared client helpers replace duplicated fetch/envelope code, tab-bar labels are not
clipped, and the missing #55/#56 tests exist.

## Approach

Reuse the lock-free refresh path introduced for #144 (`refreshWithoutMutex` / `TransientAuthError`)
inside `changePasswordWithLock` while the auth mutex is held. Export `parseErrorEnvelope` and
`apiBaseUrl` so feature code does not re-implement them. Raise `TAB_BAR_BASE_HEIGHT` so the icon
plus label line fit under the bar paddings on the Expo web export (390×844).

## Changes

| Area / path                                                     | Change                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `apps/mobile/src/lib/api/client.ts`                             | Export helpers; `__DEV__` guard that `refreshWithoutMutex` runs under the mutex |
| `apps/mobile/src/features/account/change-password.ts`           | 401 → refresh once → retry; shared envelope parser                              |
| `apps/mobile/src/features/auth/google-sign-in-button.tsx`       | Treat library `cancelled` via `isCancelledResponse`                             |
| `apps/mobile/src/components/ui/theme.ts` / `(tabs)/_layout.tsx` | Taller tab bar budget                                                           |
| `apps/mobile/src/i18n` + `test-utils`                           | Shared `UI_NAMESPACES` (exclude `emails` + `notifications`)                     |
| `apps/mobile/app.config.ts`                                     | Production EAS throws without iOS Google client ID                              |

## Test plan

- Unit: password-change retry / race / transient refresh; Google cancel; `canOfferGoogleSignIn` Expo Go; tab bar height budget; app.config production guard.
- Manual: Expo web export at 390×844 in en/me/ru/tr — screenshots attached to the handoff.

## Risks and open questions

Owner still needs Expo Go device screenshots for iOS/Android once the web-export layout is confirmed.
