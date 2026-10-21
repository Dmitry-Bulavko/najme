import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import Constants from 'expo-constants';

import { canOfferGoogleSignIn } from '../google-availability';

describe('canOfferGoogleSignIn', () => {
  const originalIos = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const originalWeb = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const constants = Constants as { appOwnership: string | null | undefined };
  const previousOwnership = constants.appOwnership;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios.apps.googleusercontent.com';
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web.apps.googleusercontent.com';
    constants.appOwnership = null;
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = originalIos;
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = originalWeb;
    constants.appOwnership = previousOwnership;
  });

  it('returns false in Expo Go even when env is configured', () => {
    constants.appOwnership = 'expo';
    expect(canOfferGoogleSignIn()).toBe(false);
  });

  it('returns true in a native build when env is configured and the module loads', () => {
    constants.appOwnership = null;
    // jest.setup mocks the native module so require succeeds under Jest.
    expect(canOfferGoogleSignIn()).toBe(true);
  });
});
