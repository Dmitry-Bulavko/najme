/**
 * Brand colors, carried over from the previous prototype (see ADR-0003 and
 * `mobile/src/constants/colors.ts` at commit `4e64ce1` in git history).
 *
 * `success`, `warning`, `danger` and `info` are tuned so their paired `*Foreground` color meets
 * WCAG AA contrast (>= 4.5:1) when used as button/badge backgrounds with that foreground text —
 * see `src/contrast.test.ts`.
 */
export const colors = {
  primary: '#526ED3',
  primaryHover: '#4560C4',
  /** Text/icon color to use on top of `primary` and `primaryHover` (e.g. primary button labels). */
  primaryForeground: '#FFFFFF',
  secondary: '#EBEFFF',
  secondaryForeground: '#1B1F3B',
  accent: '#FF8078',
  accentForeground: '#151D34',

  text01: '#151D34',
  text02: '#1B1F3B',
  /**
   * Muted/secondary text. Meets AA (>= 4.5:1) against `background` when composited (see
   * `src/contrast.test.ts`), but treat it as decoration/secondary text only — do not rely on it
   * for small body copy on arbitrary surfaces other than `background`.
   */
  text03: 'rgba(27, 31, 59, 0.65)',

  base01: '#FFFFFF',
  base04: '#D7D7D7',
  background: '#FBFCFF',

  success: '#1A7A4D',
  successForeground: '#FFFFFF',
  warning: '#B45309',
  warningForeground: '#FFFFFF',
  danger: '#C23838',
  dangerForeground: '#FFFFFF',
  info: '#2563A6',
  infoForeground: '#FFFFFF',
} as const;

export type ColorToken = keyof typeof colors;
