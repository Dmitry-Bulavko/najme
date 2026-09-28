# ADR-0006: Background jobs and notifications

- Status: Accepted
- Date: 2026-09-28

## Context

We need reliable delayed work (booking reminders), retries for external deliveries, and three
channels in the MVP: Expo push, email and a Telegram bot. We run on a single VPS and want minimal
moving parts.

## Decision

- **pg-boss** on the existing PostgreSQL as the job queue (no Redis). Workers run inside the API
  process at first; they can move to a separate container later without code changes.
- Domain services emit events (`booking.created`, `booking.confirmed`, `booking.cancelled`, …);
  a notifications module turns them into jobs per recipient and channel.
- **Channels:**
  - Push: Expo Push API with tokens stored per device.
  - Email: provider behind an interface (AWS SES by default, see open question Q1).
  - Telegram: one bot; users link their account via a deep link with a one-time token.
- **Templates** are localized using `packages/i18n` and the recipient's locale.
- **Reminders** are scheduled jobs (e.g. 24 h and 2 h before start) that re-check booking status
  before sending.
- Delivery attempts are logged; failures retry with backoff; permanent failures are recorded.

## Consequences

- One database to back up covers jobs too.
- Job handlers must be idempotent.
