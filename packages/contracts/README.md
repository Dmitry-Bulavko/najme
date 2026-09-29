# @najme/contracts

Shared zod schemas and inferred TypeScript types for API requests and responses, consumed by
`apps/api`, `apps/web` and `apps/mobile`. See ADR-0002 and `docs/conventions/api.md`.

This package holds cross-cutting contracts and the M1 auth/user contracts. Further domain schemas
(businesses, bookings, …) live alongside the feature that introduces them,
under `packages/contracts/src/<domain>/`.

## What's exported

- `healthResponseSchema` / `HealthResponse` — `GET /api/v1/health` response.
- `apiErrorSchema` / `ApiError` and `apiErrorResponseSchema` / `ApiErrorResponse` — the
  `{ error: { code, message, details? } }` envelope used by every non-2xx response.
- `ERROR_CODES` / `ErrorCode` / `errorCodeSchema` — every known API error code (generic + auth);
  each has an `errors.<CODE>` message in `@najme/i18n`.
- `auth.ts` — `registerRequestSchema`, `loginRequestSchema`, `refreshRequestSchema` (mobile-only
  body token), `googleSignInRequestSchema`, `verifyEmailRequestSchema`,
  `forgotPasswordRequestSchema`, `resetPasswordRequestSchema`, `authSessionSchema` (each with an
  inferred type, e.g. `RegisterRequest`, `AuthSession`). Emails are trimmed and lowercased.
- `users.ts` — `meSchema` / `Me`, `updateProfileRequestSchema` (at least one field),
  `changePasswordRequestSchema`.
- `locale.ts` — `localeSchema` (`en|me|ru|tr`), kept in parity with `@najme/i18n` by a test
  (contracts has `@najme/i18n` as a devDependency only). `primitives.ts` — shared email, password
  and display-name schemas.
- `paginationQuerySchema` / `PaginationQuery` — `?limit=&cursor=` query params for list endpoints
  (`limit` coerces from the query string, 1–100, default 20).
- `paginated(itemSchema)` — wraps an item schema into `{ items: T[], nextCursor: string | null }`.
- `moneySchema` / `Money` and `currencySchema` — `{ amount: integer minor units, currency: ISO
4217 }`. `amount` may be negative (refunds/credits) or zero; endpoints that only accept a price
  add their own non-negative check. `currency` is validated by format (3 uppercase letters), not
  against the full ISO 4217 list.

## Build and consumption (CJS + ESM)

The package has no Node- or DOM-specific dependencies, so it builds once and is consumed the same
way by all three runtimes. `tsup` builds `src/index.ts` into:

| File             | Format                   | Consumed by                                   |
| ---------------- | ------------------------ | --------------------------------------------- |
| `dist/index.js`  | ESM + `dist/index.d.ts`  | Next.js, Expo (native ESM/`import`)           |
| `dist/index.cjs` | CJS + `dist/index.d.cts` | NestJS (compiles to CommonJS, uses `require`) |

`package.json#exports` picks the right pair via the `import`/`require` conditions, so every
consumer just does:

```ts
import { healthResponseSchema } from '@najme/contracts';
```

This avoids forcing the API onto an ESM-only Nest setup while still giving web and mobile native
ESM. See the "Update (2026-09-28)" note in ADR-0002 for the rationale.

`src/dual-module.test.ts` proves both entry points work: it `require()`s the built `dist/index.cjs`
via `node:module`'s `createRequire` and `import()`s the built `dist/index.js`, asserting schemas
from each still parse correctly. It runs against `dist/`, not the TypeScript sources, so the
`pretest` script builds the package first.

## Developing this package

- `pnpm --filter @najme/contracts build` — builds `dist/` (ESM + CJS + type declarations).
- `pnpm --filter @najme/contracts lint` — lints with `@najme/config`'s ESLint preset.
- `pnpm --filter @najme/contracts typecheck` — type-checks `src/` with `@najme/config`'s Node
  preset.
- `pnpm --filter @najme/contracts test` — builds `dist/` (via `pretest`), then runs the Vitest
  suite.
