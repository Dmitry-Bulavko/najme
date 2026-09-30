import { baseConfig } from '@najme/config/eslint';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

// `eslint-config-next` (and the `eslint-plugin-react` it bundles) is not yet compatible with
// ESLint 10 (see docs/specs/14-web-scaffold.md's implementation notes), so this composes the same
// rule sets directly: @next/eslint-plugin-next's flat `core-web-vitals` config (a superset of
// `recommended`) plus eslint-plugin-react-hooks's flat `recommended`, both of which declare
// `eslint@^10` support.
export default [
  ...baseConfig,
  nextPlugin.configs['core-web-vitals'],
  reactHooks.configs.flat['recommended-latest'],
  {
    ignores: [
      '.next/**',
      'e2e/**',
      'playwright-report/**',
      'test-results/**',
      'playwright.config.ts',
    ],
  },
];
