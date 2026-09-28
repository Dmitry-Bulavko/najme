# @najme/web

Next.js (App Router) public site and business dashboard. See ADR-0002 and ADR-0007.

## Run

```bash
pnpm install                      # from the repo root
cp .env.example .env              # from the repo root
pnpm dev                          # API :3000 + web :3001
pnpm --filter @najme/web dev      # web only (needs the API for the status badge)
```

Open http://localhost:3001/en. `scripts/dev.mjs` loads the repo-root `.env` (dev only) and starts
`next dev` on `WEB_PORT` (default 3001). `next build` / `next start` and the Docker image do not read
an env file.

## Environment variables

| Name               | Purpose                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `WEB_PORT`         | Dev server port (default 3001)                                                                                                               |
| `API_INTERNAL_URL` | Optional in dev. API base URL for server-side calls, e.g. `http://localhost:3000/api/v1`; when unset the badge uses `PUBLIC_URL` + `/api/v1` |
| `PUBLIC_URL`       | Public origin; fallback for the API health check                                                                                             |
| `GIT_SHA`          | Build/version label                                                                                                                          |

In dev, `/api/*` is proxied to `http://localhost:3000` (mirrors Caddy routing).

## Scripts

`dev`, `build`, `start`, `lint`, `typecheck`, `test` (Vitest + Testing Library).
