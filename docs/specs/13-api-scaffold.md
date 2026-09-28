# #13 — Scaffold NestJS API app with Prisma, health endpoint and Docker image

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/13
- Status: Implemented
- Related: ADR-0002, ADR-0005, ADR-0007, `docs/conventions/api.md`, `docs/conventions/testing.md`

## Goal

Scaffold `@najme/api` (NestJS + Prisma + PostgreSQL) with a global `/api/v1` prefix, a real
`GET /api/v1/health` backed by a DB check, zod-validated env config, the ApiError envelope, OpenAPI
docs outside production, and a production Docker image matching `infra/compose.prod.yml`.

## Approach

- NestJS 12 (latest stable within pnpm's release-age policy), Express platform.
- Prisma 7: the datasource `url` moved out of `schema.prisma` into `prisma.config.ts` (Prisma 7
  requirement); `PrismaService` wraps the generated client with the `@prisma/adapter-pg` driver
  adapter.
- The app is an ESM package (`"type": "module"`, `tsconfig` extends `@najme/config`'s `node.json`
  which sets `module`/`moduleResolution` to `NodeNext`). TypeScript 6's `verbatimModuleSyntax`
  rejects `import`/`export` syntax in files resolved as CommonJS, so a plain CJS Nest app (the
  originally assumed layout, per ADR-0002) no longer typechecks under the shared preset — ESM is the
  only option compatible with `@najme/config` without weakening `verbatimModuleSyntax` repo-wide.
  `@najme/contracts`' CJS build is unaffected: it is only needed by the (future) CJS Next.js/Expo
  bundlers, and ESM code imports `@najme/contracts` via its `import` condition directly.
- Validation pipe: a small `ZodValidationPipe` (no `nestjs-zod`, whose peer range does not yet cover
  Nest 12).
- Global `ApiExceptionFilter` maps `HttpException`s (and anything else) to the `ApiError` envelope
  from `@najme/contracts`.
- Test runner: Vitest, with `unplugin-swc` for decorator metadata (Nest's documented Vitest recipe)
  and a separate `vitest-e2e.config.ts` for supertest e2e tests against the real Postgres from
  `DATABASE_URL`.
- ID strategy: UUID v7, recorded in `docs/conventions/api.md` (Postgres `gen_random_uuid()` is v4;
  v7 IDs are generated application-side once domain models exist — no dependency added yet since
  there are no models in this task).

## Changes

| Area / path                             | Change                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/api/**`                           | New NestJS app: health module, Prisma module/service, config, common (filter, pipe) |
| `apps/api/prisma/**`                    | Prisma schema, baseline migration (`btree_gist` extension, ADR-0005)                |
| `apps/api/Dockerfile`                   | Multi-stage, `turbo prune`-based, Node 24, non-root user                            |
| `compose.dev.yml`                       | New: `postgres:17` for local dev                                                    |
| `.env.example`, `apps/api/.env.example` | New: local dev env values                                                           |
| `pnpm-workspace.yaml`                   | `allowBuilds` for `prisma`/`@prisma/engines`/`@swc/core`                            |
| `docs/conventions/api.md`               | ID strategy decision                                                                |
| `docs/runbooks/local-dev.md`            | API-specific local dev steps                                                        |

### Contracts / API

No new contracts; consumes the existing `HealthResponse` and `ApiError`/`ApiErrorResponse` from
`@najme/contracts`.

### Data model

No domain models (out of scope). One baseline migration enables `btree_gist` for future exclusion
constraints (ADR-0005).

### UI and i18n

None — API only, no user-facing strings.

## Test plan

- Unit: `src/health/health.service.spec.ts` — db ok / db error / GIT_SHA fallback.
- e2e: `test/health.e2e-spec.ts` — real Postgres, asserts 200 + `HealthResponse` shape, and a second
  suite that overrides `PrismaService` to simulate an outage and asserts 503 with `db: "error"`.
- Manual: built and ran `dist/main.js` locally against the local Postgres; confirmed JSON logs,
  `GET /api/v1/health` (200) and `GET /api/v1/docs` (200, non-production only).

## Risks and open questions

- The Dockerfile could not be built locally (no Docker daemon available in this environment); it was
  reviewed against `turbo prune --docker` and Node 24 conventions but not executed. Validate it as
  part of #16 (smoke-test task) or the deploy workflow.

## Implementation notes

- Root cause of the CJS-vs-ESM decision: TypeScript 6's stricter `verbatimModuleSyntax` (TS1295)
  rejects ESM `import`/`export` syntax in a file whose module format resolves to CommonJS. Since
  `@najme/config`'s shared `tsconfig/node.json` hardcodes `module`/`moduleResolution: NodeNext` and
  `verbatimModuleSyntax: true`, making `apps/api` CommonJS (`"type": "commonjs"` or classic
  `module: "commonjs"`) fails to typecheck. Switching the app to `"type": "module"` (real ESM,
  Node 24 native support) resolves it without touching the shared preset. All relative imports use
  explicit `.js` extensions as `NodeNext` requires.
- Prisma 7 dropped `datasource.url` from `schema.prisma`; the connection string lives in
  `prisma.config.ts` for the CLI, and `PrismaService` passes a `@prisma/adapter-pg` driver adapter to
  the generated client's constructor. The generated client's `package.json` declares
  `@prisma/client-runtime-utils` as a dependency, which had to be added explicitly to `apps/api`'s
  own `package.json` too — pnpm does not hoist it for a non-workspace, generated-at-build-time
  package.
