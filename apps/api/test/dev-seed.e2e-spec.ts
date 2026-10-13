import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { AppModule } from '../src/app.module.js';
import {
  DEMO_SALON,
  DEMO_WEEKDAY_INTERVALS,
  DEMO_WEEKDAYS,
  DEV_SEED_EMAILS,
  DEV_SEED_IDS,
  DEV_SEED_PASSWORD,
  PENDING_STUDIO,
  runDevSeed,
} from '../src/dev-seed/index.js';
import { PasswordService } from '../src/auth/password.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Dev seed e2e (#88).
 *
 * Exception to the usual e2e cleanup rule: the seed upserts fixed emails/ids and is meant to
 * leave Demo Salon / Pending Studio in the shared DATABASE_URL database (local + CI). Specs that
 * need isolation should not rely on wiping these rows between tests.
 */
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
    const afterFirst = await prisma.business.findUniqueOrThrow({
      where: { id: first.demoBusinessId },
      select: { approvedAt: true },
    });

    const second = await runDevSeed(prisma);

    expect(second.adminUserId).toBe(first.adminUserId);
    expect(second.ownerUserId).toBe(first.ownerUserId);
    expect(second.demoBusinessId).toBe(first.demoBusinessId);
    expect(second.pendingBusinessId).toBe(first.pendingBusinessId);
    expect(second.demoBusinessId).toBe(DEV_SEED_IDS.demoBusiness);

    const afterSecond = await prisma.business.findUniqueOrThrow({
      where: { id: second.demoBusinessId },
      select: { approvedAt: true },
    });
    expect(afterSecond.approvedAt?.getTime()).toBe(afterFirst.approvedAt?.getTime());

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
    expect(demo.timezone).toBe('Europe/Podgorica');
    expect(demo.confirmationMode).toBe('AUTO');
    expect(demo.cancellationWindowMinutes).toBe(120);
    expect(demo.minBookingNoticeMinutes).toBe(60);
    expect(demo.bookingHorizonDays).toBe(60);
    expect(demo.description).toContain('Demo Salon');

    expect(demo.staffMembers).toHaveLength(2);
    expect(demo.services).toHaveLength(3);
    const consult = demo.services.find((s) => s.id === DEV_SEED_IDS.serviceConsult);
    expect(consult?.customFields).toHaveLength(1);
    expect(consult?.customFields[0]?.key).toBe('client_notes');
    expect(consult?.customFields[0]?.label).toBe('Client notes');

    const linkedStaff = demo.memberships.find((m) => m.user.email === DEV_SEED_EMAILS.staff);
    expect(linkedStaff?.staffMemberId).toBe(DEV_SEED_IDS.staffMarko);

    const intervals = await prisma.workingHours.findMany({
      where: { staffMember: { businessId: demo.id } },
      select: { weekday: true, startMinute: true, endMinute: true },
    });
    expect(intervals).toHaveLength(DEMO_WEEKDAYS.length * DEMO_WEEKDAY_INTERVALS.length * 2);
    for (const weekday of DEMO_WEEKDAYS) {
      for (const window of DEMO_WEEKDAY_INTERVALS) {
        expect(
          intervals.filter(
            (row) =>
              row.weekday === weekday &&
              row.startMinute === window.startMinute &&
              row.endMinute === window.endMinute,
          ).length,
        ).toBe(2);
      }
    }

    const pending = await prisma.business.findUniqueOrThrow({
      where: { id: first.pendingBusinessId },
    });
    expect(pending.name).toBe(PENDING_STUDIO.name);
    expect(pending.status).toBe('PENDING_APPROVAL');
  });

  it('restores soft-deleted Demo Salon staff on re-seed', async () => {
    await runDevSeed(prisma);
    await prisma.staffMember.update({
      where: { id: DEV_SEED_IDS.staffAna },
      data: { deletedAt: new Date() },
    });
    expect(
      await prisma.staffMember.findFirst({
        where: { id: DEV_SEED_IDS.staffAna, deletedAt: null },
      }),
    ).toBeNull();

    await runDevSeed(prisma);
    const restored = await prisma.staffMember.findUniqueOrThrow({
      where: { id: DEV_SEED_IDS.staffAna },
    });
    expect(restored.deletedAt).toBeNull();
    expect(restored.displayName).toBe('Ana');
  });
});
