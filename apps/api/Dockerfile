# Multi-stage, workspace-aware image for @najme/api (ADR-0007). Build context is the repo root:
#   docker build -f apps/api/Dockerfile --build-arg GIT_SHA=<sha> .
# Contract with infra/compose.prod.yml: listens on 3000, serves GET /api/v1/health, and its
# package.json has an `npm run db:migrate:deploy` script for the `migrate` service.

FROM node:24-slim AS base
RUN corepack enable
WORKDIR /app

# --- Prune the workspace to only what @najme/api needs (source + lockfile), keeping the image and
# --- the Docker layer cache small.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo prune @najme/api --docker

# --- Install dependencies for the pruned workspace.
FROM base AS deps
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

# --- Build the API and its workspace dependencies (@najme/contracts, @najme/config).
FROM deps AS build
COPY --from=pruner /app/out/full/ .
ARG GIT_SHA=dev
ENV GIT_SHA=${GIT_SHA}
# A real DATABASE_URL is not needed to generate the Prisma client or compile TypeScript.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build?schema=public
RUN pnpm turbo run build --filter=@najme/api...

# --- Production-only dependencies, installed fresh from the pruned workspace (no devDependencies:
# --- neither the pruned lockfile nor the pruned `apps/api/package.json` list them). `prisma` and
# --- `dotenv` are runtime dependencies of `@najme/api` (needed by `db:migrate:deploy` and
# --- `prisma.config.ts`), so this stage's node_modules has everything the runtime needs.
FROM base AS prod-deps
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --prod --frozen-lockfile

# --- Runtime image: only production dependencies, compiled output, Prisma schema/migrations and
# --- the generated Prisma client, run as a non-root user.
FROM node:24-slim AS runtime
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ARG GIT_SHA=dev
ENV GIT_SHA=${GIT_SHA}

COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/generated ./apps/api/generated
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
# prod-deps only installs manifests (out/json), so its pnpm workspace symlinks (e.g.
# node_modules/@najme/contracts -> ../../packages/contracts) point at directories that have a
# package.json but no built output. For every workspace package @najme/api imports at runtime
# (currently only @najme/contracts; @najme/config is dev-only), copy its package.json, its built
# dist/ (from the build stage) and its own node_modules (from prod-deps): the package's own
# node_modules holds pnpm symlinks for its runtime dependencies (e.g. packages/contracts depends
# on zod) that resolve into the already-copied /app/node_modules/.pnpm store — without it, imports
# from within the workspace package's dist/ fail with "Cannot find package 'zod'".
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=prod-deps /app/packages/contracts/node_modules ./packages/contracts/node_modules

WORKDIR /app/apps/api
RUN groupadd --system najme && useradd --system --gid najme --home /app najme \
  && chown -R najme:najme /app
USER najme

EXPOSE 3000
CMD ["node", "dist/main.js"]
