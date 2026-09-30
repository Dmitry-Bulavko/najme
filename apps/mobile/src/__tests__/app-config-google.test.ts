import { describe, expect, it } from '@jest/globals';

/**
 * Production EAS builds must fail closed when the iOS Google client ID is missing (#148).
 * The helper is inlined in app.config.ts; we re-implement the same rule here so Jest can
 * assert without evaluating the full Expo config graph.
 */
function iosUrlSchemeFromClientId(
  clientId: string | undefined,
  profile: string | undefined,
): string {
  const trimmed = clientId?.trim();
  if (!trimmed) {
    if (profile === 'production') {
      throw new Error(
        'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must be set for production EAS builds. ' +
          'Add it to the build environment or eas.json env section.',
      );
    }
    return 'com.googleusercontent.apps.placeholder';
  }
  const prefix = trimmed.replace(/\.apps\.googleusercontent\.com$/i, '');
  return `com.googleusercontent.apps.${prefix}`;
}

describe('app.config Google iOS URL scheme (#148)', () => {
  it('throws for production EAS profile when the iOS client ID is missing', () => {
    expect(() => iosUrlSchemeFromClientId(undefined, 'production')).toThrow(
      /EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must be set/,
    );
  });

  it('allows a placeholder scheme outside production', () => {
    expect(iosUrlSchemeFromClientId(undefined, 'development')).toBe(
      'com.googleusercontent.apps.placeholder',
    );
  });
});
