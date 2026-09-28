# @najme/config

Shared TypeScript, ESLint and Vitest defaults for every Najme app and package. Consume these
instead of hand-rolling per-package tooling config.

## TypeScript

Three presets under `tsconfig/`, all strict (`strict`, `noUncheckedIndexedAccess`,
`isolatedModules`, `verbatimModuleSyntax`):

| Preset                | Use for                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `tsconfig/base.json`  | Shared defaults; extended by the other two presets.                  |
| `tsconfig/node.json`  | Node.js libraries and services (e.g. `apps/api`, most `packages/*`). |
| `tsconfig/react.json` | React/DOM code without a framework-specific preset.                  |

Next.js and Expo get their own presets from `@najme/config` when those apps are scaffolded; until
then, use `tsconfig/react.json` for React/DOM packages.

A consumer's `tsconfig.json`:

```json
{
  "extends": "@najme/config/tsconfig/node.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

## ESLint

`eslint/index.js` exports a flat config (`typescript-eslint` recommended rules +
`eslint-config-prettier` to defer style to Prettier). A consumer's `eslint.config.js`:

```js
import config from '@najme/config/eslint';

export default config;
```

To add package-specific rules or plugins (e.g. React, Next.js), spread the base config and append
more entries:

```js
import config from '@najme/config/eslint';

export default [...config, { rules: { 'no-console': 'warn' } }];
```

## Vitest

`vitest/index.js` exports a Node-environment base config with deterministic mocks
(`clearMocks`/`restoreMocks`). A consumer's `vitest.config.ts`:

```ts
import { baseConfig } from '@najme/config/vitest';

export default baseConfig;
```

To override or extend settings, use `withBaseConfig`:

```ts
import { withBaseConfig } from '@najme/config/vitest';

export default withBaseConfig({
  test: { environment: 'jsdom' },
});
```

## Types

The `eslint` and `vitest` entries ship hand-written declarations (`types/*.d.ts`, wired through
`types` conditions in `package.json#exports`), so TypeScript config files such as `vitest.config.ts`
typecheck without excluding them from `tsc`. Keep the declarations in sync when changing the
exports of `eslint/index.js` or `vitest/index.js`; `src/types.test.ts` imports them through the
public entries as a self-check.

## Developing this package

- `pnpm --filter @najme/config lint` — lints this package with its own exported ESLint config.
- `pnpm --filter @najme/config typecheck` — type-checks `src/` with `tsconfig/node.json`.
- `pnpm --filter @najme/config test` — runs the Vitest suite that asserts the exported presets keep
  their key settings.
