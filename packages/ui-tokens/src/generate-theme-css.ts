import { colors } from './colors.js';
import { radius } from './radius.js';
import { spacing } from './spacing.js';
import { fontFamily, fontWeight, typeScale } from './typography.js';

function kebabCase(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function cssVarLines(prefix: string, tokens: Record<string, string | number>): string[] {
  return Object.entries(tokens).map(([key, value]) => `  --${prefix}-${kebabCase(key)}: ${value};`);
}

/**
 * Generates a Tailwind v4 `@theme`-compatible CSS file from the token source of truth
 * (`src/colors.ts`, `src/radius.ts`, `src/spacing.ts`, `src/typography.ts`).
 *
 * This is the single source of truth → CSS pipeline: the file is written to `dist/theme.css` by
 * the build (see `tsup.config.ts`'s `onSuccess` hook) and is never committed, so it cannot drift
 * from the TypeScript tokens. See `package.json#exports["./theme.css"]` and the package README.
 */
export function generateThemeCss(): string {
  const lines: string[] = ['@theme {'];

  lines.push(`  --font-family-sans: '${fontFamily}', system-ui, sans-serif;`);
  for (const [name, weight] of Object.entries(fontWeight)) {
    lines.push(`  --font-weight-${kebabCase(name)}: ${weight};`);
  }
  for (const [name, { fontSize, lineHeight }] of Object.entries(typeScale)) {
    lines.push(`  --font-size-${kebabCase(name)}: ${fontSize}px;`);
    lines.push(`  --line-height-${kebabCase(name)}: ${lineHeight}px;`);
  }

  lines.push(...cssVarLines('color', colors));
  lines.push(...cssVarLines('radius', radius));
  lines.push(...cssVarLines('spacing', spacing));

  lines.push('}');
  return lines.join('\n') + '\n';
}
