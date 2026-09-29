import { localeSchema, type Me } from '@najme/contracts';
import type { User } from './users.types.js';

/** Maps the internal user to the public `Me` contract. */
export function toMe(user: User, hasPassword: boolean): Me {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    locale: localeSchema.catch('en').parse(user.localePreference),
    hasPassword,
  };
}
