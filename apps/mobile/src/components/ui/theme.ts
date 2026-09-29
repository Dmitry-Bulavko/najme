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

/** Control heights (dp) for buttons and inputs; `sm` is the minimum touch target. */
export const CONTROL_HEIGHT = { sm: MIN_TOUCH_TARGET, md: 48, lg: 56 } as const;

/** Border width (dp) of outlined controls (buttons, text fields). */
export const CONTROL_BORDER_WIDTH = 1.5;

/** Icon glyph sizes (dp). */
export const ICON_SIZE = { sm: 20, md: 22, lg: 28, xl: 36 } as const;

/** Circular/rounded icon badge diameters (dp). */
export const ICON_BADGE_SIZE = { sm: 36, md: 52, lg: 72 } as const;

/** Default avatar diameter (dp) and the initials' size relative to it. */
export const AVATAR_DEFAULT_SIZE = 48;
export const AVATAR_INITIALS_FONT_RATIO = 0.38;
export const AVATAR_INITIALS_LINE_RATIO = 0.5;

/**
 * Tab bar label size (dp). React Navigation scales tab labels with dynamic type itself, so no
 * `allowFontScaling` override is applied here.
 */
export const TAB_LABEL_FONT_SIZE = 11;
