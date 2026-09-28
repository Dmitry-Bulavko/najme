# Roadmap

Owned by `/manager`. Phases are GitHub epics (`type:epic`); tasks are their sub-issues. This file
holds the phase-level view only — task status lives in GitHub.

Current phase: **M0 — Foundation**

| Phase | Epic | Goal                                                                      | Exit criteria                                                                                                                                             | Status      |
| ----- | ---- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| M0    | #1   | Foundation: monorepo packages, API/web/mobile skeletons, CI, first deploy | `pnpm check` green with all apps; health page live at `https://najme.dzmitry-bulauka.com`; mobile app runs in a dev build with 4 locales                  | In progress |
| M1    | #2   | Accounts & auth                                                           | Sign up / sign in with email+password, Google (web+mobile), Apple (iOS); refresh tokens; profile with language; e2e tests                                 | Planned     |
| M2    | #3   | Businesses, staff & services                                              | A user creates a business, invites staff, defines services, working hours and time off on web and mobile; mode switcher                                   | Planned     |
| M3    | #4   | Scheduling & booking core                                                 | Correct slots (DST-safe); booking without double bookings under concurrency; confirm/cancel/reschedule; business calendar per staff; client "my bookings" | Planned     |
| M4    | #5   | Marketplace discovery                                                     | Admin-managed translated categories; search by category/city/text; SEO business pages on web; booking from the business page                              | Planned     |
| M5    | #6   | Notifications                                                             | pg-boss jobs; email, Expo push and Telegram delivery; localized templates; reminders 24h/2h                                                               | Planned     |
| M6    | #7   | Reviews, trust & admin                                                    | Reviews after completed bookings; business moderation; admin panel for categories and reports                                                             | Planned     |
| M7    | #8   | Alpha launch                                                              | Monitoring, error tracking, off-site backups, EAS builds (TestFlight / internal testing), privacy policy, analytics; first real businesses onboarded      | Planned     |

## Later (post-alpha)

Monetization (subscriptions or promotion), online payments/deposits, SMS/WhatsApp/Viber, in-app
chat, multi-location businesses, public API for partners.

## Changelog

- 2026-09-28 — Roadmap created (M0–M7) with the agentic workflow bootstrap; M0 tasks #9–#18 created.
