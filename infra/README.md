# infra

Production runtime for Najme on a single AWS Lightsail instance (ADR-0007).

| File                          | Where it runs                    | Purpose                                             |
| ----------------------------- | -------------------------------- | --------------------------------------------------- |
| `compose.prod.yml`            | server `/opt/najme`              | caddy, web, api, postgres, one-off `migrate`        |
| `Caddyfile`                   | server `/opt/najme`              | TLS + routing: `/api/*` → api, rest → web           |
| `scripts/deploy.sh`           | server, called by GitHub Actions | pull → migrate → up → health check → rollback       |
| `scripts/backup-db.sh`        | server, nightly cron             | `pg_dump` to `/opt/najme/backups`, 14-day retention |
| `scripts/bootstrap-server.sh` | server, once, as root            | Docker, deploy user, firewall, swap, cron           |

The deploy workflow (`.github/workflows/deploy.yml`) copies these files to `/opt/najme` on every
deploy, so the repository is the source of truth — do not edit them on the server.

Runbook: `docs/runbooks/deploy.md`.
