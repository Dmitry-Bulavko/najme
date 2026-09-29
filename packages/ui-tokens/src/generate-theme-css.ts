import { colors } from './colors.js';
import { radius } from './radius.js';
import { spacing } from './spacing.js';
import { fontFamily, fontWeight, typeScale } from './typography.js';

function kebabCase(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function pxVarLines(prefix: string, tokens: Record<string, number>): string[] {
  return Object.entries(tokens).map(
    ([key, value]) => `  --${prefix}-${kebabCase(key)}: ${value}px;`,
  );
}

/**
 * Tailwind v4's default `--container-*` scale. `max-w-*`/`min-w-*` resolve `--spacing-*` before
 * `--container-*`, so our named spacing tokens (`md`, `xl`, …) would turn `max-w-md` into 12px.
 * For every spacing name that collides, the theme pins `--max-width-*`/`--min-width-*` (checked
 * first) back to the container size, keeping `max-w-md` = 28rem while `p-md`/`gap-md` stay tokens.
 */
const TAILWIND_CONTAINER_SIZES: Readonly<Record<string, string>> = {
  '3xs': '16rem',
  '2xs': '18rem',
  xs: '20rem',
  sm: '24rem',
  md: '28rem',
  lg: '32rem',
  xl: '36rem',
  '2xl': '42rem',
  '3xl': '48rem',
  '4xl': '56rem',
  '5xl': '64rem',
  '6xl': '72rem',
  '7xl': '80rem',
};

function containerWidthLines(spacingKeys: readonly string[]): string[] {
  return spacingKeys.flatMap((key) => {
    const size = TAILWIND_CONTAINER_SIZES[kebabCase(key)];
    return size === undefined
      ? []
      : [`  --max-width-${kebabCase(key)}: ${size};`, `  --min-width-${kebabCase(key)}: ${size};`];
  });
}

function colorVarLines(tokens: Record<string, string>): string[] {
  return Object.entries(tokens).map(([key, value]) => `  --color-${kebabCase(key)}: ${value};`);
}

/**
 * Generates a Tailwind v4 `@theme`-compatible CSS file from the token source of truth
 * (`src/colors.ts`, `src/radius.ts`, `src/spacing.ts`, `src/typography.ts`).
 *
 * Only Tailwind v4's documented theme namespaces are used, so utilities are actually generated
 * from these variables (https://tailwindcss.com/docs/theme#theme-variable-namespaces):
 * `--font-*` (family), `--font-weight-*`, `--text-*` (size, with the `--text-<name>--line-height`
 * and `--text-<name>--font-weight` companion properties Tailwind v4 recognizes for a type scale
 * entry), `--color-*`, `--radius-*` and `--spacing-*`, plus `--max-width-*`/`--min-width-*` for
 * spacing names that shadow Tailwind's container sizes (see `TAILWIND_CONTAINER_SIZES`). Length
 * values (radius, spacing, font sizes, line heights) always carry a `px` unit — Tailwind/browsers
 * drop unitless lengths.
 *
 * This is the single source of truth → CSS pipeline: the file is written to `dist/theme.css` by
 * the build (see `tsup.config.ts`'s `onSuccess` hook) and is never committed, so it cannot drift
 * from the TypeScript tokens. See `package.json#exports["./theme.css"]` and the package README.
 */
export function generateThemeCss(): string {
  const lines: string[] = ['@theme {'];

  lines.push(`  --font-sans: '${fontFamily}', ui-sans-serif, system-ui, sans-serif;`);
  for (const [name, weight] of Object.entries(fontWeight)) {
    lines.push(`  --font-weight-${kebabCase(name)}: ${weight};`);
  }
  for (const [name, { fontSize, lineHeight, fontWeight: weight }] of Object.entries(typeScale)) {
    const varName = `--text-${kebabCase(name)}`;
    lines.push(`  ${varName}: ${fontSize}px;`);
    lines.push(`  ${varName}--line-height: ${lineHeight}px;`);
    lines.push(`  ${varName}--font-weight: ${weight};`);
  }

  lines.push(...colorVarLines(colors));
  lines.push(...pxVarLines('radius', radius));
  lines.push(...pxVarLines('spacing', spacing));
  lines.push(...containerWidthLines(Object.keys(spacing)));

  lines.push('}');
  return lines.join('\n') + '\n';
}
