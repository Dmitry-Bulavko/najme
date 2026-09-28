import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

/**
 * Proves the built package can be consumed both ways: NestJS/Node tooling (CommonJS, via
 * `require`) and Next.js/Expo (ESM, via `import`). Runs against the `dist/` output produced by
 * `tsup` (see the `pretest` script), not against the TypeScript sources.
 */
describe('dist dual-module output', () => {
  it('can be required as CommonJS', () => {
    const require = createRequire(import.meta.url);
    const cjs = require('../dist/index.cjs') as typeof import('../dist/index.js');

    expect(cjs.colors.primary).toBe('#526ED3');
    expect(cjs.radius.md).toBe(12);
    expect(cjs.tokens.spacing.md).toBe(12);
  });

  it('can be imported as ESM', async () => {
    const esm = await import('../dist/index.js');

    expect(esm.typography.fontFamily).toBe('Manrope');
    expect(esm.generateThemeCss()).toContain('--color-primary: #526ED3;');
  });
});
