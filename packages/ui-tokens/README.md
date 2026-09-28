# @najme/ui-tokens

Shared design tokens (colors, radius, spacing, typography) used by `apps/web` and `apps/mobile`.
See ADR-0003: tokens are shared, UI components are not.

## What's exported

- `colors` — brand palette (`primary #526ED3`, `secondary`, `accent`, `text01`/`text02`/`text03`,
  `base01`/`base04`, `background`) plus `success`/`warning`/`danger`/`info` and their `*Foreground`
  pairs, tuned to meet WCAG AA contrast (>= 4.5:1) as background/foreground pairs.
- `radius` — `sm 8`, `md 12`, `lg 16`, `xl 20`, `full 9999`.
- `spacing` — `xs 4` … `xxxxl 48` (4, 8, 12, 16, 20, 24, 32, 40, 48).
- `typography` — `fontFamily` ("Manrope"), `fontWeight` (`medium 500`, `bold 700`, `extrabold 800`)
  and `scale`, a type scale from `caption` to `display`, each with `fontSize`, `lineHeight` and a
  default `fontWeight`.
- `tokens` — all of the above combined into one plain object. Every value is a plain string or
  number (no CSS-only syntax beyond the `rgba()` string on `text03`), so `tokens` can be used
  directly to build a React Native `StyleSheet` value map, e.g.
  `StyleSheet.create({ card: { borderRadius: tokens.radius.md, padding: tokens.spacing.md } })`.
- `generateThemeCss()` — generates the CSS in `dist/theme.css` (see below) from the token source of
  truth. Exported mainly for tests; consumers should use the generated file instead of calling it.

## CSS custom properties (web)

`dist/theme.css`, published as `@najme/ui-tokens/theme.css`, contains a Tailwind v4
[`@theme`](https://tailwindcss.com/docs/theme) block with one CSS custom property per token (e.g.
`--color-primary`, `--radius-md`, `--spacing-md`, `--font-size-body`).

**Source of truth:** `dist/theme.css` is **generated at build time** (via a `tsup` `onSuccess`
hook, see `tsup.config.ts`) from the same `src/colors.ts` / `radius.ts` / `spacing.ts` /
`typography.ts` modules that back the TypeScript exports, and it is **not committed** to the repo —
it only exists in `dist/`, produced fresh on every `build`/`pretest` run. This makes drift between
the CSS file and the TypeScript tokens structurally impossible: there is no checked-in copy to go
stale. `src/generate-theme-css.test.ts` additionally asserts every token from `src/` is present in
the generated CSS.

In `apps/web`:

```css
@import '@najme/ui-tokens/theme.css';
```

## Accessibility

`src/contrast.ts` implements the WCAG relative-luminance/contrast-ratio formulas (compositing
translucent colors, like `text03`, over a background before measuring, since WCAG contrast is only
defined for opaque colors). `src/contrast.test.ts` asserts AA (>= 4.5:1) for:

- `text01`, `text02` and `text03` (composited) on `background`, and `text02` on `secondary`, for
  body text;
- `primaryForeground` (white) on `primary` and `primaryHover`, for primary button labels;
- each `success`/`warning`/`danger`/`info` background with its paired `*Foreground` text color;
- `secondaryForeground` on `secondary`.

`text03` is intentionally translucent (`rgba(27, 31, 59, 0.65)`) for a "muted text" feel; it passes
AA only when composited over `background` specifically. Do not use `text03` for body text on any
other surface (e.g. `secondary`) without re-checking contrast.

## Build and consumption (CJS + ESM)

Same dual-build pattern as `@najme/contracts` and `@najme/i18n`: `tsup` builds `src/index.ts` into
`dist/index.js` (ESM + `dist/index.d.ts`) and `dist/index.cjs` (CJS + `dist/index.d.cts`);
`package.json#exports` picks the right pair via the `import`/`require` conditions. `dist/theme.css`
is generated as an extra build artifact (see above) and exported as `@najme/ui-tokens/theme.css`.

```ts
import { colors, radius, spacing, tokens, typography } from '@najme/ui-tokens';

tokens.colors.primary; // '#526ED3'
```

```css
/* apps/web/src/app/globals.css */
@import '@najme/ui-tokens/theme.css';
```

```ts
// apps/mobile
import { StyleSheet } from 'react-native';
import { tokens } from '@najme/ui-tokens';

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    backgroundColor: tokens.colors.base01,
  },
});
```

`src/dual-module.test.ts` proves both entry points work against the built `dist/`.

## Developing this package

- `pnpm --filter @najme/ui-tokens build` — builds `dist/` (ESM + CJS + type declarations +
  `theme.css`).
- `pnpm --filter @najme/ui-tokens lint` — lints with `@najme/config`'s ESLint preset.
- `pnpm --filter @najme/ui-tokens typecheck` — type-checks `src/` with `@najme/config`'s Node
  preset.
- `pnpm --filter @najme/ui-tokens test` — builds `dist/` (via `pretest`), then runs the Vitest
  suite.

## Out of scope (this package)

Dark mode and shared UI components (see ADR-0003 — components are not shared between web and
mobile).
