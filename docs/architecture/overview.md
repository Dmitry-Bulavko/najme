# Architecture overview

## System

```
             ┌──────────────┐        ┌──────────────┐
             │  Mobile app  │        │   Web app    │
             │ Expo (iOS/   │        │  Next.js     │
             │  Android)    │        │  App Router  │
             └──────┬───────┘        └──────┬───────┘
                    │ HTTPS /api/v1         │ HTTPS (SSR fetches + browser calls)
                    ▼                       ▼
             ┌───────────────────────────────────────┐
             │ Caddy (TLS, reverse proxy)            │
             │   /api/*  → api:3000                  │
             │   /*      → web:3000                  │
             └───────────────┬───────────────────────┘
                             ▼
             ┌───────────────────────────────┐      ┌──────────────────────┐
             │ API — NestJS                  │─────▶│ PostgreSQL 17        │
             │  modules: auth, users,        │      │  app data + pg-boss  │
             │  businesses, staff, services, │      │  job queue           │
             │  scheduling, bookings,        │      └──────────────────────┘
             │  catalog, notifications, admin│
             └───────────────┬───────────────┘
                             │ jobs (pg-boss)
                             ▼
               Expo Push · Email provider · Telegram Bot API
```

All production services run on one AWS Lightsail instance via Docker Compose (ADR-0007).

## Monorepo layout (target)

```
apps/
  api/          NestJS + Prisma. Owns the database schema and migrations.
  web/          Next.js. Public marketplace pages (SSR/SEO) + client and business UI.
  mobile/       Expo + expo-router. Client and business UI.
packages/
  config/       Shared tsconfig bases, ESLint flat config, Vitest preset.
  contracts/    zod schemas + inferred TS types for every API request/response.
  i18n/         Locale list, locale resolution, message catalogs (en, me, ru, tr).
  ui-tokens/    Design tokens (colors, radius, spacing, typography) for web and mobile.
infra/          compose.prod.yml, Caddyfile, server scripts.
```

Dependency direction: `apps/*` → `packages/*`. Packages never import from apps. `contracts` and
`i18n` are runtime-agnostic (no Node- or DOM-specific APIs).

## Key flows

- **API contract:** endpoint schemas are defined once in `packages/contracts`; the API validates
  requests with them and documents them via OpenAPI; web and mobile use the same types in a thin
  typed client with TanStack Query (ADR-0002, ADR-0003).
- **Availability:** clients never compute slots. `GET …/availability` returns slots computed on the
  server from working hours, time off, existing bookings and service duration in the business
  timezone (ADR-0005).
- **Booking integrity:** a Postgres exclusion constraint makes overlapping active bookings for the
  same staff member impossible, even under concurrent requests (ADR-0005).
- **Notifications:** domain events enqueue pg-boss jobs; workers render localized templates and
  deliver via push, email and Telegram (ADR-0006).

## Decision records

See `adr/`. Current set:

| ADR                                            | Decision                                                     |
| ---------------------------------------------- | ------------------------------------------------------------ |
| [0001](adr/0001-monorepo.md)                   | pnpm workspaces + Turborepo monorepo                         |
| [0002](adr/0002-api-stack-and-contracts.md)    | NestJS + Prisma + PostgreSQL; zod contracts; REST /api/v1    |
| [0003](adr/0003-clients.md)                    | Next.js web + Expo mobile; one product with two modes        |
| [0004](adr/0004-i18n.md)                       | Four locales, shared catalogs, locale resolution             |
| [0005](adr/0005-time-and-booking-integrity.md) | UTC storage, business timezone, exclusion constraint         |
| [0006](adr/0006-jobs-and-notifications.md)     | pg-boss jobs; push, email, Telegram                          |
| [0007](adr/0007-deployment.md)                 | Lightsail VPS + Docker Compose + Caddy via GitHub Actions    |
| [0008](adr/0008-agentic-workflow.md)           | Issues as source of truth; orchestrator + subagents          |
| [0009](adr/0009-core-domain-model.md)          | Core domain model: IDs, tenancy, money, time, status machine |

See also [`data-model.md`](data-model.md) for the full entity list, ER diagram and booking status
state machine.
