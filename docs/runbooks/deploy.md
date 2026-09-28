# Deploy runbook — AWS Lightsail

Architecture: ADR-0007. Pipeline: `.github/workflows/deploy.yml`. Server files: `infra/`.

## One-time server provisioning (human)

The existing $20 Lightsail instance (4 GB RAM) is reused and wiped.

1. **Snapshot first.** Lightsail console → the instance → Snapshots → Create snapshot (keeps the old
   project recoverable).
2. **Fresh OS.** Create a new instance on the same plan from the **Ubuntu 24.04 LTS** blueprint (same
   region), then delete the old one once you no longer need it. (Recreating is cleaner than wiping
   in place.)
3. **Static IP.** Networking → attach the existing static IP (or create one) to the new instance.
4. **Firewall (Lightsail networking tab):** allow TCP 22, 80, 443 only.
5. **DNS.** At the DNS provider of `dzmitry-bulauka.com` create an `A` record
   `najme.dzmitry-bulauka.com → <static IP>`. (Changing the domain later = update the `DOMAIN` var and
   DNS; nothing else.)
6. **Bootstrap.** SSH in as `ubuntu` and run:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/Dmitry-Bulavko/najme/main/infra/scripts/bootstrap-server.sh -o bootstrap.sh
   # or scp infra/scripts/bootstrap-server.sh from a checkout if the repo is private
   sudo bash bootstrap.sh
   ```

   It installs Docker + Compose, creates the `deploy` user, `/opt/najme`, swap, firewall rules,
   unattended upgrades and the nightly backup cron.

7. **Deploy key.** On your machine: `ssh-keygen -t ed25519 -f najme_deploy -C github-actions`. Append
   `najme_deploy.pub` to `/home/deploy/.ssh/authorized_keys` on the server.
8. **Host key:** `ssh-keyscan -t ed25519 <static IP>` → value for `LIGHTSAIL_KNOWN_HOSTS`.
9. **GHCR token:** GitHub → Settings → Developer settings → Fine-grained or classic PAT with
   `read:packages` → `GHCR_READ_TOKEN`.

## GitHub environment `production` (human)

Create the environment as described in `github-setup.md`, then add:

| Name                    | Type     | Value                                       |
| ----------------------- | -------- | ------------------------------------------- |
| `DOMAIN`                | variable | `najme.dzmitry-bulauka.com`                 |
| `LIGHTSAIL_HOST`        | secret   | static IP                                   |
| `LIGHTSAIL_USER`        | secret   | `deploy`                                    |
| `LIGHTSAIL_SSH_KEY`     | secret   | contents of `najme_deploy` (private key)    |
| `LIGHTSAIL_KNOWN_HOSTS` | secret   | output of `ssh-keyscan`                     |
| `GHCR_READ_TOKEN`       | secret   | PAT with `read:packages`                    |
| `POSTGRES_PASSWORD`     | secret   | long random string (`openssl rand -hex 32`) |

Later features add more (JWT secrets, OAuth, email, Telegram, Expo) — see
`docs/conventions/env-vars.md`.

## Releasing

Releases are prepared by `/manager release`:

1. It compiles the changelog of PRs merged into `main` since the last release.
2. After your explicit "yes" it opens and merges a PR `main → production` (merge commit).
3. The push to `production` runs `deploy.yml`: `verify` (full CI) → `images` (build & push to GHCR)
   → `deploy` (SSH, `infra/scripts/deploy.sh <sha>`).
4. `deploy.sh` pulls images, runs `prisma migrate deploy`, restarts services, waits for
   `https://$DOMAIN/api/v1/health`, and on failure rolls back to the previous good tag.

The first release happens after epic M0 is complete (apps scaffolded, Dockerfiles exist). Create the
`production` branch from `main` at that point.

## Rollback

- Automatic: `deploy.sh` restores `.last_successful_tag` if the health check fails.
- Manual: Actions → Deploy → Run workflow on `production` with input `image_tag=<older sha>`, or on
  the server: `cd /opt/najme && sudo -u deploy ./deploy.sh <older sha>`.
- Schema rollbacks are not automatic — migrations must be backward compatible (ADR-0007).

## Backups

- Nightly `infra/scripts/backup-db.sh` (cron, 03:15 server time) writes
  `/opt/najme/backups/najme-<date>.sql.gz`, keeps 14 days.
- Enable Lightsail automatic snapshots for the instance (daily).
- Restore: `gunzip -c backup.sql.gz | docker compose -f compose.prod.yml exec -T postgres psql -U najme najme`.

## Troubleshooting

```bash
ssh deploy@<host>
cd /opt/najme
docker compose -f compose.prod.yml ps
docker compose -f compose.prod.yml logs -f --tail=200 api
```
