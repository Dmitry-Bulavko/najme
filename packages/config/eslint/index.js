// @ts-check
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Shared ESLint flat config for Najme packages and apps.
 *
 * Consumers create an `eslint.config.js` with:
 *
 * ```js
 * import config from '@najme/config/eslint';
 *
 * export default config;
 * ```
 *
 * and append their own overrides (e.g. React/Next.js/Expo plugins) as additional array entries.
 */
export const baseConfig = tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      '.turbo/**',
      '.next/**',
      'node_modules/**',
      // Short-lived files tsup (bundle-require) and Vite write next to their configs while loading
      // them; a parallel `eslint .` can glob one and then fail to read it once it is deleted.
      '**/*.bundled_*.{js,mjs,cjs}',
      '**/*.timestamp-*.{js,mjs,cjs}',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Must stay last: turns off stylistic rules that conflict with Prettier.
  eslintConfigPrettier,
);

export default baseConfig;
