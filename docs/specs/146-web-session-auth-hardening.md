# #146 — Harden the web session client, GIS init and auth-page details

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/146
- Status: Implemented
- Related: ADR-0010, ADR-0011, `apps/web/src/lib/api/client.ts`, #<143–147>

## Goal

Harden the web session client and auth pages: refresh only when it can help, keep in-memory
access-token state consistent, initialise Google Identity Services once per page load, and close
remaining i18n / `Referrer-Policy` gaps from M1.

## Approach

- Gate `apiRequest` 401→refresh→retry on “request had a bearer” and “path is not under `/auth/`”.
- Align `doRefresh` with the mobile transient-failure rule: clear the access token only on
  definitive client errors (400/401/403); leave it on network errors and 5xx.
- Clear the access token on every restore path that ends `anonymous`.
- Keep GIS `initialize` deps at `[clientId, locale]`; hold router/signIn/searchParams/tErrors in
  refs so callbacks stay fresh without re-init. Hide the button when already authenticated.
- **Nonce:** accept the missing GIS nonce for alpha (ADR-0010 amendment) rather than a contract/API
  change — see ADR.
- Send `Referrer-Policy: no-referrer` as a real response header from `proxy.ts` for locale-prefixed
  verify/reset routes (metadata `<meta>` alone is not enough per ADR-0011).
- Shared `errorMessage(tErrors, code)` helper; email placeholders via `auth.emailPlaceholder`.

## Changes

| Area / path                              | Change                                                         |
| ---------------------------------------- | -------------------------------------------------------------- |
| `apps/web/src/lib/api/client.ts`         | Conditional refresh; selective token clear                     |
| `apps/web/src/features/auth/*`           | GIS once, banner hydration, verify session, token scrub, forms |
| `apps/web/src/lib/i18n/error-message.ts` | Fallback helper + unit test                                    |
| `apps/web/src/proxy.ts`                  | `Referrer-Policy` on token pages                               |
| `apps/web/playwright.config.ts`          | `retries: 0` in CI                                             |
| `packages/i18n`                          | `auth.emailPlaceholder` (en/me/ru/tr)                          |
| `docs/architecture/adr/0010-*.md`        | Nonce risk accepted for alpha                                  |

### Contracts / API

None (nonce not implemented).

### Data model

None.

### UI and i18n

- `auth.emailPlaceholder` in en, me, ru, tr.
- Auth forms + account view use `errorMessage` instead of casts.

## Test plan

- Unit: no `/auth/refresh` on wrong-password login with a stale cookie; 503 on refresh keeps the
  access token; `/me` failure on restore clears it; `errorMessage` unknown code → `HTTP_ERROR`;
  email-link token scrub (hook); proxy sets `Referrer-Policy`.
- Existing auth form / GIS / banner / verify panel tests updated as needed.

## Risks and open questions

- GIS nonce deferred to a later hardening pass (documented in ADR-0010).

## Implementation notes

- Prefer ADR amendment over nonce plumbing for alpha scope.
- Token scrub runs synchronously in the effect (no `setTimeout`); callers already use the value
  captured by `useState`, so verify/reset still see the token.
