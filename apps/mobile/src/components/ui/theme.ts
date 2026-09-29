import { tokens } from '@najme/ui-tokens';

/**
 * Font families registered in `src/app/_layout.tsx`. On Android a `fontWeight` does not select a
 * custom font's weight variant, so weights map to per-weight family names instead.
 */
export const fontFamilies = {
  regular: tokens.typography.fontFamily,
  medium: `${tokens.typography.fontFamily}-Medium`,
  bold: `${tokens.typography.fontFamily}-Bold`,
  extrabold: `${tokens.typography.fontFamily}-ExtraBold`,
} as const;

/** Upper bound for dynamic type so layouts stay usable at the largest accessibility sizes. */
export const MAX_FONT_SIZE_MULTIPLIER = 1.6;

/** Minimum touch target (dp) recommended by iOS and Android accessibility guidelines. */
export const MIN_TOUCH_TARGET = 44;
