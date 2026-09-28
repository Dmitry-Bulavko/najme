export { colors, type ColorToken } from './colors.js';
export { radius, type RadiusToken } from './radius.js';
export { spacing, type SpacingToken } from './spacing.js';
export {
  fontFamily,
  fontWeight,
  typeScale,
  typography,
  type FontWeightToken,
  type TypeScaleToken,
} from './typography.js';
export { generateThemeCss } from './generate-theme-css.js';

import { colors } from './colors.js';
import { radius } from './radius.js';
import { spacing } from './spacing.js';
import { typography } from './typography.js';

/**
 * All tokens combined into one plain object — usable directly as/inside a React Native
 * `StyleSheet` value map (colors, radius and spacing are strings/numbers, no CSS-only syntax).
 */
export const tokens = {
  colors,
  radius,
  spacing,
  typography,
} as const;
