# #53 — Web email verify, password reset & Google button

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/53
- Status: Implemented
- Related: ADR-0010, ADR-0011, `docs/specs/49-mailer-verify-reset.md`, `docs/specs/52-web-auth-session.md`, #49, #50, #52, #58

## Goal

Web users can complete soft email verification from the link in Mailpit/SES, request and apply a
password reset, see an unverified-email banner with resend, and sign in with Google when the
deployment has Google enabled (`GET /auth/providers`).

## Approach

Reuse the #52 API client and session context. New thin routes call the existing auth endpoints
from #49/#50. The Google button loads Google Identity Services only when both `providers.google`
and `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` are set; otherwise it stays hidden (#58 supplies the IDs).

## Changes

| Area / path                                              | Change                             |
| -------------------------------------------------------- | ---------------------------------- |
| `apps/web/src/app/[locale]/verify-email/page.tsx`        | Verify-email route                 |
| `apps/web/src/app/[locale]/forgot-password/page.tsx`     | Forgot-password route              |
| `apps/web/src/app/[locale]/reset-password/page.tsx`      | Reset-password route               |
| `apps/web/src/features/auth/verify-email-panel.tsx`      | Client panel: POST verify + states |
| `apps/web/src/features/auth/forgot-password-form.tsx`    | Email form → always "sent" UI      |
| `apps/web/src/features/auth/reset-password-form.tsx`     | New password + token               |
| `apps/web/src/features/auth/unverified-email-banner.tsx` | Soft banner + resend               |
| `apps/web/src/features/auth/google-sign-in-button.tsx`   | GIS → POST /auth/google            |
| `apps/web/src/app/[locale]/layout.tsx`                   | Mount unverified banner            |
| `packages/i18n/src/catalogs/*/auth.json`                 | New keys (4 locales)               |
| `.env.example`, `apps/web/.env.example`, turbo env       | `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` |

### Contracts / API

No new schemas. Uses `verifyEmailRequestSchema`, `forgotPasswordRequestSchema`,
`resetPasswordRequestSchema`, `googleSignInRequestSchema`, `authProvidersSchema`, `authSessionSchema`.

### Data model

None.

### UI and i18n

Routes: `/[locale]/verify-email`, `/forgot-password`, `/reset-password`. Auth namespace keys:
`forgotPassword.*`, `passwordReset.*`, `emailVerification.*`, `unverifiedBanner.*`, `google.*`
(named to avoid colliding with the `emails` catalog root keys).

## Test plan

- Unit (Vitest + RTL): forgot/reset forms (validation, success, API errors); verify panel
  (missing token, success, TOKEN_INVALID/EXPIRED); unverified banner (hidden when verified,
  resend); Google button (hidden when providers.google false / no client id).
- Manual: Mailpit link → verify; forgot → Mailpit → reset; banner resend with Docker up.

## Risks and open questions

- Without #58 (`GOOGLE_CLIENT_IDS` + `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`) the Google button is hidden;
  exit criterion "sign in with Google" cannot be verified in that environment.

## Implementation notes

- `apiRequest` now treats empty 2xx bodies (including 202 from forgot-password / verify resend)
  as `undefined` instead of calling `response.json()` on an empty stream.
- Google button requires both `GET /auth/providers.google` and `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`;
  without #58 credentials it stays hidden.
- Unverified banner sits under `SiteHeader` in the locale layout so every page surfaces it.
- Token pages set `referrer: 'no-referrer'` in metadata and strip `token` via
  `history.replaceState` (`useEmailLinkToken`) per ADR-0011.
