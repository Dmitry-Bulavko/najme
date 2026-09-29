/** Domain types of the users module. Prisma types never leave the module. */

// Mirrors `Locale` from @najme/i18n (api does not depend on that package; see ADR-0004).
export type LocaleCode = 'en' | 'me' | 'ru' | 'tr';

export type AuthProviderName = 'PASSWORD' | 'GOOGLE' | 'APPLE';
export type ExternalAuthProvider = Exclude<AuthProviderName, 'PASSWORD'>;

export interface User {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  displayName: string | null;
  avatarUrl: string | null;
  localePreference: string;
  isPlatformAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWithPasswordInput {
  email: string;
  /** Already hashed (argon2id) by the auth module. */
  passwordHash: string;
  displayName?: string | null;
  localePreference?: LocaleCode;
}

export interface FindOrLinkByProviderInput {
  provider: ExternalAuthProvider;
  providerAccountId: string;
  email: string;
  /** Whether the provider vouches for the email; required to link to an existing account. */
  emailVerified: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface UpdateProfileInput {
  displayName?: string | null;
  avatarUrl?: string | null;
  localePreference?: LocaleCode;
}
