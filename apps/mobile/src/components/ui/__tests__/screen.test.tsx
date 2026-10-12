import { describe, expect, it } from '@jest/globals';
import { Platform } from 'react-native';

import { screenKeyboardDismissMode } from '../screen';

describe('Screen keyboardDismissMode', () => {
  it('uses interactive on iOS', () => {
    expect(screenKeyboardDismissMode('ios')).toBe('interactive');
  });

  it('uses none on web (scroll-into-view must not dismiss the keyboard)', () => {
    expect(screenKeyboardDismissMode('web')).toBe('none');
  });

  it('uses on-drag on Android', () => {
    expect(screenKeyboardDismissMode('android')).toBe('on-drag');
  });

  it('defaults to the current Platform.OS', () => {
    expect(screenKeyboardDismissMode()).toBe(screenKeyboardDismissMode(Platform.OS));
  });
});
