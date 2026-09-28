import { describe, expect, it } from 'vitest';

import eslintConfig, { baseConfig as eslintBaseConfig } from '@najme/config/eslint';
import vitestConfig, { baseConfig as vitestBaseConfig, withBaseConfig } from '@najme/config/vitest';

// Imports go through the public package entries so the shipped `.d.ts` files are typechecked.
describe('published type declarations', () => {
  it('eslint entry resolves with typed exports', () => {
    const config: unknown[] = eslintConfig;
    expect(config).toBe(eslintBaseConfig);
  });

  it('vitest entry resolves with typed exports', () => {
    const merged = withBaseConfig({ test: { environment: 'jsdom' } });
    expect(vitestConfig).toBe(vitestBaseConfig);
    expect(merged.test?.environment).toBe('jsdom');
    expect(merged.test?.clearMocks).toBe(true);
  });
});
