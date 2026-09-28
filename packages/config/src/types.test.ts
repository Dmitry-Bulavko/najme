import type { Linter } from 'eslint';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ViteUserConfig } from 'vitest/config';

import eslintConfig, { baseConfig as eslintBaseConfig } from '@najme/config/eslint';
import vitestConfig, { baseConfig as vitestBaseConfig, withBaseConfig } from '@najme/config/vitest';

// Imports go through the public package entries so the shipped `.d.ts` files are typechecked.
describe('published type declarations', () => {
  it('eslint entry exposes exactly Linter.Config[]', () => {
    expectTypeOf(eslintConfig).toEqualTypeOf<Linter.Config[]>();
    expectTypeOf(eslintBaseConfig).toEqualTypeOf<Linter.Config[]>();
    expect(eslintConfig).toBe(eslintBaseConfig);
  });

  it('vitest entry exposes exactly ViteUserConfig and a typed withBaseConfig', () => {
    expectTypeOf(vitestConfig).toEqualTypeOf<ViteUserConfig>();
    expectTypeOf(vitestBaseConfig).toEqualTypeOf<ViteUserConfig>();
    expectTypeOf(withBaseConfig).toEqualTypeOf<(overrides: ViteUserConfig) => ViteUserConfig>();

    const merged = withBaseConfig({ test: { environment: 'jsdom' } });
    expect(vitestConfig).toBe(vitestBaseConfig);
    expect(merged.test?.environment).toBe('jsdom');
    expect(merged.test?.clearMocks).toBe(true);
  });
});
