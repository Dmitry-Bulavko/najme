// @ts-check
import { defineConfig, mergeConfig } from 'vitest/config';

/**
 * Shared Vitest base config for Najme packages and apps.
 *
 * Consumers create a `vitest.config.ts` with:
 *
 * ```ts
 * import { baseConfig } from '@najme/config/vitest';
 *
 * export default baseConfig;
 * ```
 *
 * or merge in overrides with `withBaseConfig({ ... })`.
 */
export const baseConfig = defineConfig({
  test: {
    environment: 'node',
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
});

/**
 * Merges package-specific Vitest overrides on top of the shared base config.
 *
 * @param {import('vitest/config').ViteUserConfig} overrides
 */
export function withBaseConfig(overrides) {
  return mergeConfig(baseConfig, defineConfig(overrides));
}

export default baseConfig;
