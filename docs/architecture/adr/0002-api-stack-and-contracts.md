# ADR-0002: API stack and shared contracts

- Status: Accepted
- Date: 2026-09-28

## Context

We need a typed, well-structured backend that agents can extend module by module, and a way to keep
API shapes in sync across api, web and mobile without hand-written duplicate types.

## Decision

- **NestJS** (latest stable) with a module per bounded context: `auth`, `users`, `businesses`,
  `staff`, `services`, `scheduling`, `bookings`, `catalog`, `notifications`, `admin`, `health`.
- **Prisma** (latest stable) as ORM and migration tool; **PostgreSQL 17**. Raw SQL is allowed in
  migrations for things Prisma cannot express (e.g. exclusion constraints, see ADR-0005).
- **REST under `/api/v1`**, JSON, conventions in `docs/conventions/api.md`.
- **Contracts:** every request/response schema is a zod schema in `packages/contracts`, exported with
  its inferred type. The API validates input with these schemas (e.g. via `nestjs-zod` or a small
  `ZodValidationPipe`) and generates OpenAPI from them. Web and mobile import the same types.
- **Auth:** short-lived JWT access token + rotating refresh token (stored hashed in DB); passwords
  hashed with argon2id. Social login: Google (web + mobile), Apple (iOS). Details are decided in the
  M1 tasks.
- **Config:** env vars validated at startup with a zod schema; the app refuses to start on invalid
  config.
- **Errors:** a global exception filter maps errors to the error envelope defined in contracts.

## Consequences

- Changing an endpoint means changing `packages/contracts` first; type errors then show every
  consumer that must be updated.
- Prisma models are internal to the API; never expose Prisma types to clients — map to contract
  types.

## Update (2026-09-28): `@najme/contracts` build

`packages/contracts` is runtime-agnostic (no Node/DOM APIs) and built with `tsup` into dual ESM +
CJS output (`dist/index.js` / `dist/index.cjs`) plus type declarations per module format
(`dist/index.d.ts` / `dist/index.d.cts`), selected via `package.json#exports` conditions. This lets
NestJS (which compiles to CommonJS) `require()` the package and Next.js/Expo `import` it from the
same published output, without the API needing an ESM-only Nest setup. See
`packages/contracts/README.md` for details.

## Update (2026-09-28): `apps/api` is ESM

`apps/api` ships as `"type": "module"` (ESM), not the CommonJS Nest app assumed above. TypeScript 6's
`verbatimModuleSyntax` — hardcoded by `@najme/config`'s shared `tsconfig/node.json`, which also
hardcodes `module`/`moduleResolution: NodeNext` — rejects `import`/`export` syntax in any file that
resolves as CommonJS, so a CJS Nest app fails to typecheck under the shared preset. Node 24 runs
ESM Nest apps natively, so switching `apps/api` to real ESM was the smallest fix that does not weaken
`verbatimModuleSyntax` repo-wide. Consequences: `apps/api` imports `@najme/contracts` through its
`import` condition directly (no `require()`), and all relative imports use explicit `.js`
extensions as `NodeNext` requires. `@najme/contracts`' CJS build is unaffected and remains in place
for consumers that still need `require()` (future CJS bundlers).
