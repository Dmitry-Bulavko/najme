import {
  GoogleIdTokenVerifier,
  type GoogleIdentityClaims,
} from '../../src/auth/google-id-token-verifier.js';

/** In-memory {@link GoogleIdTokenVerifier}: tokens are registered up front, others are rejected. */
export class FakeGoogleVerifier extends GoogleIdTokenVerifier {
  private readonly tokens = new Map<string, GoogleIdentityClaims>();
  lastAudiences: readonly string[] = [];

  issue(token: string, claims: Partial<GoogleIdentityClaims> & { sub: string; email: string }) {
    this.tokens.set(token, { emailVerified: true, name: null, picture: null, ...claims });
    return token;
  }

  async verify(idToken: string, audiences: readonly string[]): Promise<GoogleIdentityClaims> {
    this.lastAudiences = audiences;
    const claims = this.tokens.get(idToken);
    if (!claims) throw new Error('bad token');
    return claims;
  }
}
