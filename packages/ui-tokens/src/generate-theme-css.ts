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
 * entry), `--color-*`, `--radius-*` and `--spacing-*`. Length values (radius, spacing, font sizes,
 * line heights) always carry a `px` unit — Tailwind/browsers drop unitless lengths.
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

  lines.push('}');
  return lines.join('\n') + '\n';
}
