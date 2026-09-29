# ADR-0011: Transactional email and email tokens

- Status: Accepted
- Date: 2026-09-29

## Context

#49 adds verification and password-reset emails. The production provider is undecided (M5, Q1), so
the design must not depend on it, and sending must never make an auth request slower or fail.

## Decision

- **SMTP + nodemailer** behind an abstract `Mailer`. Any provider offering SMTP works by changing
  `SMTP_*` and `MAIL_FROM`; an API-based provider means one new `Mailer` implementation. Dev and CI
  use Mailpit.
- **Fire-and-forget sending** through `MailService.defer` (failure logged with the user id only).
  M5 swaps it for a pg-boss job without touching callers.
- **Email tokens** follow ADR-0010's refresh token scheme: 32 random bytes base64url, SHA-256 at
  rest, single use, claimed atomically with a conditional update inside the transaction that applies
  the effect. TTL: 24 h verify, 1 h reset. Issuing a token deletes the user's older unused tokens of
  the same purpose.
- **Localization** uses the `emails` namespace of `@najme/i18n` and the user's `localePreference`;
  links are `${APP_WEB_URL}/<locale>/verify-email|reset-password?token=…` and open web pages (mobile
  deep links later).
- **Password reset** replaces the hash and revokes every refresh token in one transaction.
  Access tokens already issued remain valid up to 15 minutes (same accepted window as ADR-0010).
  Because the link only reaches the mailbox owner, a successful reset also sets `emailVerifiedAt`
  if unset (other identities are untouched).
- **Logging:** failed background email jobs log a constant label, the user id when known, and the
  error name and code, never the message: Prisma and nodemailer messages embed email addresses.
- **Enumeration:** `forgot-password` always answers an empty 202 and does its work after responding.

## Known limitations

- Anyone can call `forgot-password` repeatedly for a victim's email; each call issues a new token
  and invalidates the victim's pending reset link (a nuisance, not a takeover). Fix in M5: per-email
  throttling, or not re-issuing a token within N minutes.

## Consequences

- A process crash between response and send loses that email; users can resend / retry.
- Tokens appear in URLs (browser history, referrer): the web pages must exchange them immediately
  via POST and send `Referrer-Policy: no-referrer`.
- Required env vars: `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM`, `APP_WEB_URL` (+ optional `SMTP_USER`,
  `SMTP_PASSWORD`).
