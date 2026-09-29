import type { Me } from '@najme/contracts';

/** What the JWT guard attaches to the request. */
export interface AuthenticatedUser {
  id: string;
}

/** Request metadata stored next to a refresh token (audit only). */
export interface ClientContext {
  userAgent: string | null;
  ipAddress: string | null;
}

/** Result of a successful sign-in/refresh, before the controller decides how to deliver the token. */
export interface IssuedSession {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: Me;
}
