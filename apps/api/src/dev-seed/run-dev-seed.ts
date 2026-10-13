import { hash } from '@node-rs/argon2';

import type { PrismaClient } from '../../generated/prisma/client.js';
import { newId } from '../common/id.js';
import { assertNotProductionEnv } from './assert-not-production.js';
import {
  DEMO_SALON,
  DEMO_WEEKDAY_INTERVALS,
  DEMO_WEEKDAYS,
  DEV_SEED_EMAILS,
  DEV_SEED_IDS,
  DEV_SEED_PASSWORD,
  PENDING_STUDIO,
} from './constants.js';

type SeedUserSpec = {
  preferredId: string;
  email: string;
  preferredIdentityId: string;
  displayName: string;
  isPlatformAdmin: boolean;
};

/** Prisma client or interactive transaction client. */
type SeedDb = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends' | '$use'
>;

const SEED_USERS: readonly SeedUserSpec[] = [
  {
    preferredId: DEV_SEED_IDS.adminUser,
    email: DEV_SEED_EMAILS.admin,
    preferredIdentityId: DEV_SEED_IDS.adminIdentity,
    displayName: 'Dev Admin',
    isPlatformAdmin: true,
  },
  {
    preferredId: DEV_SEED_IDS.ownerUser,
    email: DEV_SEED_EMAILS.owner,
    preferredIdentityId: DEV_SEED_IDS.ownerIdentity,
    displayName: 'Demo Owner',
    isPlatformAdmin: false,
  },
  {
    preferredId: DEV_SEED_IDS.staffUser,
    email: DEV_SEED_EMAILS.staff,
    preferredIdentityId: DEV_SEED_IDS.staffIdentity,
    displayName: 'Demo Staff',
    isPlatformAdmin: false,
  },
  {
    preferredId: DEV_SEED_IDS.clientUser,
    email: DEV_SEED_EMAILS.client,
    preferredIdentityId: DEV_SEED_IDS.clientIdentity,
    displayName: 'Demo Client',
    isPlatformAdmin: false,
  },
];

export type DevSeedResult = {
  adminUserId: string;
  ownerUserId: string;
  staffUserId: string;
  clientUserId: string;
  demoBusinessId: string;
  pendingBusinessId: string;
};

/**
 * Idempotent demo dataset for local development and the CI Playwright M2 exit flow.
 * Safe to re-run: fixed emails/ids upsert; Demo Salon children are replaced each run.
 */
export async function runDevSeed(prisma: PrismaClient): Promise<DevSeedResult> {
  assertNotProductionEnv(process.env.NODE_ENV);

  const passwordHash = await hash(DEV_SEED_PASSWORD);
  const now = new Date();

  const [adminSeed, ownerSeed, staffSeed, clientSeed] = SEED_USERS;
  if (!adminSeed || !ownerSeed || !staffSeed || !clientSeed) {
    throw new Error('SEED_USERS must define admin, owner, staff, and client');
  }
  const adminUserId = await upsertSeedUser(prisma, adminSeed, passwordHash, now);
  const ownerUserId = await upsertSeedUser(prisma, ownerSeed, passwordHash, now);
  const staffUserId = await upsertSeedUser(prisma, staffSeed, passwordHash, now);
  const clientUserId = await upsertSeedUser(prisma, clientSeed, passwordHash, now);

  const hair = await prisma.category.findUniqueOrThrow({
    where: { slug: DEMO_SALON.categorySlug },
    select: { id: true },
  });
  const beauty = await prisma.category.findUniqueOrThrow({
    where: { slug: PENDING_STUDIO.categorySlug },
    select: { id: true },
  });

  const demoBusinessId = await upsertBusiness(prisma, {
    preferredId: DEV_SEED_IDS.demoBusiness,
    name: DEMO_SALON.name,
    slug: DEMO_SALON.slug,
    categoryId: hair.id,
    city: DEMO_SALON.city,
    status: 'APPROVED',
    approvedAt: now,
    reviewedAt: now,
    reviewedByUserId: adminUserId,
    description: 'Dev seed Demo Salon — hair in Podgorica.',
    now,
  });

  const pendingBusinessId = await upsertBusiness(prisma, {
    preferredId: DEV_SEED_IDS.pendingBusiness,
    name: PENDING_STUDIO.name,
    slug: PENDING_STUDIO.slug,
    categoryId: beauty.id,
    city: PENDING_STUDIO.city,
    status: 'PENDING_APPROVAL',
    approvedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    description: 'Dev seed business awaiting platform approval.',
    now,
  });

  await prisma.$transaction(async (tx) => {
    await resetBusinessChildren(tx, demoBusinessId);
    await ensureOwnerMembership(
      tx,
      DEV_SEED_IDS.pendingOwnerMembership,
      ownerUserId,
      pendingBusinessId,
      now,
    );
    await seedDemoSalonContent(tx, {
      businessId: demoBusinessId,
      ownerUserId,
      staffUserId,
      now,
    });
  });

  return {
    adminUserId,
    ownerUserId,
    staffUserId,
    clientUserId,
    demoBusinessId,
    pendingBusinessId,
  };
}

async function upsertSeedUser(
  prisma: SeedDb,
  user: SeedUserSpec,
  passwordHash: string,
  now: Date,
): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true },
  });
  const userId = existing?.id ?? user.preferredId;

  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email: user.email,
      displayName: user.displayName,
      localePreference: 'en',
      isPlatformAdmin: user.isPlatformAdmin,
      emailVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      email: user.email,
      displayName: user.displayName,
      localePreference: 'en',
      isPlatformAdmin: user.isPlatformAdmin,
      emailVerifiedAt: now,
      deletedAt: null,
      updatedAt: now,
    },
  });

  const identity = await prisma.authIdentity.findUnique({
    where: { userId_provider: { userId, provider: 'PASSWORD' } },
    select: { id: true },
  });

  if (identity) {
    await prisma.authIdentity.update({
      where: { id: identity.id },
      data: { passwordHash, providerAccountId: null, updatedAt: now },
    });
  } else {
    await prisma.authIdentity.create({
      data: {
        id: user.preferredIdentityId,
        userId,
        provider: 'PASSWORD',
        passwordHash,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return userId;
}

async function upsertBusiness(
  prisma: SeedDb,
  input: {
    preferredId: string;
    name: string;
    slug: string;
    categoryId: string;
    city: 'PODGORICA' | 'BUDVA';
    status: 'APPROVED' | 'PENDING_APPROVAL';
    approvedAt: Date | null;
    reviewedAt: Date | null;
    reviewedByUserId: string | null;
    description: string;
    now: Date;
  },
): Promise<string> {
  const byId = await prisma.business.findUnique({
    where: { id: input.preferredId },
    select: {
      id: true,
      approvedAt: true,
      reviewedAt: true,
      reviewedByUserId: true,
      status: true,
    },
  });
  const bySlug = await prisma.business.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });

  // Never take over a user-created business that only shares the demo slug.
  if (bySlug && bySlug.id !== input.preferredId) {
    throw new Error(
      `Dev seed refused: slug "${input.slug}" belongs to business ${bySlug.id}, expected ${input.preferredId}. Rename or delete the conflicting business.`,
    );
  }

  const businessId = input.preferredId;
  const keepApproval =
    input.status === 'APPROVED' &&
    byId !== null &&
    byId.status === 'APPROVED' &&
    byId.approvedAt !== null;

  await prisma.business.upsert({
    where: { id: businessId },
    create: {
      id: businessId,
      name: input.name,
      slug: input.slug,
      categoryId: input.categoryId,
      description: input.description,
      timezone: 'Europe/Podgorica',
      city: input.city,
      confirmationMode: 'AUTO',
      cancellationWindowMinutes: 120,
      minBookingNoticeMinutes: 60,
      bookingHorizonDays: 60,
      status: input.status,
      approvedAt: input.approvedAt,
      reviewedAt: input.reviewedAt,
      reviewedByUserId: input.reviewedByUserId,
      rejectionReason: null,
      createdAt: input.now,
      updatedAt: input.now,
    },
    update: {
      name: input.name,
      slug: input.slug,
      categoryId: input.categoryId,
      description: input.description,
      timezone: 'Europe/Podgorica',
      city: input.city,
      confirmationMode: 'AUTO',
      cancellationWindowMinutes: 120,
      minBookingNoticeMinutes: 60,
      bookingHorizonDays: 60,
      status: input.status,
      // Keep the first approval timestamps stable across re-seeds.
      approvedAt: keepApproval ? byId.approvedAt : input.approvedAt,
      reviewedAt: keepApproval ? byId.reviewedAt : input.reviewedAt,
      reviewedByUserId: keepApproval ? byId.reviewedByUserId : input.reviewedByUserId,
      rejectionReason: null,
      deletedAt: null,
      updatedAt: input.now,
    },
  });

  return businessId;
}

/** Drop configuration children so a re-seed always matches the documented Demo Salon shape. */
async function resetBusinessChildren(prisma: SeedDb, businessId: string): Promise<void> {
  await prisma.invitation.deleteMany({ where: { businessId } });
  await prisma.serviceStaffAssignment.deleteMany({
    where: { service: { businessId } },
  });
  await prisma.serviceCustomFieldDefinition.deleteMany({
    where: { service: { businessId } },
  });
  await prisma.service.deleteMany({ where: { businessId } });
  await prisma.membership.updateMany({
    where: { businessId },
    data: { staffMemberId: null },
  });
  await prisma.workingHours.deleteMany({
    where: { staffMember: { businessId } },
  });
  await prisma.timeOff.deleteMany({
    where: { staffMember: { businessId } },
  });
  await prisma.membership.deleteMany({
    where: { businessId, role: { not: 'OWNER' } },
  });
  await prisma.staffMember.deleteMany({ where: { businessId } });
}

async function ensureOwnerMembership(
  prisma: SeedDb,
  preferredId: string,
  userId: string,
  businessId: string,
  now: Date,
): Promise<void> {
  const existing = await prisma.membership.findUnique({
    where: { userId_businessId: { userId, businessId } },
    select: { id: true },
  });
  const membershipId = existing?.id ?? preferredId;

  await prisma.membership.upsert({
    where: { id: membershipId },
    create: {
      id: membershipId,
      userId,
      businessId,
      role: 'OWNER',
      createdAt: now,
      updatedAt: now,
    },
    update: {
      role: 'OWNER',
      staffMemberId: null,
      updatedAt: now,
    },
  });
}

async function seedDemoSalonContent(
  prisma: SeedDb,
  input: {
    businessId: string;
    ownerUserId: string;
    staffUserId: string;
    now: Date;
  },
): Promise<void> {
  const { businessId, ownerUserId, staffUserId, now } = input;

  await prisma.staffMember.createMany({
    data: [
      {
        id: DEV_SEED_IDS.staffAna,
        businessId,
        displayName: 'Ana',
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: DEV_SEED_IDS.staffMarko,
        businessId,
        displayName: 'Marko',
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  });

  await ensureOwnerMembership(
    prisma,
    DEV_SEED_IDS.demoOwnerMembership,
    ownerUserId,
    businessId,
    now,
  );

  const staffMembership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: staffUserId, businessId } },
    select: { id: true },
  });
  const staffMembershipId = staffMembership?.id ?? DEV_SEED_IDS.demoStaffMembership;

  await prisma.membership.upsert({
    where: { id: staffMembershipId },
    create: {
      id: staffMembershipId,
      userId: staffUserId,
      businessId,
      role: 'STAFF',
      staffMemberId: DEV_SEED_IDS.staffMarko,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      role: 'STAFF',
      staffMemberId: DEV_SEED_IDS.staffMarko,
      updatedAt: now,
    },
  });

  const hoursRows = [DEV_SEED_IDS.staffAna, DEV_SEED_IDS.staffMarko].flatMap((staffMemberId) =>
    DEMO_WEEKDAYS.flatMap((weekday) =>
      DEMO_WEEKDAY_INTERVALS.map((interval) => ({
        id: newId(),
        staffMemberId,
        weekday,
        startMinute: interval.startMinute,
        endMinute: interval.endMinute,
        createdAt: now,
        updatedAt: now,
      })),
    ),
  );
  await prisma.workingHours.createMany({ data: hoursRows });

  await prisma.service.createMany({
    data: [
      {
        id: DEV_SEED_IDS.serviceHaircut,
        businessId,
        name: 'Haircut',
        description: 'Classic cut and finish.',
        durationMinutes: 45,
        priceAmount: 2500,
        priceCurrency: 'EUR',
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: DEV_SEED_IDS.serviceColor,
        businessId,
        name: 'Color',
        description: 'Full color treatment.',
        durationMinutes: 90,
        priceAmount: 5500,
        priceCurrency: 'EUR',
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: DEV_SEED_IDS.serviceConsult,
        businessId,
        name: 'Consultation',
        description: 'Style advice before a visit.',
        durationMinutes: 30,
        priceAmount: 1000,
        priceCurrency: 'EUR',
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  });

  await prisma.serviceCustomFieldDefinition.create({
    data: {
      id: DEV_SEED_IDS.customFieldNotes,
      serviceId: DEV_SEED_IDS.serviceConsult,
      key: 'client_notes',
      label: 'Client notes',
      type: 'TEXT',
      required: false,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    },
  });

  const assignments = [
    DEV_SEED_IDS.serviceHaircut,
    DEV_SEED_IDS.serviceColor,
    DEV_SEED_IDS.serviceConsult,
  ].flatMap((serviceId) =>
    [DEV_SEED_IDS.staffAna, DEV_SEED_IDS.staffMarko].map((staffMemberId) => ({
      id: newId(),
      serviceId,
      staffMemberId,
      createdAt: now,
    })),
  );
  await prisma.serviceStaffAssignment.createMany({ data: assignments });
}
