/** Domain types of the users module. Prisma types never leave the module. */

// Locale codes kept in sync with `@najme/i18n`'s `Locale` (ADR-0004). The API already depends on
// that package for catalogs and locale helpers; this alias stays local so Prisma/domain types do
// not import the i18n package into every users-module consumer.
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
  /** Only used when a new user is created; an existing account keeps its preference. */
  localePreference?: LocaleCode;
}

export interface UpdateProfileInput {
  displayName?: string | null;
  avatarUrl?: string | null;
  localePreference?: LocaleCode;
}
