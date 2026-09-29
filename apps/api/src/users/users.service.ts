import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { newId } from '../common/id.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailAlreadyRegisteredError, UnverifiedProviderEmailError } from './users.errors.js';
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
   * @throws UnverifiedProviderEmailError when linking would rely on an unverified provider email.
   */
  async findOrLinkByProvider(input: FindOrLinkByProviderInput): Promise<User> {
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
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          authIdentities: { create: identity },
        },
        select: userSelect,
      });
    }

    try {
      return await this.prisma.user.create({
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
    } catch (error) {
      if (isUniqueViolation(error)) throw new EmailAlreadyRegisteredError();
      throw error;
    }
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
