import type { ViteUserConfig } from 'vitest/config';

/** Shared Vitest base config (Node environment, deterministic mocks). */
export declare const baseConfig: ViteUserConfig;

/** Merges package-specific Vitest overrides on top of the shared base config. */
export declare function withBaseConfig(overrides: ViteUserConfig): ViteUserConfig;

export default baseConfig;
