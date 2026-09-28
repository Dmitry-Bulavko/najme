/**
 * WCAG 2.x contrast utilities (relative luminance / contrast ratio), used to assert accessible
 * color pairings in `src/contrast.test.ts`. Not exported from the package's public API — it is a
 * test-only helper, kept as a separate module so the formulas are easy to audit.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Rgba extends Rgb {
  a: number;
}

const HEX_RE = /^#([0-9a-f]{6})$/i;
const RGBA_RE = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

/** Parses a `#rrggbb` hex color or an `rgb()`/`rgba()` string into `{ r, g, b, a }` (0-255, alpha 0-1). */
export function parseColor(input: string): Rgba {
  const hexMatch = HEX_RE.exec(input.trim());
  if (hexMatch) {
    const hex = hexMatch[1] as string;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgbaMatch = RGBA_RE.exec(input.trim());
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]),
      g: Number(rgbaMatch[2]),
      b: Number(rgbaMatch[3]),
      a: rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4]),
    };
  }

  throw new Error(`Unsupported color format: ${input}`);
}

/** Alpha-composites `fg` over opaque `bg`, returning an opaque RGB color. */
export function compositeOver(fg: Rgba, bg: Rgb): Rgb {
  return {
    r: fg.a * fg.r + (1 - fg.a) * bg.r,
    g: fg.a * fg.g + (1 - fg.a) * bg.g,
    b: fg.a * fg.b + (1 - fg.a) * bg.b,
  };
}

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of an opaque RGB color, in [0, 1]. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

/**
 * WCAG contrast ratio between two opaque colors, in [1, 21]. Order of arguments does not matter.
 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Contrast ratio between two colors (hex or rgb/rgba strings). Non-opaque colors are composited
 * over `background` first (WCAG contrast is only defined for opaque colors).
 */
export function contrastOf(colorA: string, colorB: string, background: string): number {
  const bg = parseColor(background);
  const a = compositeOver(parseColor(colorA), bg);
  const b = compositeOver(parseColor(colorB), bg);
  return contrastRatio(a, b);
}

/** WCAG AA minimum contrast ratio for normal (non-large) body text. */
export const WCAG_AA_NORMAL_TEXT = 4.5;
