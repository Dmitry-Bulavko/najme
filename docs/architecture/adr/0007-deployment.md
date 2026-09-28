# ADR-0007: Deployment on AWS Lightsail with Docker Compose

- Status: Accepted
- Date: 2026-09-28

## Context

Alpha-stage product, low traffic, cost-sensitive. We need automatic, verified deploys with a simple
rollback, triggered by pushing to the `production` branch.

## Decision

- **Host:** one AWS Lightsail instance (4 GB RAM plan), Ubuntu 24.04 LTS, static IP.
- **Runtime:** Docker Compose (`infra/compose.prod.yml`) with `caddy` (TLS via Let's Encrypt,
  reverse proxy), `web`, `api`, `postgres` (17, named volume) and a one-off `migrate` service.
- **Routing:** one domain (`DOMAIN`, alpha: `najme.dzmitry-bulauka.com`); `/api/*` → api,
  everything else → web. One origin means no CORS for the web app.
- **Images:** built in GitHub Actions and pushed to GHCR (`ghcr.io/dmitry-bulavko/najme-api`,
  `…/najme-web`) tagged with the commit SHA and `production`. The server only pulls.
- **Pipeline** (`.github/workflows/deploy.yml`), on push to `production`:
  1. `verify` — reuses `ci.yml` (format, lint, typecheck, test, build);
  2. `images` — Docker build and push (a second build check);
  3. `deploy` — writes `.env` from the GitHub `production` environment secrets, copies `infra/` to
     `/opt/najme` over SSH, runs `infra/scripts/deploy.sh <sha>`: pull → migrate → up → health
     check → automatic rollback to the last good tag on failure.
- **Releases** are created by `/manager release` (PR `main` → `production`, merged after explicit
  human approval). Agents never push to `production` directly.
- **Backups:** nightly `pg_dump` kept 14 days on the instance plus Lightsail automatic snapshots.
  Off-site backups are an M7 task.
- **Mobile** apps are built and submitted with EAS (M7), not deployed to the server.

## Consequences

- Single point of failure accepted for the alpha.
- Migrations must be backward compatible with the previous app version (expand → migrate →
  contract), because rollback only reverts images, not the schema.
