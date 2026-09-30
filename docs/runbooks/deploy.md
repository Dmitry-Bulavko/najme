# Deploy runbook — AWS Lightsail

Architecture: ADR-0007. Pipeline: `.github/workflows/deploy.yml`. Server files: `infra/`.

## Smoke test (CI)

`.github/workflows/smoke.yml` runs on every pull request touching `apps/**`, `packages/**`,
`infra/**`, any `Dockerfile`, the lockfile or the workflow itself, and on push to `main`. It proves
the production stack actually works before a change can reach `production`:

1. Builds `najme-api` and `najme-web` with Buildx (`load: true`, not pushed), reusing the same
   build definitions as `deploy.yml`.
2. Starts `infra/compose.prod.yml` with a throwaway `.env` and `infra/compose.smoke.yml`, a CI-only
   override that swaps the Caddyfile for `infra/Caddyfile.smoke` (plain HTTP on `:80`, no ACME —
   GitHub-hosted runners have no public DNS or CA to complete a TLS handshake). The production
   compose file and `Caddyfile` are otherwise unchanged.
3. Runs the `migrate` profile, then asserts `GET /api/v1/health` returns
   `{"status":"ok","db":"ok"}`, that `@najme/contracts` actually resolves inside the running `api`
   container (regression check for the dangling-workspace-symlink bug fixed in #16), and that the
   web home page (`/en`) returns 200 through Caddy. It also asserts that `GET /` with
   `Accept-Language: ru` returns 307 to `.../ru`, and that `GET /xx/foo` redirects to `.../ru/foo`
   (no `-L`; proves the locale proxy runs in the standalone image and strips unsupported locales).
4. Always tears the stack down (`docker compose down -v`); prints `docker compose logs` on failure.

If it fails, re-run the job and read the printed compose logs first; a local repro is
`docker compose -f infra/compose.prod.yml -f infra/compose.smoke.yml --env-file infra/.env up`
with a hand-written `infra/.env` (same keys as the production one, `DOMAIN=localhost`).

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

| Name                        | Type     | Value                                                                               |
| --------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `DOMAIN`                    | variable | `najme.dzmitry-bulauka.com`                                                         |
| `LIGHTSAIL_HOST`            | secret   | static IP                                                                           |
| `LIGHTSAIL_USER`            | secret   | `deploy`                                                                            |
| `LIGHTSAIL_SSH_KEY`         | secret   | contents of `najme_deploy` (private key)                                            |
| `LIGHTSAIL_KNOWN_HOSTS`     | secret   | output of `ssh-keyscan`                                                             |
| `GHCR_READ_TOKEN`           | secret   | PAT with `read:packages`                                                            |
| `POSTGRES_PASSWORD`         | secret   | long random string (`openssl rand -hex 32`)                                         |
| `JWT_ACCESS_SECRET`         | secret   | long random string (`openssl rand -base64 48`)                                      |
| `SMTP_HOST`                 | variable | provider's SMTP host (M5; nothing sends yet)                                        |
| `SMTP_PORT`                 | variable | provider's SMTP port, e.g. `587`                                                    |
| `SMTP_USER`                 | secret   | SMTP username (empty if none)                                                       |
| `SMTP_PASSWORD`             | secret   | SMTP password, no `'` characters                                                    |
| `MAIL_FROM`                 | variable | `Najme <no-reply@<domain>>`                                                         |
| `GOOGLE_CLIENT_IDS`         | variable | comma-separated Google OAuth client IDs (#58); must include the web client ID below |
| `STORAGE_ENDPOINT`          | variable | S3 API endpoint (Lightsail Object Storage in M7; placeholder OK until then)         |
| `STORAGE_REGION`            | variable | S3 region string (e.g. `us-east-1`)                                                 |
| `STORAGE_BUCKET`            | variable | bucket name                                                                         |
| `STORAGE_ACCESS_KEY_ID`     | secret   | S3 access key id                                                                    |
| `STORAGE_SECRET_ACCESS_KEY` | secret   | S3 secret; must not contain `'` (server `.env` is sourced by bash)                  |
| `STORAGE_PUBLIC_BASE_URL`   | variable | public origin used to build `logoUrl` / `coverUrl` / `photoUrl`                     |
| `STORAGE_FORCE_PATH_STYLE`  | variable | `true` for path-style MinIO/dev; typically `false` for Lightsail                    |

Until the Lightsail bucket exists (M7), any syntactically valid placeholders are fine: the API
constructs the S3 client lazily and `/health` does not touch storage.

### Build-time variables (image build)

These are **repository** Actions variables (Settings → Secrets and variables → Actions → Variables),
not secrets. They are passed as Docker build-args when `deploy.yml` builds images; changing a value
requires a rebuild (a new deploy that rebuilds the web image).

| Name                   | Type     | Value                                                                                                                                                       |
| ---------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_WEB_CLIENT_ID` | variable | Public web GIS OAuth client ID (#58/#145). Baked into the web image as `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`. Must also appear in runtime `GOOGLE_CLIENT_IDS`. |

Later features add more (OAuth, email, Telegram, Expo) — see
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

### Platform admin CLI

Grant or revoke `User.isPlatformAdmin` against the production database (unknown email exits
non-zero):

```bash
docker compose -f compose.prod.yml exec api \
  node scripts/admin-flag.mjs grant someone@example.com
docker compose -f compose.prod.yml exec api \
  node scripts/admin-flag.mjs revoke someone@example.com
```
