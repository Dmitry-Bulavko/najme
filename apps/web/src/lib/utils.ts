import { typeScale } from '@najme/ui-tokens';
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** `bodyLarge` -> `body-large`, matching how the tokens' `theme.css` names `--text-*` variables. */
function kebabCase(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Font-size utility suffixes generated from the type scale (`text-caption`, `text-title`, ...). */
export const TOKEN_FONT_SIZES: readonly string[] = Object.keys(typeScale).map(kebabCase);

/**
 * tailwind-merge does not know our custom `text-*` size utilities and would treat them as colours
 * (so `text-title text-foreground` dropped the size). Registering them as `font-size` fixes that.
 * The list is derived from the tokens, so a new size cannot be forgotten.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...TOKEN_FONT_SIZES] }],
    },
  },
});

/** Merges conditional class names and resolves conflicting Tailwind utilities (shadcn convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
