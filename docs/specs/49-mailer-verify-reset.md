# #49 — Mailer with Mailpit, localized emails, email verification and password reset

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/49
- Status: Implemented
- Related: ADR-0010, ADR-0011, ADR-0004, `docs/conventions/env-vars.md`, #46, #47, #48

## Goal

After sign-up the user gets a localized verification email; a forgotten password can be reset by
email. In dev and CI every email lands in Mailpit. Verification is soft (R8): unverified users keep
using the app, `me.emailVerified` drives a client banner.

## Approach

- **Transport seam.** `Mailer` (abstract class, DI token) with `send(message)`; `SmtpMailer`
  (nodemailer) is the only implementation. Tests override it with `FakeMailer`.
- **Sync vs fire-and-forget: fire-and-forget.** `MailService.defer()` runs "issue token + render +
  send" after the response is already decided; failures are logged (`user <id>` only, no address)
  and swallowed. Registration and forgot-password therefore never wait for or fail on SMTP, and
  forgot-password timing does not depend on whether the account exists. Cost: a crash between
  response and send loses the email (the user can resend). M5 replaces `defer` with a pg-boss job.
  `idle()` awaits pending jobs (tests, `beforeApplicationShutdown`).
- **Tokens.** `EmailTokenService` (same scheme as refresh tokens): 32 random bytes base64url, stored
  as SHA-256 hex in `email_tokens`. TTL 24 h (`VERIFY_EMAIL`), 1 h (`RESET_PASSWORD`). `issue`
  deletes the user's unused tokens of that purpose first (so resend invalidates older links).
  `consume` claims with one conditional `UPDATE ... WHERE token_hash AND purpose AND used_at IS NULL
AND expires_at > now RETURNING user_id` inside a transaction together with the effect, so a
  failing effect rolls the claim back and two concurrent requests cannot both win. On a miss it
  looks the token up to tell `TOKEN_EXPIRED` (unused but past expiry) from `TOKEN_INVALID`
  (unknown, used, or another purpose).
- **Templates.** New i18n namespace `emails` (all four locales). Rendering in `mail/email-templates.ts`:
  plain-text part plus inline-styled HTML with `ui-tokens` colours. Only `{hours, plural, ...}` is
  needed, so a ~15-line formatter using `Intl.PluralRules` replaces an ICU dependency.
- **Links.** `${APP_WEB_URL}/${locale}/verify-email|reset-password?token=…` with the user's
  `localePreference` (fallback `en`) for both link and template.
- **No enumeration.** `forgot-password` returns an empty 202 for every input; the lookup and send
  happen after the response. Only accounts with a password identity get an email.
- **Reset.** In one transaction: claim token, replace the argon2id hash, revoke all refresh tokens.
  Access tokens already issued live up to 15 minutes more (ADR-0010 window, accepted).

## Changes

| Area / path                          | Change                                                             |
| ------------------------------------ | ------------------------------------------------------------------ |
| `packages/i18n`                      | `emails` namespace x4 locales, wired into `catalogs`, parity tests |
| `apps/api/src/mail`                  | `Mailer`, `SmtpMailer`, `MailService`, templates, `MailModule`     |
| `apps/api/src/auth`                  | `EmailTokenService`, 4 endpoints, register sends the email         |
| `apps/api/src/users`                 | `markEmailVerified`, `setPassword` (optional transaction client)   |
| `apps/api/src/config/env.schema.ts`  | `SMTP_HOST/PORT/USER/PASSWORD`, `MAIL_FROM`, `APP_WEB_URL`         |
| `compose.dev.yml`, `ci.yml`          | Mailpit service; CI env for SMTP and `MAILPIT_URL`                 |
| `.env.example`, `env-vars.md`, infra | new vars documented, wired in compose.prod, deploy.yml, smoke.yml  |

### Contracts / API

No contract changes (#46 already has the schemas and error codes).

| Endpoint                         | Auth | Success | Errors                              | Limit (per IP) |
| -------------------------------- | ---- | ------- | ----------------------------------- | -------------- |
| `POST /auth/verify-email`        | no   | 204     | 400 `TOKEN_INVALID`/`TOKEN_EXPIRED` | 10/min         |
| `POST /auth/verify-email/resend` | yes  | 202     | 401                                 | 3/min          |
| `POST /auth/forgot-password`     | no   | 202     | 400 validation only                 | 5/min          |
| `POST /auth/reset-password`      | no   | 204     | 400 `TOKEN_INVALID`/`TOKEN_EXPIRED` | 10/min         |

Resend is a no-op (still 202) when the email is already verified. `@Public(false)` re-protects it
inside the public auth controller.

### Data model

None (`EmailToken` exists from #47).

### UI and i18n

Namespace `emails`: `layout.*`, `verifyEmail.*`, `resetPassword.*` (subject, heading, intro, action,
expiry, ignore). The web pages `/[locale]/verify-email` and `/reset-password` are separate tasks;
until they exist the links 404.

## Test plan

- Unit: template rendering in all locales and plural forms; env schema.
- e2e with `FakeMailer` (always runs): sign-up email + hashed token + TTL, send failure does not
  break registration, verify happy/reused/expired/concurrent/wrong purpose, resend (auth, invalidates
  old link, no-op when verified, rate limit), forgot/reset (localized link, TTL, revokes sessions,
  unknown email identical response and no email, password-less account), reset expired.
- e2e with real Mailpit (`MAILPIT_URL`; runs in CI, skipped otherwise): multipart email delivered,
  verify happy/reused/expired, forgot/reset with session revocation, unknown email sends nothing.

## Risks and open questions

- Fire-and-forget can lose an email on crash; acceptable until the M5 queue.
- Rate limits are per IP, in memory; a per-user resend cooldown can come with the queue.
- Web pages for the links are not part of this task.

## Implementation notes

- `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM`, `APP_WEB_URL` are required (no defaults) so a production
  misconfiguration cannot silently produce links to localhost. Vitest configs supply Mailpit values.
- Mailpit was run locally from the release binary; the whole e2e suite passed with `MAILPIT_URL` set.
