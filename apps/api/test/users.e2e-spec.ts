import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { newId } from '../src/common/id.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  EmailAlreadyRegisteredError,
  UnverifiedProviderEmailError,
} from '../src/users/users.errors.js';
import { UsersService } from '../src/users/users.service.js';

// Requires a reachable Postgres at `DATABASE_URL` with migrations applied.
describe('UsersService (e2e)', () => {
  let app: INestApplication;
  let users: UsersService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    users = app.get(UsersService);
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
  });

  it('creates a password user with a v7 id and a PASSWORD identity', async () => {
    const user = await users.createWithPassword({ email: 'A@Example.com', passwordHash: 'h' });
    expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
    expect(user).toMatchObject({ email: 'a@example.com', localePreference: 'en' });
    expect(user).not.toHaveProperty('passwordHash');
    const identities = await prisma.authIdentity.findMany({ where: { userId: user.id } });
    expect(identities).toHaveLength(1);
    expect(identities[0]).toMatchObject({ provider: 'PASSWORD', passwordHash: 'h' });
  });

  it('treats email uniqueness as case-insensitive', async () => {
    await users.createWithPassword({ email: 'Mixed@Example.com', passwordHash: 'h' });
    await expect(
      users.createWithPassword({ email: '  mixed@EXAMPLE.com ', passwordHash: 'h' }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    expect((await users.findByEmail('MIXED@example.COM'))?.email).toBe('mixed@example.com');
  });

  it('enforces one identity per (user, provider)', async () => {
    const user = await users.createWithPassword({ email: 'a@example.com', passwordHash: 'h' });
    await expect(
      prisma.authIdentity.create({
        data: { id: newId(), userId: user.id, provider: 'PASSWORD', passwordHash: 'x' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('enforces unique (provider, provider_account_id) but allows many null account ids', async () => {
    const a = await users.createWithPassword({ email: 'a@example.com', passwordHash: 'h' });
    const b = await users.createWithPassword({ email: 'b@example.com', passwordHash: 'h' });
    const data = { provider: 'GOOGLE' as const, providerAccountId: 'sub-1' };
    await prisma.authIdentity.create({ data: { id: newId(), userId: a.id, ...data } });
    await expect(
      prisma.authIdentity.create({ data: { id: newId(), userId: b.id, ...data } }),
    ).rejects.toThrow();
    // Same account id under another provider is fine.
    await prisma.authIdentity.create({
      data: { id: newId(), userId: b.id, provider: 'APPLE', providerAccountId: 'sub-1' },
    });
    // Null account ids never collide (the two PASSWORD identities above already coexist).
    expect(await prisma.authIdentity.count({ where: { provider: 'PASSWORD' } })).toBe(2);
  });

  it('excludes soft-deleted users from lookups and updates', async () => {
    const user = await users.createWithPassword({ email: 'gone@example.com', passwordHash: 'h' });
    await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
    expect(await users.findById(user.id)).toBeNull();
    expect(await users.findByEmail('gone@example.com')).toBeNull();
    expect(await users.updateProfile(user.id, { displayName: 'X' })).toBeNull();
    await expect(
      users.createWithPassword({ email: 'gone@example.com', passwordHash: 'h' }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it('updates the profile partially', async () => {
    const user = await users.createWithPassword({ email: 'a@example.com', passwordHash: 'h' });
    const updated = await users.updateProfile(user.id, {
      displayName: 'Ana',
      localePreference: 'me',
    });
    expect(updated).toMatchObject({ displayName: 'Ana', localePreference: 'me', avatarUrl: null });
  });

  describe('findOrLinkByProvider', () => {
    const google = {
      provider: 'GOOGLE' as const,
      providerAccountId: 'g-1',
      email: 'G@example.com',
    };

    it('creates a new verified user, then returns the same one', async () => {
      const first = await users.findOrLinkByProvider({ ...google, emailVerified: true });
      expect(first.emailVerifiedAt).not.toBeNull();
      const second = await users.findOrLinkByProvider({ ...google, emailVerified: true });
      expect(second.id).toBe(first.id);
    });

    it('links to an existing user with the same verified email', async () => {
      const existing = await users.createWithPassword({
        email: 'g@example.com',
        passwordHash: 'h',
      });
      const linked = await users.findOrLinkByProvider({ ...google, emailVerified: true });
      expect(linked.id).toBe(existing.id);
      expect(linked.emailVerifiedAt).not.toBeNull();
      expect(await prisma.authIdentity.count({ where: { userId: existing.id } })).toBe(2);
    });

    it('refuses to link on an unverified provider email', async () => {
      await users.createWithPassword({ email: 'g@example.com', passwordHash: 'h' });
      await expect(
        users.findOrLinkByProvider({ ...google, emailVerified: false }),
      ).rejects.toBeInstanceOf(UnverifiedProviderEmailError);
    });
  });
});
