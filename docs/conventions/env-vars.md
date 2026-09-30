# Environment variables and secrets

## Adding a variable — checklist

When code starts reading a new env var, the same PR must:

1. Add it to the app's config schema (zod) so startup fails if it is missing or invalid.
2. Add it with a safe local default or placeholder to the root `.env.example` (and the app's
   `.env.example` if it has one).
3. If production needs it:
   - add it to the `.env` assembly step in `.github/workflows/deploy.yml`
     (`${{ secrets.X }}` for secrets, `${{ vars.X }}` for non-secret values);
   - add it to the table below and to `docs/runbooks/deploy.md` so a human creates it in the GitHub
     `production` environment;
   - label the issue/PR with `status:needs-human` until the human confirms it exists.
4. Client-exposed vars (`NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`) must never contain secrets.

## Never

- Commit real secrets, `.env` files, keystores or service-account files (`.gitignore` covers the
  common ones).
- Print secrets in logs or CI output.

## Local development

In development the API and web read the repo-root `.env` (copy of `.env.example`); shell variables
win. `.env.example` sets `API_INTERNAL_URL=http://localhost:3000/api/v1`; it is optional — when
unset, the web API badge falls back to `PUBLIC_URL` + `/api/v1` (`apps/web/src/lib/health.ts`).
Mobile uses `EXPO_PUBLIC_API_URL` (root `.env` or `apps/mobile/.env.local`). Turbo strict env
mode: declare every variable a task reads in that app's `turbo.json`.

## Production variables

| Name                               | Kind   | Used by       | Purpose                                                                                            |
| ---------------------------------- | ------ | ------------- | -------------------------------------------------------------------------------------------------- |
| `DOMAIN`                           | var    | caddy, web    | Public hostname, e.g. `najme.dzmitry-bulauka.com`                                                  |
| `API_INTERNAL_URL`                 | var    | web           | Internal API base URL for server-side calls (`http://api:3000/api/v1` in `infra/compose.prod.yml`) |
| `PUBLIC_URL`                       | var    | web, api      | Public origin (`https://${DOMAIN}`), set in `infra/compose.prod.yml`                               |
| `POSTGRES_PASSWORD`                | secret | postgres, api | Database password                                                                                  |
| `JWT_ACCESS_SECRET`                | secret | api           | HS256 key signing access tokens, min 32 chars (`openssl rand -base64 48`, ADR-0010)                |
| `SMTP_HOST`                        | var    | api           | SMTP relay host of the email provider (chosen in M5, Q1)                                           |
| `SMTP_PORT`                        | var    | api           | SMTP relay port (465 = implicit TLS, otherwise STARTTLS when offered)                              |
| `SMTP_USER`                        | secret | api           | SMTP username; leave empty for an unauthenticated relay (set together with the password)           |
| `SMTP_PASSWORD`                    | secret | api           | SMTP password; must not contain `'` (the server `.env` is sourced by bash)                         |
| `MAIL_FROM`                        | var    | api           | Sender, e.g. `Najme <no-reply@najme.example>`; the domain needs SPF/DKIM at the provider           |
| `GOOGLE_CLIENT_IDS`                | var    | api           | Comma-separated public Google OAuth client IDs (web/iOS/Android); unset disables Google sign-in    |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`     | var    | web           | Public GIS web client ID (must be listed in `GOOGLE_CLIENT_IDS`); unset hides the Google button    |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | var    | mobile        | Public iOS Google OAuth client ID; unset hides the mobile Google button (#55, #58)                 |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | var    | mobile        | Public web Google OAuth client ID (used as `webClientId` for ID tokens on Android/iOS)             |
| `APP_WEB_URL`                      | var    | api           | Origin for links in emails; set to `https://${DOMAIN}` in `infra/compose.prod.yml`                 |
| `LIGHTSAIL_HOST`                   | secret | deploy        | Server IP / hostname for SSH                                                                       |
| `LIGHTSAIL_USER`                   | secret | deploy        | SSH user (`deploy`)                                                                                |
| `LIGHTSAIL_SSH_KEY`                | secret | deploy        | Private key for the deploy user                                                                    |
| `LIGHTSAIL_KNOWN_HOSTS`            | secret | deploy        | `ssh-keyscan` output for host key verification                                                     |
| `GHCR_READ_TOKEN`                  | secret | deploy        | PAT with `read:packages` so the server can pull images                                             |

Optional, not set in production: `AUTH_COOKIE_SECURE` (api) overrides the `Secure` flag of the
refresh cookie, which defaults to on unless `NODE_ENV=development`.

Add rows as features introduce variables (JWT secrets, OAuth client IDs, email provider keys,
Telegram bot token, Expo access token…).
