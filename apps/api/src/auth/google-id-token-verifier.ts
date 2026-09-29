import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

/** The claims of a verified Google ID token that sign-in needs. */
export interface GoogleIdentityClaims {
  /** Stable Google account id; becomes `providerAccountId`. */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

/**
 * Seam around Google's token verification: production code depends on this abstract class (usable
 * as a DI token), e2e tests substitute a fake so they need no network.
 */
export abstract class GoogleIdTokenVerifier {
  /**
   * @param audiences accepted OAuth client IDs (the token's `aud` must be one of them).
   * @throws when the token is malformed, expired, badly signed, has a wrong issuer/audience, or
   *   lacks `sub`/`email`.
   */
  abstract verify(idToken: string, audiences: readonly string[]): Promise<GoogleIdentityClaims>;
}

/** Real verifier: signature (Google's rotating certs, cached), `iss`, `aud` and `exp` checks. */
@Injectable()
export class GoogleAuthLibraryVerifier extends GoogleIdTokenVerifier {
  private readonly client = new OAuth2Client();

  async verify(idToken: string, audiences: readonly string[]): Promise<GoogleIdentityClaims> {
    const ticket = await this.client.verifyIdToken({ idToken, audience: [...audiences] });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) throw new Error('Token lacks sub or email');
    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: payload.name?.trim() || null,
      picture: payload.picture ?? null,
    };
  }
}
