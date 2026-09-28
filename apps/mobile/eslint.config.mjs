import { baseConfig } from '@najme/config/eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// `eslint-config-expo` and `eslint-plugin-react` do not yet support ESLint 10's flat config /
// scope-manager API (see docs/specs/14-web-scaffold.md's implementation notes for the same issue
// in apps/web), so this composes `@najme/config`'s shared TypeScript rules with
// `eslint-plugin-react-hooks`'s flat `recommended-latest` config directly.
export default [
  ...baseConfig,
  reactHooks.configs.flat['recommended-latest'],
  {
    // Metro config is loaded by Node directly (CommonJS), not bundled with the app.
    files: ['metro.config.js'],
    languageOptions: {
      globals: { require: 'readonly', module: 'writable', __dirname: 'readonly' },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  { ignores: ['.expo/**', 'dist/**'] },
];
