import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { newId } from '../common/id.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  EmailAlreadyRegisteredError,
  IdentityConflictError,
  UnverifiedProviderEmailError,
} from './users.errors.js';
import type {
  CreateWithPasswordInput,
  FindOrLinkByProviderInput,
  UpdateProfileInput,
  User,
} from './users.types.js';

const userSelect = {
  id: true,
  email: true,
  emailVerifiedAt: true,
  displayName: true,
  avatarUrl: true,
  localePreference: true,
  isPlatformAdmin: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

/** Emails are stored trimmed and lowercased; uniqueness is therefore case-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: userSelect });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email: normalizeEmail(email), deletedAt: null },
      select: userSelect,
    });
  }

  /** Whether the user has a password identity (drives `Me.hasPassword`). */
  async hasPassword(userId: string): Promise<boolean> {
    const identity = await this.prisma.authIdentity.findFirst({
      where: { userId, provider: 'PASSWORD', passwordHash: { not: null } },
      select: { id: true },
    });
    return identity !== null;
  }

  /** The stored password hash, or null when the user has no password identity. */
  async findPasswordHash(userId: string): Promise<string | null> {
    const identity = await this.prisma.authIdentity.findFirst({
      where: {
        userId,
        provider: 'PASSWORD',
        passwordHash: { not: null },
        user: { deletedAt: null },
      },
      select: { passwordHash: true },
    });
    return identity?.passwordHash ?? null;
  }

  /** The user and their password hash for an email login; null if either does not exist. */
  async findPasswordCredentialByEmail(
    email: string,
  ): Promise<{ user: User; passwordHash: string } | null> {
    const identity = await this.prisma.authIdentity.findFirst({
      where: {
        provider: 'PASSWORD',
        passwordHash: { not: null },
        user: { email: normalizeEmail(email), deletedAt: null },
      },
      select: { passwordHash: true, user: { select: userSelect } },
    });
    return identity?.passwordHash
      ? { user: identity.user, passwordHash: identity.passwordHash }
      : null;
  }

  /** Marks the email verified (keeps the original timestamp if it already is). */
  async markEmailVerified(
    userId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await db.user.updateMany({
      where: { id: userId, deletedAt: null, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  }

  /** Replaces the password hash; false when the user has no password identity to update. */
  async setPassword(
    userId: string,
    passwordHash: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    const result = await db.authIdentity.updateMany({
      where: { userId, provider: 'PASSWORD', user: { deletedAt: null } },
      data: { passwordHash },
    });
    return result.count > 0;
  }

  /** @throws EmailAlreadyRegisteredError when the email is taken (including by a deleted user). */
  async createWithPassword(input: CreateWithPasswordInput): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          id: newId(),
          email: normalizeEmail(input.email),
          displayName: input.displayName ?? null,
          ...(input.localePreference ? { localePreference: input.localePreference } : {}),
          authIdentities: {
            create: { id: newId(), provider: 'PASSWORD', passwordHash: input.passwordHash },
          },
        },
        select: userSelect,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new EmailAlreadyRegisteredError();
      throw error;
    }
  }

  /**
   * Resolves the user for an external identity: returns the user already linked to it, else links
   * it to the existing user with the same (verified) email, else creates a new user.
   *
   * When the existing account's email was never verified, its password identity, refresh tokens and
   * pending email tokens are removed before linking: whoever registered the address first may not
   * be its owner (pre-hijacking), so nothing they set up may survive the provider verifying it.
   *
   * @throws UnverifiedProviderEmailError when linking would rely on an unverified provider email.
   * @throws IdentityConflictError when the user already has a different identity for the provider.
   * @throws EmailAlreadyRegisteredError on an email conflict with a deleted user.
   */
  async findOrLinkByProvider(input: FindOrLinkByProviderInput): Promise<User> {
    try {
      return await this.resolveProviderUser(input);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    // Lost a race with a concurrent first login: retry once, now the identity may exist.
    try {
      return await this.resolveProviderUser(input);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      throw this.classifyConflict(error);
    }
  }

  private classifyConflict(error: unknown): Error {
    // With the pg driver adapter the violated index is reported in `meta.driverAdapterError`.
    const fields = JSON.stringify((error as Prisma.PrismaClientKnownRequestError).meta ?? {});
    return fields.includes('users_email_key')
      ? new EmailAlreadyRegisteredError()
      : new IdentityConflictError();
  }

  private async resolveProviderUser(input: FindOrLinkByProviderInput): Promise<User> {
    const linked = await this.prisma.authIdentity.findFirst({
      where: {
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        user: { deletedAt: null },
      },
      select: { user: { select: userSelect } },
    });
    if (linked) return linked.user;

    const email = normalizeEmail(input.email);
    const identity = {
      id: newId(),
      provider: input.provider,
      providerAccountId: input.providerAccountId,
    };

    const existing = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, emailVerifiedAt: true },
    });
    if (existing) {
      if (!input.emailVerified) throw new UnverifiedProviderEmailError();
      return this.prisma.$transaction(async (tx) => {
        // Lock the row and re-read: the owner may have verified the email since the read above
        // (#49); wiping a just-verified account's password would be wrong, and the lock makes a
        // concurrent verification wait until this transaction has committed.
        const current = await tx.$queryRaw<
          { email_verified_at: Date | null }[]
        >`SELECT email_verified_at FROM users WHERE id = ${existing.id}::uuid AND deleted_at IS NULL FOR UPDATE`;
        if (current.length === 0) throw new EmailAlreadyRegisteredError();
        const emailVerifiedAt = current[0]?.email_verified_at ?? null;
        if (emailVerifiedAt === null) {
          await tx.authIdentity.deleteMany({
            where: { userId: existing.id, provider: 'PASSWORD' },
          });
          await tx.refreshToken.updateMany({
            where: { userId: existing.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          await tx.emailToken.deleteMany({ where: { userId: existing.id, usedAt: null } });
        }
        return tx.user.update({
          where: { id: existing.id },
          data: {
            emailVerifiedAt: emailVerifiedAt ?? new Date(),
            authIdentities: { create: identity },
          },
          select: userSelect,
        });
      });
    }

    return this.prisma.user.create({
      data: {
        id: newId(),
        email,
        emailVerifiedAt: input.emailVerified ? new Date() : null,
        displayName: input.displayName ?? null,
        avatarUrl: input.avatarUrl ?? null,
        authIdentities: { create: identity },
      },
      select: userSelect,
    });
  }

  /** @returns the updated user, or null when it does not exist or is deleted. */
  async updateProfile(id: string, input: UpdateProfileInput): Promise<User | null> {
    const result = await this.prisma.user.updateManyAndReturn({
      where: { id, deletedAt: null },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        ...(input.localePreference !== undefined
          ? { localePreference: input.localePreference }
          : {}),
      },
      select: userSelect,
    });
    return result[0] ?? null;
  }
}
