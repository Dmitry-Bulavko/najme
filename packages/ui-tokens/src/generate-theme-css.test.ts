import { describe, expect, it } from 'vitest';

import { colors } from './colors.js';
import { generateThemeCss } from './generate-theme-css.js';
import { radius } from './radius.js';
import { spacing } from './spacing.js';
import { fontFamily, typeScale } from './typography.js';

describe('generateThemeCss', () => {
  const css = generateThemeCss();

  it('wraps declarations in a Tailwind v4 @theme block', () => {
    expect(css.startsWith('@theme {')).toBe(true);
    expect(css.trim().endsWith('}')).toBe(true);
  });

  it('includes every color token as a CSS custom property, from the same source of truth', () => {
    for (const [name, value] of Object.entries(colors)) {
      const varName = `--color-${name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
      expect(css).toContain(`${varName}: ${value};`);
    }
  });

  it('includes every radius token', () => {
    for (const [name, value] of Object.entries(radius)) {
      expect(css).toContain(`--radius-${name}: ${value};`);
    }
  });

  it('includes every spacing token', () => {
    for (const [name, value] of Object.entries(spacing)) {
      expect(css).toContain(`--spacing-${name}: ${value};`);
    }
  });

  it('includes the type scale and font family', () => {
    expect(css).toContain(`--font-family-sans: '${fontFamily}'`);
    for (const name of Object.keys(typeScale)) {
      const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      expect(css).toContain(`--font-size-${kebab}:`);
      expect(css).toContain(`--line-height-${kebab}:`);
    }
  });
});
