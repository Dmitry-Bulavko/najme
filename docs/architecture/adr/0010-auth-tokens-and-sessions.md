# ADR-0010: Auth tokens and sessions

- Status: Accepted
- Date: 2026-09-29

## Context

ADR-0002 fixed the shape of auth (short-lived JWT access token, rotating hashed refresh token,
argon2id). This ADR pins the details for email/password auth (#48) so web, mobile and later
providers (Google, #50) share one session model.

## Decision

**Access token.** A JWT signed with HS256 using `JWT_ACCESS_SECRET` (min 32 chars), lifetime 15
minutes, `sub` = user id, `iss` = `najme`, `aud` = `najme-api`. Library: `jose` (small, ESM-first,
no Nest coupling; `@nestjs/jwt` would only wrap it). The client sends it as
`Authorization: Bearer`. The global `JwtAuthGuard` verifies signature, algorithm, issuer, audience
and expiry; routes opt out with `@Public()`. Every failure is `401 UNAUTHENTICATED`.

**Refresh token.** 32 random bytes, base64url (43 chars), valid for 30 days, stored only as a
SHA-256 hex digest (`refresh_tokens.token_hash`; a fast hash is right because the input is
high-entropy). It is **rotated on every refresh**: the presented token is revoked (with
`replaced_by_token_id`) and a new one issued in one transaction; the conditional update makes two
concurrent rotations of the same token mutually exclusive.

**Reuse detection.** Presenting a token that is already rotated or revoked revokes all active
refresh tokens of that user and returns `401 REFRESH_TOKEN_REUSED`. Unknown, expired or missing
tokens return `401 UNAUTHENTICATED`. Logout is idempotent and never counts as reuse itself. Conversely, a token that was revoked by
logout and is presented again later (for example a stale tab or a replayed request) is
indistinguishable from a rotated one and also counts as reuse: it revokes all of that user's
sessions. We accept this over storing a revocation reason (`LOGOUT` vs `ROTATED`), because a
logged-out token still being presented is itself suspicious and clients drop it on logout. Trade-off: two
tabs refreshing with the same cookie at the same moment sign the user out everywhere; clients must
serialize refreshes (single-flight).

**Web.** The refresh token lives in the httpOnly cookie `najme_rt` (`Path=/api/v1/auth`,
`SameSite=Lax`, `Max-Age` 30 days, `Secure` unless `NODE_ENV=development`, overridable with
`AUTH_COOKIE_SECURE`). The access token is kept in memory only and re-obtained through
`POST /auth/refresh` on page load. The cookie path keeps it off every other API request.

**Mobile.** With the header `X-Client: mobile` the refresh token is returned in the JSON body
(`authSession.refreshToken`) and read from the request body on refresh/logout; no cookie is set or
read. The app keeps it in secure storage. Without the header the body never contains it.

**CSRF.** The cookie is `SameSite=Lax` (not sent on cross-site POSTs), all auth endpoints are POST
and require `Content-Type: application/json` (`415` otherwise), which an HTML form cannot send;
access tokens are not cookies, so the rest of the API is not CSRF-exposed.

**Passwords.** argon2id via `@node-rs/argon2` (prebuilt native binaries, no install script, so no
pnpm `allowBuilds` entry), library defaults m=19 MiB, t=2, p=1 (OWASP minimum). Login runs a
verification against a dummy hash when the email is unknown or has no password, and answers
`401 INVALID_CREDENTIALS` in all failure cases, so neither response nor timing reveals which
emails exist. Registration necessarily answers `409 EMAIL_TAKEN`.

**Rate limiting.** `@nestjs/throttler`, in-memory, per client IP and route: register 5/min, login
10/min, refresh 30/min, `429 RATE_LIMITED` with `Retry-After`. The API trusts one proxy hop
(`trust proxy` = 1, Caddy) so the limiter sees real client IPs. In-memory state is per instance;
move to a shared store if the API is ever scaled out.

**Error mapping.** `EmailAlreadyRegisteredError` becomes `EMAIL_TAKEN` only inside register; if it
reaches the global filter anywhere else it is a generic `409 CONFLICT`.
`UnverifiedProviderEmailError` is `401 GOOGLE_TOKEN_INVALID`; `IdentityConflictError` is
`409 CONFLICT`. `UNAUTHORIZED` is no longer emitted (kept in the contract, deprecated).

**Access tokens after an account wipe.** When `findOrLinkByProvider` wipes a pre-hijacked account
(unverified password identity, refresh tokens), refresh tokens are revoked at once but access tokens
already issued stay valid until they expire (at most 15 minutes). We accept this window instead of
adding a per-request DB lookup or `tokenVersion` check to the guard: the attacker can only act with
the pre-registered account for that long, and the account now belongs to the verified owner. If a
future feature needs instant revocation (e.g. admin actions), add `sessionsInvalidatedAt` to
`users` and compare it with the token's `iat` in the guard.

## Consequences

- One secret to manage; rotating `JWT_ACCESS_SECRET` signs everyone out after at most 15 minutes
  (refresh tokens are unaffected, so clients silently get new access tokens signed with the new key).
- Clients must implement single-flight refresh and handle `REFRESH_TOKEN_REUSED` by sending the user
  to sign-in.
- Same-origin API access (Caddy `/api/*`, Next rewrite in dev) is assumed for the cookie flow.
