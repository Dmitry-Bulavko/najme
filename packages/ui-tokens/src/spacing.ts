/**
 * Spacing scale, in pixels/dp: 4, 8, 12, 16, 20, 24, 32, 40, 48. Named with the common
 * `xs`/`sm`/`md`/`lg`/`xl`/`2xl`/`3xl`/`4xl`/`5xl` progression (same convention Tailwind uses for
 * its own named scales), rather than the ambiguous `xxl`/`xxxl` style.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export type SpacingToken = keyof typeof spacing;
