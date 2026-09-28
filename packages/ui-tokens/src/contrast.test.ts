import { describe, expect, it } from 'vitest';

import { colors } from './colors.js';
import { contrastOf, WCAG_AA_NORMAL_TEXT } from './contrast.js';

describe('WCAG AA contrast', () => {
  it('text01 on background meets AA for normal text', () => {
    expect(contrastOf(colors.text01, colors.background, colors.background)).toBeGreaterThanOrEqual(
      WCAG_AA_NORMAL_TEXT,
    );
  });

  it('text02 on background meets AA for normal text', () => {
    expect(contrastOf(colors.text02, colors.background, colors.background)).toBeGreaterThanOrEqual(
      WCAG_AA_NORMAL_TEXT,
    );
  });

  it('text02 on secondary meets AA for normal text', () => {
    expect(contrastOf(colors.text02, colors.secondary, colors.secondary)).toBeGreaterThanOrEqual(
      WCAG_AA_NORMAL_TEXT,
    );
  });

  it('text03 (composited over background) meets AA for body text on background', () => {
    // text03 is translucent; WCAG contrast only applies to opaque colors, so it is composited
    // over `background` (its only documented use case) before measuring. If this ever drops
    // below AA, text03 must be restricted to secondary/large text only and the README updated.
    expect(contrastOf(colors.text03, colors.background, colors.background)).toBeGreaterThanOrEqual(
      WCAG_AA_NORMAL_TEXT,
    );
  });

  it('primaryForeground (button label) on primary meets AA for normal text', () => {
    expect(
      contrastOf(colors.primaryForeground, colors.primary, colors.background),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it('primaryForeground on primaryHover meets AA for normal text', () => {
    expect(
      contrastOf(colors.primaryForeground, colors.primaryHover, colors.background),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it.each([
    ['success', colors.success, colors.successForeground],
    ['warning', colors.warning, colors.warningForeground],
    ['danger', colors.danger, colors.dangerForeground],
    ['info', colors.info, colors.infoForeground],
  ])('%s foreground on %s background meets AA for normal text', (_name, bg, fg) => {
    expect(contrastOf(fg, bg, colors.background)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it('secondaryForeground on secondary meets AA for normal text', () => {
    expect(
      contrastOf(colors.secondaryForeground, colors.secondary, colors.background),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });
});
