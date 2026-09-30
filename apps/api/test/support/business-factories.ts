import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { MembershipRole } from '@najme/contracts';
import request from 'supertest';
import { expect } from 'vitest';
import { AuthService } from '../../src/auth/auth.service.js';
import { PasswordService } from '../../src/auth/password.service.js';
import { newId } from '../../src/common/id.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { UsersService } from '../../src/users/users.service.js';

const PASSWORD = 'correct horse battery';

export type TestUser = {
  id: string;
  email: string;
  accessToken: string;
};

export type TestBusiness = {
  id: string;
  slug: string;
  ownerId: string;
};

/** Tracks rows created by factories so e2e `afterEach` can delete them (RESTRICT FKs). */
export class BusinessTestTracker {
  readonly userIds: string[] = [];
  readonly businessIds: string[] = [];

  async cleanup(prisma: PrismaService): Promise<void> {
    if (this.businessIds.length > 0) {
      const ids = [...this.businessIds];
      await prisma.serviceStaffAssignment.deleteMany({
        where: { service: { businessId: { in: ids } } },
      });
      await prisma.serviceCustomFieldDefinition.deleteMany({
        where: { service: { businessId: { in: ids } } },
      });
      await prisma.service.deleteMany({ where: { businessId: { in: ids } } });
      await prisma.membership.updateMany({
        where: { businessId: { in: ids } },
        data: { staffMemberId: null },
      });
      await prisma.staffMember.deleteMany({ where: { businessId: { in: ids } } });
      await prisma.membership.deleteMany({ where: { businessId: { in: ids } } });
      await prisma.business.deleteMany({ where: { id: { in: this.businessIds.splice(0) } } });
    }
    if (this.userIds.length > 0) {
      await prisma.membership.deleteMany({ where: { userId: { in: [...this.userIds] } } });
      await prisma.user.deleteMany({ where: { id: { in: this.userIds.splice(0) } } });
    }
  }
}

export async function createUser(
  app: INestApplication,
  tracker: BusinessTestTracker,
  label = 'user',
): Promise<TestUser> {
  const users = app.get(UsersService);
  const passwords = app.get(PasswordService);
  const auth = app.get(AuthService);
  const email = `${label}-${randomUUID()}@example.com`;
  const passwordHash = await passwords.hash(PASSWORD);
  const user = await users.createWithPassword({
    email,
    passwordHash,
    localePreference: 'en',
  });
  tracker.userIds.push(user.id);
  const session = await auth.login(
    { email, password: PASSWORD },
    { userAgent: 'e2e', ipAddress: '127.0.0.1' },
  );
  return { id: user.id, email, accessToken: session.accessToken };
}

export async function createBusiness(
  app: INestApplication,
  tracker: BusinessTestTracker,
  owner: TestUser,
  overrides: { name?: string; city?: string; categoryId?: string } = {},
): Promise<TestBusiness> {
  const prisma = app.get(PrismaService);
  const category =
    overrides.categoryId ?? (await prisma.category.findFirstOrThrow({ select: { id: true } })).id;

  const res = await request(app.getHttpServer())
    .post('/api/v1/businesses')
    .set('Authorization', `Bearer ${owner.accessToken}`)
    .set('Content-Type', 'application/json')
    .send({
      name: overrides.name ?? `Salon ${randomUUID().slice(0, 8)}`,
      categoryId: category,
      city: overrides.city ?? 'PODGORICA',
    });

  expect(res.status).toBe(201);
  tracker.businessIds.push(res.body.id as string);
  return { id: res.body.id as string, slug: res.body.slug as string, ownerId: owner.id };
}

export async function addMember(
  app: INestApplication,
  businessId: string,
  userId: string,
  role: MembershipRole,
): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.membership.create({
    data: {
      id: newId(),
      userId,
      businessId,
      role,
    },
  });
}

type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

/**
 * Asserts non-member → 404 and disallowed roles → 403 for a business-scoped route.
 * `allowedRoles` lists roles that must succeed (2xx).
 * Optional `prepare` runs after the business exists (e.g. create a staff member for nested paths).
 */
export async function expectBusinessAuthz(
  app: INestApplication,
  tracker: BusinessTestTracker,
  opts: {
    method: HttpMethod;
    path: (businessId: string) => string;
    allowedRoles: MembershipRole[];
    body?: unknown;
    prepare?: (ctx: {
      app: INestApplication;
      businessId: string;
      ownerAccessToken: string;
    }) => Promise<void>;
  },
): Promise<void> {
  const owner = await createUser(app, tracker, 'owner');
  const business = await createBusiness(app, tracker, owner);
  if (opts.prepare) {
    await opts.prepare({
      app,
      businessId: business.id,
      ownerAccessToken: owner.accessToken,
    });
  }
  const outsider = await createUser(app, tracker, 'outsider');

  const outsiderRes = await request(app.getHttpServer())
    [opts.method](opts.path(business.id))
    .set('Authorization', `Bearer ${outsider.accessToken}`)
    .set('Content-Type', 'application/json')
    .send(opts.body ?? {});
  expect(outsiderRes.status).toBe(404);
  expect(outsiderRes.body.error?.code).toBe('NOT_FOUND');

  const allRoles: MembershipRole[] = ['OWNER', 'ADMIN', 'STAFF'];
  for (const role of allRoles) {
    let token = owner.accessToken;
    if (role !== 'OWNER') {
      const member = await createUser(app, tracker, role.toLowerCase());
      await addMember(app, business.id, member.id, role);
      token = member.accessToken;
    }

    const res = await request(app.getHttpServer())
      [opts.method](opts.path(business.id))
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send(opts.body ?? {});

    if (opts.allowedRoles.includes(role)) {
      expect(res.status).toBeLessThan(400);
    } else {
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    }
  }
}

/** Express layers that declare a `:businessId` path param. */
export function collectBusinessIdRoutes(
  app: INestApplication,
): Array<{ method: string; path: string }> {
  const instance = app.getHttpAdapter().getInstance() as {
    router?: { stack?: Array<{ route?: { path: string; methods: Record<string, boolean> } }> };
    _router?: { stack?: Array<{ route?: { path: string; methods: Record<string, boolean> } }> };
  };
  const stack = instance.router?.stack ?? instance._router?.stack ?? [];
  const routes: Array<{ method: string; path: string }> = [];
  for (const layer of stack) {
    const route = layer.route;
    if (!route?.path.includes(':businessId')) {
      continue;
    }
    for (const [method, on] of Object.entries(route.methods)) {
      if (on) {
        routes.push({ method: method.toUpperCase(), path: route.path });
      }
    }
  }
  return routes;
}
