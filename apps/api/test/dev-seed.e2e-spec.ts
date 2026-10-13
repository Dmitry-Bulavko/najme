import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { AppModule } from '../src/app.module.js';
import {
  DEMO_SALON,
  DEV_SEED_EMAILS,
  DEV_SEED_PASSWORD,
  PENDING_STUDIO,
  runDevSeed,
} from '../src/dev-seed/index.js';
import { PasswordService } from '../src/auth/password.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Dev seed (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwords: PasswordService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    passwords = app.get(PasswordService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('is idempotent and creates the documented demo shape', async () => {
    const first = await runDevSeed(prisma);
    const second = await runDevSeed(prisma);

    expect(second.adminUserId).toBe(first.adminUserId);
    expect(second.ownerUserId).toBe(first.ownerUserId);
    expect(second.demoBusinessId).toBe(first.demoBusinessId);
    expect(second.pendingBusinessId).toBe(first.pendingBusinessId);

    const emails = Object.values(DEV_SEED_EMAILS);
    const users = await prisma.user.findMany({
      where: { email: { in: [...emails] } },
      select: {
        email: true,
        isPlatformAdmin: true,
        authIdentities: { where: { provider: 'PASSWORD' }, select: { passwordHash: true } },
      },
    });
    expect(users).toHaveLength(4);
    const admin = users.find((u) => u.email === DEV_SEED_EMAILS.admin);
    expect(admin?.isPlatformAdmin).toBe(true);
    for (const user of users) {
      const hash = user.authIdentities[0]?.passwordHash;
      expect(hash).toBeTruthy();
      if (!hash) continue;
      expect(await passwords.verify(hash, DEV_SEED_PASSWORD)).toBe(true);
    }

    const demo = await prisma.business.findUniqueOrThrow({
      where: { id: first.demoBusinessId },
      include: {
        staffMembers: { where: { deletedAt: null } },
        memberships: { where: { role: 'STAFF' }, include: { user: true } },
        services: { where: { deletedAt: null }, include: { customFields: true } },
      },
    });
    expect(demo.name).toBe(DEMO_SALON.name);
    expect(demo.slug).toBe(DEMO_SALON.slug);
    expect(demo.status).toBe('APPROVED');
    expect(demo.staffMembers).toHaveLength(2);
    expect(demo.services).toHaveLength(3);
    expect(demo.services.some((s) => s.customFields.length === 1)).toBe(true);
    const linkedStaff = demo.memberships.find((m) => m.user.email === DEV_SEED_EMAILS.staff);
    expect(linkedStaff?.staffMemberId).toBeTruthy();
    expect(demo.staffMembers.some((s) => s.id === linkedStaff?.staffMemberId)).toBe(true);

    const hours = await prisma.workingHours.count({
      where: { staffMember: { businessId: demo.id } },
    });
    // 2 staff × 5 weekdays × 2 intervals
    expect(hours).toBe(20);

    const pending = await prisma.business.findUniqueOrThrow({
      where: { id: first.pendingBusinessId },
    });
    expect(pending.name).toBe(PENDING_STUDIO.name);
    expect(pending.status).toBe('PENDING_APPROVAL');
  });
});
