# #52 — Web auth & session

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/52
- Status: Implemented
- Related: ADR-0010, ADR-0003, ADR-0004, `docs/conventions/i18n.md`, #44, #48

## Goal

Web visitors can create an account, sign in and sign out. The header reflects auth state, and the
session survives page reloads via the httpOnly `najme_rt` cookie and an in-memory access token.

## Approach

Following ADR-0010: access token in memory, refresh token in httpOnly cookie. On mount the
`AuthProvider` calls `POST /auth/refresh` to restore the session, then `GET /me` to hydrate the
user. The API client holds the access token and does a single-flight refresh on any 401.

TanStack Query manages server state (user profile, session validity). `react-hook-form` + contract
zod schemas validate the sign-in / sign-up forms.

## Changes

| Area / path                                      | Change                                                |
| ------------------------------------------------ | ----------------------------------------------------- |
| `apps/web/src/lib/api/client.ts`                 | Typed fetch client + ApiError + single-flight refresh |
| `apps/web/src/features/auth/session-context.tsx` | AuthProvider, SessionContext, useSession              |
| `apps/web/src/features/auth/sign-in-form.tsx`    | Sign-in form (RHF + contract schema)                  |
| `apps/web/src/features/auth/sign-up-form.tsx`    | Sign-up form (RHF + contract schema)                  |
| `apps/web/src/app/[locale]/sign-in/page.tsx`     | `/[locale]/sign-in` route                             |
| `apps/web/src/app/[locale]/sign-up/page.tsx`     | `/[locale]/sign-up` route                             |
| `apps/web/src/components/shell/account-slot.tsx` | Converted to client; Avatar dropdown / Sign in        |
| `apps/web/src/app/[locale]/layout.tsx`           | Wrap in `QueryClientProvider` + `AuthProvider`        |
| `packages/i18n/src/catalogs/*/auth.json`         | New `auth` namespace (en/me/ru/tr)                    |
| `packages/i18n/src/messages.ts`                  | Wire `auth` namespace                                 |
| `packages/i18n/src/index.ts`                     | Export `AuthMessages` type                            |
| `packages/i18n/src/messages.test.ts`             | Add `auth` to describe.each                           |
| `apps/web/src/i18n/request.ts`                   | Load `auth` namespace                                 |

### Contracts / API

No new endpoints: the issue uses the existing contracts from #48 (`loginRequestSchema`,
`registerRequestSchema`, `authSessionSchema`, `meSchema`).

### Data model

No schema changes.

### UI and i18n

New `auth` namespace with keys: `signIn.*`, `signUp.*`, `account.*`. All four locales added.

Two new routes:

- `/[locale]/sign-in` — email + password form, link to `/sign-up` and `/forgot-password`
- `/[locale]/sign-up` — email + password + display name form, link to `/sign-in`

Header `AccountSlot` shows:

- Signed out: "Sign in" button linking to `/[locale]/sign-in`
- Signed in: Avatar with initials, dropdown with display name / email, Profile link, Sign out.

After sign-in/up, if `user.locale ≠ URL locale`, set `NEXT_LOCALE` cookie and navigate to the
right locale URL (ADR-0004).

## Test plan

- Unit (Vitest + RTL):
  - `sign-in-form.test.tsx`: field validation, inline errors, API error codes, loading state.
  - `sign-up-form.test.tsx`: field validation, inline errors, API error codes.
  - `session-context.test.tsx`: refresh-on-401 single-flight, loading/anonymous/authenticated
    states.
  - `account-slot.test.tsx`: renders Sign-in button when anonymous; dropdown when authenticated;
    redirect when already signed in on auth pages.

## Risks and open questions

- None; product decisions on auth flow are all covered by ADR-0010.

## Implementation notes

- `AccountSlot` is converted from an async server component to a `'use client'` component that
  calls `useSession()`.
- The layout wraps children with `QueryClientProvider` then `AuthProvider`; `AuthProvider` fires
  the initial refresh + me queries.
- Single-flight refresh uses a shared `Promise` variable; concurrent 401s all await the same
  pending refresh instead of triggering multiple ones.
- Locale-mismatch redirect after sign-in sets `NEXT_LOCALE` cookie and uses `router.replace`.
