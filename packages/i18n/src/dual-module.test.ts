import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

/**
 * Proves the built package can be consumed both ways: CJS via `require` and ESM via `import`.
 * Runs against the `dist/` output produced by `tsup`, not against the TypeScript sources. Also
 * confirms the message catalogs are inlined into `dist/` rather than shipped as separate JSON
 * files. Turbo's `test` task for this package depends on `build` and `^build`; a plain
 * `pnpm --filter @najme/i18n test` does not rebuild `dist`.
 */
describe('dist dual-module output', () => {
  it('can be required as CommonJS', () => {
    const require = createRequire(import.meta.url);
    const cjs = require('../dist/index.cjs') as typeof import('../dist/index.js');

    expect(cjs.resolveLocale(['sr-RS'])).toBe('me');
    expect(cjs.catalogs.en.common.appName).toBe('Najme');
  });

  it('can be imported as ESM', async () => {
    const esm = await import('../dist/index.js');

    expect(esm.resolveLocale(['tr'])).toBe('tr');
    expect(esm.toIntlLocale('me')).toBe('sr-Latn-ME');
    expect(esm.catalogs.ru.common.appName).toBe('Najme');
  });
});
