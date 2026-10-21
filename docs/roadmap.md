# Roadmap

Owned by `/manager`. Phases are GitHub epics (`type:epic`); tasks are their sub-issues. This file
holds the phase-level view only — task status lives in GitHub.

Current phase: **M3 — Scheduling & booking core**

| Phase | Epic | Goal                                                                                 | Exit criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Status      |
| ----- | ---- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| M0    | #1   | Foundation: monorepo packages, API/web/mobile skeletons, CI                          | `pnpm check` green with all apps; `pnpm dev` works from a fresh clone (CI-checked); production images pass the smoke test; mobile app runs with 4 locales                                                                                                                                                                                                                                                                                                                                                                                                                                            | Done        |
| M1    | #2   | Accounts & auth with a complete UI on web and mobile                                 | Sign up / sign in with email+password and Google (web + mobile dev build); soft email verification and password reset (Mailpit in dev); rotating refresh tokens; profile with language; web (shadcn/ui) and mobile UI kits on shared tokens; API and Playwright e2e tests                                                                                                                                                                                                                                                                                                                            | Done        |
| M2    | #3   | Businesses, staff & services; category and city catalogue; platform-admin moderation | On web an owner creates a business (category, city), 2 staff, 3 services (one with a custom field), weekly hours and time off, then edits all of it on mobile; an invited staff member accepts by email and edits only their own hours and time off; a route-walker e2e proves 404 for non-members on every `/businesses/:businessId/*` route and per-endpoint tests prove 403 for disallowed roles; a platform admin approves the business on the web admin page, and a rejected business shows the reason and can resubmit; logo, cover and staff photo upload in dev (MinIO); all UI in 4 locales | Done        |
| M3    | #4   | Scheduling & booking core: client self-booking, walk-ins, pg-boss lifecycle jobs     | Unit tests cover DST days (2026-03-29, 2026-10-25), overlapping time off, buffers, back-to-back bookings, notice and horizon, and the slot grid; 10 parallel requests for one slot give one 201 and nine 409 `SLOT_TAKEN`; a client books on mobile, the business confirms on web and the client sees `CONFIRMED` on mobile (web automated, mobile recorded); a walk-in overlapping a booking gets `SLOT_TAKEN`; the sweeps complete and expire bookings correctly; 4 locales                                                                                                                        | In progress |
| M4    | #5   | Marketplace discovery                                                                | Search by category, city and text with cursor pagination on web and mobile ("nikolic" finds "Nikolić"); the business page has full metadata, OG, JSON-LD and hreflang for 4 locales plus `x-default`, and every approved business is in the sitemap; booking starts from the business page on both platforms                                                                                                                                                                                                                                                                                         | Planned     |
| M5    | #6   | Notifications                                                                        | Every event in the recipient matrix is delivered by email (AWS SES over SMTP), Expo push (dev build) and Telegram in the recipient's locale; tests prove reminders (24h/2h) survive a reschedule and are skipped after cancellation, a rolled-back transaction sends nothing, handlers are idempotent under retry, and dead push tokens are removed                                                                                                                                                                                                                                                  | Planned     |
| M6    | #7   | Reviews, trust & admin                                                               | Review lifecycle covered end to end with correct rating aggregates; every admin action audited; a blocked user can't sign in or refresh; category edits show up in discovery in 4 locales; a report leads to a resolution such as hiding a review or suspending a business                                                                                                                                                                                                                                                                                                                           | Planned     |
| M7    | #8   | Alpha launch                                                                         | First production deploy on Lightsail (#18) once M1–M6 are closed and M7's P0 code is merged, via the go-live checklist; Apple sign-in; account deletion on both platforms; privacy policy and terms with consent at sign-up; monitoring and error tracking (Sentry) with alerts reaching the owner; analytics (Umami); off-site backups with a rehearsed restore; security checklist signed off; TestFlight and Play internal builds install and receive OTA updates; first real businesses onboarded                                                                                                | Planned     |

**Process (from 2026-09-29).** Cursor implements the phases on the long-lived branch
`cursor/alpha`, with one phase PR (`cursor/alpha → main`) per phase. Claude reviews every task Cursor
hands off, and the phase PR is merged after each phase. See `docs/workflow/cursor-handoff.md` and
ADR-0012.

**Phase shifts (2026-09-29 decomposition):**

- The pg-boss jobs module arrives in M3 (booking lifecycle sweeps); M5 builds notifications on it.
- The category catalogue (seeded, translated, read-only) and the fixed city list arrive in M2.
  Category icons follow in M4 and category admin CRUD in M6.
- A minimal platform-admin moderation flow (approve/reject, web admin page) arrives in M2. The full
  admin area stays in M6.
- Email verification and password reset were delivered in M1 (#49), so they are removed from M5.

## Later (post-alpha)

Monetization (subscriptions or promotion), online payments/deposits, SMS/WhatsApp/Viber, in-app
chat, multi-location businesses, public API for partners.

## Changelog

- 2026-10-21 — M2 done (PR #151, merge `5cb8611`). Owner decision: the real-device pass of the M2 mobile flows is deferred to #155. M2 review follow-ups filed as #156–#160. Current phase is M3 (#4); tasks #89–#103 set to `status:ready`.
- 2026-09-30 — M1 done (PR #141, merge `81f2ad9`). Google OAuth client IDs (#58) deferred to M7. Current phase is M2 (#3); tasks #72–#88 set to `status:ready`.
- 2026-09-28 — Roadmap created (M0–M7) with the agentic workflow bootstrap; M0 tasks #9–#18 created.
- 2026-09-29 — M0 done. Owner decision: no production deploy until the UI is complete — the first
  deploy (#18) and Apple sign-in move to M7. M1 scope: email+password and Google, soft email
  verification, UI kits (shadcn/ui on web, own primitives on mobile), web and mobile in parallel.
- 2026-09-29 — Handoff to Cursor; M2–M7 decomposed into issues; product decisions R10–R19.
