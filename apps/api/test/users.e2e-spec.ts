import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { newId } from '../src/common/id.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  EmailAlreadyRegisteredError,
  IdentityConflictError,
  UnverifiedProviderEmailError,
} from '../src/users/users.errors.js';
import { UsersService } from '../src/users/users.service.js';

// Requires a reachable Postgres at `DATABASE_URL` with migrations applied.
describe('UsersService (e2e)', () => {
  let app: INestApplication;
  let users: UsersService;
  let prisma: PrismaService;

  // Every email and provider account id carries a unique suffix; only rows created by a test are
  // removed afterwards, so other e2e files sharing the database are unaffected.
  const suffix = randomUUID();
  const emails: string[] = [];
  const email = (name: string): string => {
    const value = `${name}-${suffix}@example.com`;
    emails.push(value);
    return value;
  };
  const account = (name: string): string => `${name}-${suffix}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    users = app.get(UsersService);
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails.splice(0) } } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a password user with a v7 id and a PASSWORD identity', async () => {
    const address = email('a');
    const user = await users.createWithPassword({
      email: address.toUpperCase(),
      passwordHash: 'h',
    });
    expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
    expect(user).toMatchObject({ email: address, localePreference: 'en' });
    expect(user).not.toHaveProperty('passwordHash');
    const identities = await prisma.authIdentity.findMany({ where: { userId: user.id } });
    expect(identities).toHaveLength(1);
    expect(identities[0]).toMatchObject({ provider: 'PASSWORD', passwordHash: 'h' });
  });

  it('treats email uniqueness as case-insensitive', async () => {
    const address = email('mixed');
    await users.createWithPassword({ email: address, passwordHash: 'h' });
    await expect(
      users.createWithPassword({ email: `  ${address.toUpperCase()} `, passwordHash: 'h' }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    expect((await users.findByEmail(address.toUpperCase()))?.email).toBe(address);
  });

  it('rejects non-lowercase emails at the database level', async () => {
    await expect(
      prisma.user.create({ data: { id: newId(), email: `Upper-${suffix}@example.com` } }),
    ).rejects.toThrow();
  });

  it('enforces one identity per (user, provider)', async () => {
    const user = await users.createWithPassword({ email: email('a'), passwordHash: 'h' });
    await expect(
      prisma.authIdentity.create({
        data: { id: newId(), userId: user.id, provider: 'PASSWORD', passwordHash: 'x' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('enforces unique (provider, provider_account_id) but allows many null account ids', async () => {
    const a = await users.createWithPassword({ email: email('a'), passwordHash: 'h' });
    const b = await users.createWithPassword({ email: email('b'), passwordHash: 'h' });
    const data = { provider: 'GOOGLE' as const, providerAccountId: account('sub-1') };
    await prisma.authIdentity.create({ data: { id: newId(), userId: a.id, ...data } });
    await expect(
      prisma.authIdentity.create({ data: { id: newId(), userId: b.id, ...data } }),
    ).rejects.toMatchObject({ code: 'P2002' });
    // Same account id under another provider is fine.
    await prisma.authIdentity.create({
      data: {
        id: newId(),
        userId: b.id,
        provider: 'APPLE',
        providerAccountId: data.providerAccountId,
      },
    });
    // Null account ids never collide: both users have a PASSWORD identity.
    expect(
      await prisma.authIdentity.count({
        where: { userId: { in: [a.id, b.id] }, provider: 'PASSWORD' },
      }),
    ).toBe(2);
  });

  it('excludes soft-deleted users from lookups and updates', async () => {
    const address = email('gone');
    const user = await users.createWithPassword({ email: address, passwordHash: 'h' });
    await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
    expect(await users.findById(user.id)).toBeNull();
    expect(await users.findByEmail(address)).toBeNull();
    expect(await users.updateProfile(user.id, { displayName: 'X' })).toBeNull();
    await expect(
      users.createWithPassword({ email: address, passwordHash: 'h' }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it('updates the profile partially', async () => {
    const user = await users.createWithPassword({ email: email('a'), passwordHash: 'h' });
    const updated = await users.updateProfile(user.id, {
      displayName: 'Ana',
      localePreference: 'me',
    });
    expect(updated).toMatchObject({ displayName: 'Ana', localePreference: 'me', avatarUrl: null });
  });

  describe('findOrLinkByProvider', () => {
    const google = (name: string, sub = 'g-1') => ({
      provider: 'GOOGLE' as const,
      providerAccountId: account(sub),
      email: email(name),
      emailVerified: true,
    });

    it('creates a new verified user, then returns the same one', async () => {
      const input = google('g');
      const first = await users.findOrLinkByProvider(input);
      expect(first.emailVerifiedAt).not.toBeNull();
      const second = await users.findOrLinkByProvider(input);
      expect(second.id).toBe(first.id);
    });

    it('refuses to link on an unverified provider email', async () => {
      const input = google('g');
      await users.createWithPassword({ email: input.email, passwordHash: 'h' });
      await expect(
        users.findOrLinkByProvider({ ...input, emailVerified: false }),
      ).rejects.toBeInstanceOf(UnverifiedProviderEmailError);
    });

    it('wipes the password identity, tokens and pending email tokens of an unverified account', async () => {
      const input = google('victim');
      const existing = await users.createWithPassword({ email: input.email, passwordHash: 'evil' });
      await prisma.refreshToken.create({
        data: {
          id: newId(),
          userId: existing.id,
          tokenHash: `rt-${suffix}`,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      await prisma.emailToken.create({
        data: {
          id: newId(),
          userId: existing.id,
          purpose: 'VERIFY_EMAIL',
          tokenHash: `et-${suffix}`,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      const linked = await users.findOrLinkByProvider(input);

      expect(linked.id).toBe(existing.id);
      expect(linked.emailVerifiedAt).not.toBeNull();
      const identities = await prisma.authIdentity.findMany({ where: { userId: existing.id } });
      expect(identities.map((i) => i.provider)).toEqual(['GOOGLE']);
      const tokens = await prisma.refreshToken.findMany({ where: { userId: existing.id } });
      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.revokedAt).not.toBeNull();
      expect(await prisma.emailToken.count({ where: { userId: existing.id } })).toBe(0);
    });

    it('keeps the password identity and emailVerifiedAt of an already verified account', async () => {
      const input = google('verified');
      const existing = await users.createWithPassword({ email: input.email, passwordHash: 'h' });
      const verifiedAt = new Date('2026-01-01T00:00:00Z');
      await prisma.user.update({
        where: { id: existing.id },
        data: { emailVerifiedAt: verifiedAt },
      });
      await prisma.refreshToken.create({
        data: {
          id: newId(),
          userId: existing.id,
          tokenHash: `rt2-${suffix}`,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      const linked = await users.findOrLinkByProvider(input);

      expect(linked.id).toBe(existing.id);
      expect(linked.emailVerifiedAt).toEqual(verifiedAt);
      const identities = await prisma.authIdentity.findMany({ where: { userId: existing.id } });
      expect(identities.map((i) => i.provider).sort()).toEqual(['GOOGLE', 'PASSWORD']);
      const token = await prisma.refreshToken.findFirstOrThrow({ where: { userId: existing.id } });
      expect(token.revokedAt).toBeNull();
    });

    it('ignores identities of soft-deleted users', async () => {
      const input = google('deleted');
      const first = await users.findOrLinkByProvider(input);
      await prisma.user.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
      // The email stays reserved by the deleted user, so a fresh user cannot be created.
      await expect(users.findOrLinkByProvider(input)).rejects.toBeInstanceOf(
        EmailAlreadyRegisteredError,
      );
      // With another email the deleted user's identity is not reused either.
      await expect(
        users.findOrLinkByProvider({ ...input, email: email('other') }),
      ).rejects.toBeInstanceOf(IdentityConflictError);
    });

    it('resolves concurrent first logins to the same user', async () => {
      const input = google('race');
      const [a, b] = await Promise.all([
        users.findOrLinkByProvider(input),
        users.findOrLinkByProvider(input),
      ]);
      expect(a.id).toBe(b.id);
      expect(await prisma.authIdentity.count({ where: { userId: a.id } })).toBe(1);
    });

    it('raises IdentityConflictError for a second, different account of the same provider', async () => {
      const input = google('two');
      await users.findOrLinkByProvider(input);
      await expect(
        users.findOrLinkByProvider({ ...input, providerAccountId: account('g-2') }),
      ).rejects.toBeInstanceOf(IdentityConflictError);
    });
  });
});
