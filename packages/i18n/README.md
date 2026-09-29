# @najme/i18n

Shared locale list, locale resolution and message catalogs used by `apps/api`, `apps/web` and
`apps/mobile`. See ADR-0004 and `docs/conventions/i18n.md`.

## What's exported

- `SUPPORTED_LOCALES` — `['en', 'me', 'ru', 'tr']`, `DEFAULT_LOCALE` — `'en'`, `Locale` — the union
  type, `isLocale(value)` — type guard.
- `LOCALE_META` — per-locale `{ label, bcp47 }` (`me` → `sr-Latn-ME`, label "Crnogorski / Srpski").
  `toIntlLocale(locale)` returns the `bcp47` tag for `Intl` APIs.
- `resolveLocale(candidates)` — picks the best supported locale from an ordered list of language
  preferences (explicit user choice first, then device/browser languages, per ADR-0004). Matches on
  the primary language subtag only, so `sr-Cyrl-RS`, `sr_ME`, `SR-RS` all resolve to `me`. Falls
  back to `en`.
- `parseAcceptLanguage(header)` — parses an `Accept-Language` header into tags ordered by
  descending `q`-value, ready to pass to `resolveLocale`.
- `catalogs` — `{ [locale]: { common: CommonMessages } }`, the ICU message catalogs. `CommonMessages`
  is the TypeScript shape inferred from the `en` catalog (the source of truth); `MessageKey` is the
  union of dot-separated leaf paths (e.g. `'actions.save'`) for typed key lookups.
- `catalogs[locale].emails` — subjects and bodies of transactional emails (verify email, reset
  password), rendered by `apps/api`. The API renders them with a small formatter that supports only
  this ICU subset: `{hours}` and `{hours, plural, one {…} few {…} other {…}}` (any CLDR categories,
  `#` = the number, no nesting or other arguments). Anything else needs a real ICU formatter first.
- `flattenMessages(tree)` — flattens a nested catalog into `{ 'a.b.c': 'message' }`, for consumers
  (e.g. i18next) that want flat keys, and used internally by the key-parity/ICU tests.

## Where catalogs live

`packages/i18n/src/catalogs/<locale>/<namespace>.json` — one JSON file per locale per namespace,
written in ICU message syntax. `en` is the source of truth: every other locale must have exactly
the same keys (enforced by a test). To add a namespace:

1. Create `src/catalogs/<locale>/<namespace>.json` for all four locales (`en` first).
2. Add the namespace to the `Namespaces` interface and the `catalogs` map in `src/messages.ts`.
3. Add/extend tests in `src/messages.test.ts` (key parity + ICU validity apply automatically once
   the namespace is wired into `catalogs`).

Catalogs are imported statically (`import common from './common.json' with { type: 'json' }`, as
required under `module: "NodeNext"`) so `tsup` inlines their content into
`dist/index.js`/`dist/index.cjs` — no separate JSON files ship in `dist`, and every bundler
(Next.js, Metro/Expo, Node) gets the same values without extra loader configuration.

## Build and consumption (CJS + ESM)

Same dual-build pattern as `@najme/contracts`: `tsup` builds `src/index.ts` into
`dist/index.js` (ESM + `dist/index.d.ts`) and `dist/index.cjs` (CJS + `dist/index.d.cts`);
`package.json#exports` picks the right pair via the `import`/`require` conditions. This package has
no Node- or DOM-specific APIs, so it works unmodified in the browser, Node and React Native.

```ts
import { resolveLocale, catalogs, toIntlLocale } from '@najme/i18n';

const locale = resolveLocale(['sr-RS', 'en']); // 'me'
catalogs[locale].common.appName; // 'Najme'
toIntlLocale(locale); // 'sr-Latn-ME'
```

`src/dual-module.test.ts` proves both entry points work against the built `dist/`, and that the
catalogs are inlined into the bundle rather than shipped as separate files.

## Developing this package

- `pnpm --filter @najme/i18n build` — builds `dist/` (ESM + CJS + type declarations).
- `pnpm --filter @najme/i18n lint` — lints with `@najme/config`'s ESLint preset.
- `pnpm --filter @najme/i18n typecheck` — type-checks `src/` with `@najme/config`'s Node preset.
- `pnpm --filter @najme/i18n test` — builds `dist/` (via `pretest`), then runs the Vitest suite.

## Translations to verify

`me`, `ru` and `tr` catalog strings are machine-quality; a native speaker should review them before
they ship in a user-facing surface.
