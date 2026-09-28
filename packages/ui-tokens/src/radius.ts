/** Border radius scale, in pixels/dp. `full` is used for pills and circular elements. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;
