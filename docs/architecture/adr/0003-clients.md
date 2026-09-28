# ADR-0003: Clients — Next.js web and Expo mobile, one product with two modes

- Status: Accepted
- Date: 2026-09-28

## Context

Clients search and book; businesses manage their calendar. Both must work on web and mobile. Public
business pages need SEO. The user base is small, so one coherent product beats two separate apps.

## Decision

- **Web:** Next.js (latest stable, App Router), Tailwind CSS, `next-intl` for i18n with locale in
  the URL path (`/en/...`, `/me/...`). Public marketplace pages are server-rendered for SEO; the
  business dashboard lives under `/[locale]/business/...`.
- **Mobile:** Expo (latest SDK) with expo-router; `i18next` + `expo-localization`. Business mode is a
  separate route group reachable via a mode switcher.
- **One product, two modes:** every signed-in user has client mode; users who are members of a
  business can switch to business mode. The same backend endpoints serve both clients.
- **Data fetching:** TanStack Query on both clients over a thin typed fetch client built on
  `packages/contracts` types.
- **Design:** shared design tokens in `packages/ui-tokens` (primary `#526ED3`, Manrope, radius 12);
  UI components are **not** shared between web and mobile — each uses idiomatic primitives.
- **Forms:** react-hook-form + zod resolvers using schemas from contracts where possible.

## Consequences

- UI work is done twice (web + mobile) for features needed on both; issues should state which
  clients are in scope.
- Web can ship features faster; mobile may lag by design when an issue says so.
