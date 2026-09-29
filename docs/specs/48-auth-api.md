# #48 — Email and password auth: register, login, rotating refresh tokens, logout, me

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/48
- Status: Implemented
- Related: ADR-0002, ADR-0010, `docs/conventions/api.md`, #46 (contracts), #47 (persistence)

## Goal

Users register and sign in with email and password. Sessions use a 15-minute JWT access token and
a 30-day rotating refresh token, delivered by httpOnly cookie (web) or JSON body (mobile).

## Approach

An `auth` module next to `users`: controller, `AuthService`, `AccessTokenService` (jose),
`RefreshTokenService` (hashing, rotation, reuse detection), `PasswordService` (argon2id), a global
`JwtAuthGuard` plus `@Public()` and `@CurrentUser()`. All decisions are in ADR-0010. New users get
their locale from the request or from `Accept-Language` via `@najme/i18n` (added as an api
dependency, and to the api Dockerfile runtime stage, instead of duplicating its mapping table).

## Changes

| Area / path                               | Change                                                    |
| ----------------------------------------- | --------------------------------------------------------- |
| `apps/api/src/auth/*`                     | New auth module                                           |
| `apps/api/src/app.setup.ts`, `main.ts`    | Shared app wiring, `trust proxy`                          |
| `apps/api/src/config/env.schema.ts`       | `JWT_ACCESS_SECRET`, `AUTH_COOKIE_SECURE`                 |
| `apps/api/src/common/filters/*`           | All 401s are `UNAUTHENTICATED`; domain error mapping      |
| `apps/api/src/users/*`                    | Password lookup helpers, `Me` mapper, pre-hijack row lock |
| `packages/contracts/src/error.ts`         | `UNAUTHORIZED` marked deprecated                          |
| `.env.example`, turbo, compose, workflows | New secret wired through dev, CI smoke, prod and deploy   |

### Contracts / API

`POST /auth/register` (201), `/login` (200), `/refresh` (200), `/logout` (204), `GET /me`.
Bodies and responses use the #46 schemas (`registerRequest`, `loginRequest`, `refreshRequest`,
`authSession`, `me`). Errors: `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `REFRESH_TOKEN_REUSED`,
`UNAUTHENTICATED`, `RATE_LIMITED`, `VALIDATION_FAILED`; non-JSON content type is `415 HTTP_ERROR`.

### Data model

No schema change (tables from #47).

### UI and i18n

None; error codes already exist in the `errors` namespace.

## Test plan

- Unit: exception filter mapping.
- e2e (`test/auth.e2e-spec.ts`): register then me, duplicate email, validation, locale, login
  (right/wrong/unknown/no password), refresh rotation, reuse revokes the chain, expiry, concurrent
  rotation, logout, cookie vs mobile flow, 401 without token, 429 on login and register.

## Risks and open questions

- Concurrent refreshes with one cookie sign the user out (documented in ADR-0010).
- In-memory rate limiting is per API instance.

## Implementation notes

`findOrLinkByProvider` now locks the user row (`FOR UPDATE`) and re-reads `emailVerifiedAt` inside
the transaction. Rate limits are per IP; the e2e tests vary `X-Forwarded-For` per test. Follow-ups:
per-email login throttling, a periodic purge of expired refresh tokens.
