# infra

Production runtime for Najme on a single AWS Lightsail instance (ADR-0007).

| File                          | Where it runs                    | Purpose                                             |
| ----------------------------- | -------------------------------- | --------------------------------------------------- |
| `compose.prod.yml`            | server `/opt/najme`              | caddy, web, api, postgres, one-off `migrate`        |
| `Caddyfile`                   | server `/opt/najme`              | TLS + routing: `/api/*` → api, rest → web           |
| `scripts/deploy.sh`           | server, called by GitHub Actions | pull → migrate → up → health check → rollback       |
| `scripts/backup-db.sh`        | server, nightly cron             | `pg_dump` to `/opt/najme/backups`, 14-day retention |
| `scripts/bootstrap-server.sh` | server, once, as root            | Docker, deploy user, firewall, swap, cron           |
| `compose.smoke.yml`           | CI only (`smoke.yml`)            | Override: plain-HTTP Caddyfile for the smoke test   |
| `Caddyfile.smoke`             | CI only (`smoke.yml`)            | Same routing as `Caddyfile`, no TLS/ACME            |

The deploy workflow (`.github/workflows/deploy.yml`) copies the first five files to `/opt/najme` on
every deploy, so the repository is the source of truth — do not edit them on the server. The
`.smoke` files are never deployed; they only exist for `.github/workflows/smoke.yml`
(`docs/runbooks/deploy.md`).

Runbook: `docs/runbooks/deploy.md`.
