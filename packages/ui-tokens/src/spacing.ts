/** Spacing scale, in pixels/dp. */
export const spacing = {
  xs: 4,
  sm: 8,
  smd: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  xxxxl: 48,
} as const;

export type SpacingToken = keyof typeof spacing;
