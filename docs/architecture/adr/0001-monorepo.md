# ADR-0001: pnpm workspaces + Turborepo monorepo

- Status: Accepted
- Date: 2026-09-28

## Context

We ship an API, a web app and a mobile app that share types, translations and design tokens. Work is
done mostly by AI agents, which benefit from a single repository with one set of commands.

## Decision

- One repository, **pnpm workspaces** (`apps/*`, `packages/*`), pnpm version pinned through
  `packageManager` in the root `package.json`.
- **Turborepo** runs `build`, `lint`, `typecheck`, `test`, `dev` across packages with caching and
  `--filter` scoping. Root `pnpm check` is exactly what CI runs.
- Internal packages are named `@najme/<name>` and referenced with `workspace:*`.
- Internal packages are consumed as TypeScript source where the consumer's toolchain supports it
  (Next.js `transpilePackages`, Metro); otherwise they build to `dist/` with `tsc`/`tsup`.
- Node version: `.nvmrc` (24 LTS) for CI and Docker images; `engines.node >= 22` for local dev.
- Prettier at the root formats everything; ESLint config lives in `packages/config`.

## Consequences

- One `pnpm install`, one lockfile, one CI pipeline.
- Expo requires care with hoisting and React versions; the mobile app pins its own React/React
  Native versions as dictated by the Expo SDK. Web may use a different React version only if pnpm
  isolation keeps them apart — verify when scaffolding.
