import { describe, expect, it } from 'vitest';

import { colors } from './colors.js';
import { generateThemeCss } from './generate-theme-css.js';
import { radius } from './radius.js';
import { spacing } from './spacing.js';
import { fontFamily, fontWeight, typeScale } from './typography.js';

function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

describe('generateThemeCss', () => {
  const css = generateThemeCss();

  it('wraps declarations in a Tailwind v4 @theme block', () => {
    expect(css.startsWith('@theme {')).toBe(true);
    expect(css.trim().endsWith('}')).toBe(true);
  });

  it('declares the font family under the --font-* namespace', () => {
    expect(css).toContain(`--font-sans: '${fontFamily}'`);
  });

  it('declares font weights under the --font-weight-* namespace', () => {
    for (const [name, value] of Object.entries(fontWeight)) {
      expect(css).toContain(`--font-weight-${kebab(name)}: ${value};`);
    }
  });

  it('declares the type scale under the --text-* namespace with line-height and font-weight companions', () => {
    for (const [name, { fontSize, lineHeight, fontWeight: weight }] of Object.entries(typeScale)) {
      const varName = `--text-${kebab(name)}`;
      expect(css).toContain(`${varName}: ${fontSize}px;`);
      expect(css).toContain(`${varName}--line-height: ${lineHeight}px;`);
      expect(css).toContain(`${varName}--font-weight: ${weight};`);
    }
  });

  it('declares every color token under the --color-* namespace, from the same source of truth', () => {
    for (const [name, value] of Object.entries(colors)) {
      expect(css).toContain(`--color-${kebab(name)}: ${value};`);
    }
  });

  it('declares every radius token under the --radius-* namespace, in pixels', () => {
    for (const [name, value] of Object.entries(radius)) {
      expect(css).toContain(`--radius-${kebab(name)}: ${value}px;`);
    }
  });

  it('declares every spacing token under the --spacing-* namespace, in pixels', () => {
    for (const [name, value] of Object.entries(spacing)) {
      expect(css).toContain(`--spacing-${kebab(name)}: ${value}px;`);
    }
  });

  it('never emits a unitless length for radius or spacing', () => {
    const lengthVarLine = /^\s*--(radius|spacing)-[^:]+:\s*(-?[\d.]+);/m;
    expect(lengthVarLine.test(css)).toBe(false);
  });
});
