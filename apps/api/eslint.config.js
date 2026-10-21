import config from '@najme/config/eslint';

export default [
  { ignores: ['generated/**', 'scripts/storage-init.mjs', 'scripts/admin-flag.mjs'] },
  ...config,
  {
    rules: {
      // NestJS decorators commonly need empty constructors/classes and parameter properties.
      '@typescript-eslint/no-useless-constructor': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
