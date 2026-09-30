import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

/**
 * Proves the built package can be consumed both ways: CJS via `require` and ESM via `import`.
 * Runs against the `dist/` output produced by `tsup`, not against the TypeScript sources.
 * Turbo's `test` task for this package depends on `build` and `^build`; a plain
 * `pnpm --filter @najme/contracts test` does not rebuild `dist`.
 */
describe('dist dual-module output', () => {
  it('can be required as CommonJS', () => {
    const require = createRequire(import.meta.url);
    const cjs = require('../dist/index.cjs') as typeof import('../dist/index.js');

    expect(
      cjs.healthResponseSchema.safeParse({ status: 'ok', db: 'ok', version: 'abc' }).success,
    ).toBe(true);
    expect(cjs.moneySchema.safeParse({ amount: 100, currency: 'EUR' }).success).toBe(true);
  });

  it('can be imported as ESM', async () => {
    const esm = await import('../dist/index.js');

    expect(esm.apiErrorSchema.safeParse({ code: 'SLOT_TAKEN', message: 'oops' }).success).toBe(
      true,
    );
    expect(esm.paginationQuerySchema.safeParse({ limit: '20' }).success).toBe(true);
  });
});
