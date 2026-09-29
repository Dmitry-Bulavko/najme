# @najme/ui-tokens

Shared design tokens (colors, radius, spacing, typography) used by `apps/web` and `apps/mobile`.
See ADR-0003: tokens are shared, UI components are not.

## What's exported

- `colors` — brand palette (`primary #526ED3`, `secondary`, `accent`, `text01`/`text02`/`text03`,
  `base01`/`base04`, `background`) plus `success`/`warning`/`danger`/`info` and their `*Foreground`
  pairs, tuned to meet WCAG AA contrast (>= 4.5:1) as background/foreground pairs.
- `radius` — `sm 8`, `md 12`, `lg 16`, `xl 20`, `full 9999`.
- `spacing` — `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 20`, `2xl 24`, `3xl 32`, `4xl 40`, `5xl 48`
  (same `xs`/`sm`/.../`2xl` progression Tailwind uses for its own named scales).
- `typography` — `fontFamily` ("Manrope"), `fontWeight` (`medium '500'`, `bold '700'`,
  `extrabold '800'` — string literals, valid both as CSS `font-weight` and as React Native
  `TextStyle.fontWeight`) and `scale`, a type scale from `caption` to `display`, each with
  `fontSize`, `lineHeight` and a default `fontWeight`.
- `tokens` — all of the above combined into one plain object. Every value is a plain string or
  number (no CSS-only syntax beyond the `rgba()` string on `text03`), so `tokens` can be used
  directly to build a React Native `StyleSheet` value map, e.g.
  `StyleSheet.create({ card: { borderRadius: tokens.radius.md, padding: tokens.spacing.md } })`.
- `generateThemeCss()` — generates the CSS in `dist/theme.css` (see below) from the token source of
  truth. Exported mainly for tests; consumers should use the generated file instead of calling it.

## CSS custom properties (web)

`dist/theme.css`, published as `@najme/ui-tokens/theme.css`, contains a Tailwind v4
[`@theme`](https://tailwindcss.com/docs/theme) block using only
[documented Tailwind v4 theme namespaces](https://tailwindcss.com/docs/theme#theme-variable-namespaces)
— so Tailwind actually generates utilities from these variables, not just custom properties:

- `--font-sans` — the font family (`'Manrope', ui-sans-serif, system-ui, sans-serif`).
- `--font-weight-<name>` — e.g. `--font-weight-medium: 500;`.
- `--text-<name>` — font size for a type scale entry (e.g. `--text-body: 14px;`), with its
  `--text-<name>--line-height` and `--text-<name>--font-weight` companion properties (the
  convention Tailwind v4 recognizes for a full type scale entry, so `text-body` also sets
  `line-height` and `font-weight`).
- `--color-<name>` — e.g. `--color-primary: #526ED3;`.
- `--radius-<name>` — e.g. `--radius-md: 12px;`.
- `--spacing-<name>` — e.g. `--spacing-md: 12px;`.
- `--max-width-<name>` / `--min-width-<name>` — Tailwind resolves `max-w-*`/`min-w-*` from
  `--spacing-*` before `--container-*`, so for every spacing name that is also a container size
  (`xs`…`5xl`) the theme pins these back to the container value (`--max-width-md: 28rem;`). Without
  this, `max-w-md` would be 12px. `p-md`, `gap-md` and `w-md` still use the spacing tokens.

All length values (radius, spacing, font sizes, line heights) carry an explicit `px` unit —
unitless lengths are invalid in CSS and get dropped by browsers.

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
