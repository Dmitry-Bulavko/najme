# Build context is the repo root (see .github/workflows/deploy.yml): this Dockerfile needs the
# whole pnpm workspace to resolve @najme/* workspace dependencies.
#
#   docker build -f apps/web/Dockerfile --build-arg GIT_SHA=<sha> .

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
RUN corepack enable
WORKDIR /app

# --- Install & build ---------------------------------------------------------------------------
FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
# Builds @najme/web and every workspace package it depends on (packages/config, contracts, i18n,
# ui-tokens), producing apps/web/.next (standalone output) plus their dist/ folders that Next's
# file tracing copies into it.
RUN pnpm turbo run build --filter=...@najme/web

# --- Runtime -------------------------------------------------------------------------------------
FROM base AS runner
ARG GIT_SHA
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    GIT_SHA=${GIT_SHA}

# outputFileTracingRoot (next.config.ts) is the repo root, so the standalone bundle mirrors the
# monorepo layout (apps/web/server.js) with a single deduped node_modules at its root.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
USER nextjs

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
