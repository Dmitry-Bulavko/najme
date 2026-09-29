import { typeScale } from '@najme/ui-tokens';
import { describe, expect, it } from 'vitest';

import { cn, TOKEN_FONT_SIZES } from './utils';

describe('cn', () => {
  it('keeps a token font size next to a text colour', () => {
    expect(cn('text-title text-foreground')).toBe('text-title text-foreground');
  });

  it('lets a later token font size replace an earlier one', () => {
    expect(cn('text-title text-heading')).toBe('text-heading');
  });

  it('still resolves conflicting colours and stock sizes', () => {
    expect(cn('text-foreground text-primary')).toBe('text-primary');
    expect(cn('text-sm text-base')).toBe('text-base');
  });

  it('knows every size in the type scale', () => {
    expect(TOKEN_FONT_SIZES).toHaveLength(Object.keys(typeScale).length);
    for (const size of TOKEN_FONT_SIZES) {
      expect(cn(`text-${size} text-foreground`)).toBe(`text-${size} text-foreground`);
    }
  });
});
