# Roadmap

Owned by `/manager`. Phases are GitHub epics (`type:epic`); tasks are their sub-issues. This file
holds the phase-level view only — task status lives in GitHub.

Current phase: **M1 — Accounts & auth**

| Phase | Epic | Goal                                                        | Exit criteria                                                                                                                                                                                                                                                             | Status      |
| ----- | ---- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| M0    | #1   | Foundation: monorepo packages, API/web/mobile skeletons, CI | `pnpm check` green with all apps; `pnpm dev` works from a fresh clone (CI-checked); production images pass the smoke test; mobile app runs with 4 locales                                                                                                                 | Done        |
| M1    | #2   | Accounts & auth with a complete UI on web and mobile        | Sign up / sign in with email+password and Google (web + mobile dev build); soft email verification and password reset (Mailpit in dev); rotating refresh tokens; profile with language; web (shadcn/ui) and mobile UI kits on shared tokens; API and Playwright e2e tests | In progress |
| M2    | #3   | Businesses, staff & services                                | A user creates a business, invites staff, defines services, working hours and time off on web and mobile; mode switcher                                                                                                                                                   | Planned     |
| M3    | #4   | Scheduling & booking core                                   | Correct slots (DST-safe); booking without double bookings under concurrency; confirm/cancel/reschedule; business calendar per staff; client "my bookings"                                                                                                                 | Planned     |
| M4    | #5   | Marketplace discovery                                       | Admin-managed translated categories; search by category/city/text; SEO business pages on web; booking from the business page                                                                                                                                              | Planned     |
| M5    | #6   | Notifications                                               | pg-boss jobs; email, Expo push and Telegram delivery; localized templates; reminders 24h/2h                                                                                                                                                                               | Planned     |
| M6    | #7   | Reviews, trust & admin                                      | Reviews after completed bookings; business moderation; admin panel for categories and reports                                                                                                                                                                             | Planned     |
| M7    | #8   | Alpha launch                                                | First production deploy on Lightsail (only once the UI is complete, #18); Apple sign-in; monitoring, error tracking, off-site backups, EAS builds (TestFlight / internal testing), privacy policy, analytics; first real businesses onboarded                             | Planned     |

## Later (post-alpha)

Monetization (subscriptions or promotion), online payments/deposits, SMS/WhatsApp/Viber, in-app
chat, multi-location businesses, public API for partners.

## Changelog

- 2026-09-28 — Roadmap created (M0–M7) with the agentic workflow bootstrap; M0 tasks #9–#18 created.
- 2026-09-29 — M0 done. Owner decision: no production deploy until the UI is complete — the first
  deploy (#18) and Apple sign-in move to M7. M1 scope: email+password and Google, soft email
  verification, UI kits (shadcn/ui on web, own primitives on mobile), web and mobile in parallel.
