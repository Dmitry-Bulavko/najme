/** Brand typeface. Must be loaded/registered by each client (web: `next/font`, mobile: `expo-font`). */
export const fontFamily = 'Manrope';

/** Font weights used across the product. */
export const fontWeight = {
  medium: 500,
  bold: 700,
  extrabold: 800,
} as const;

export type FontWeightToken = keyof typeof fontWeight;

/**
 * Type scale from smallest (`caption`) to largest (`display`). `fontSize` and `lineHeight` are in
 * pixels/dp so the same numbers work as React Native `StyleSheet` values and as CSS `px`.
 */
export const typeScale = {
  caption: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.medium },
  body: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.medium },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: fontWeight.medium },
  subtitle: { fontSize: 18, lineHeight: 26, fontWeight: fontWeight.bold },
  title: { fontSize: 22, lineHeight: 30, fontWeight: fontWeight.bold },
  heading: { fontSize: 28, lineHeight: 36, fontWeight: fontWeight.extrabold },
  display: { fontSize: 36, lineHeight: 44, fontWeight: fontWeight.extrabold },
} as const;

export type TypeScaleToken = keyof typeof typeScale;

export const typography = {
  fontFamily,
  fontWeight,
  scale: typeScale,
} as const;
