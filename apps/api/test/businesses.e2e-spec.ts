import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { businessSchema, myBusinessesResponseSchema } from '@najme/contracts';
import { configureApp } from '../src/app.setup.js';
import { AppModule } from '../src/app.module.js';
import { Clock, FixedClock } from '../src/common/clock.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  BusinessTestTracker,
  addMember,
  collectBusinessIdRoutes,
  createBusiness,
  createUser,
  expectBusinessAuthz,
} from './support/business-factories.js';

const FIXED_NOW = new Date('2026-06-15T12:00:00.000Z');

describe('Businesses (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tracker: BusinessTestTracker;
  let clock: FixedClock;

  beforeAll(async () => {
    clock = new FixedClock(FIXED_NOW);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue(clock)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    tracker = new BusinessTestTracker();
    clock.set(FIXED_NOW);
  });

  afterEach(async () => {
    await tracker.cleanup(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a business, lists it on /me/businesses, and returns FixedClock timestamps', async () => {
    const owner = await createUser(app, tracker, 'owner');
    const business = await createBusiness(app, tracker, owner, { name: 'Čarolija Spa' });

    expect(business.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(business.slug.length).toBeGreaterThanOrEqual(3);

    const mine = await request(app.getHttpServer())
      .get('/api/v1/me/businesses')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(mine.status).toBe(200);
    const list = myBusinessesResponseSchema.parse(mine.body);
    expect(list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          businessId: business.id,
          role: 'OWNER',
          staffMemberId: null,
          logoUrl: null,
        }),
      ]),
    );

    const got = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(got.status).toBe(200);
    const body = businessSchema.parse(got.body);
    expect(body).toMatchObject({
      id: business.id,
      myRole: 'OWNER',
      timezone: 'Europe/Podgorica',
      status: 'PENDING_APPROVAL',
      confirmationMode: 'AUTO',
      cancellationWindowMinutes: 120,
      minBookingNoticeMinutes: 60,
      bookingHorizonDays: 60,
      createdAt: FIXED_NOW.toISOString(),
      updatedAt: FIXED_NOW.toISOString(),
    });
  });

  it('suffixes -2 when a second business reuses the same name', async () => {
    const owner = await createUser(app, tracker, 'dup-name');
    const first = await createBusiness(app, tracker, owner, { name: 'Unique Collision Spa' });
    const second = await createBusiness(app, tracker, owner, { name: 'Unique Collision Spa' });
    expect(first.slug).toBe('unique-collision-spa');
    expect(second.slug).toBe('unique-collision-spa-2');
  });

  it('rejects an unknown category with 422 VALIDATION_FAILED', async () => {
    const owner = await createUser(app, tracker, 'cat');
    const res = await request(app.getHttpServer())
      .post('/api/v1/businesses')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'No Category',
        categoryId: randomUUID(),
        city: 'BUDVA',
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('throttles create to 5 per hour per user; another user is unaffected', async () => {
    const owner = await createUser(app, tracker, 'throttle-a');
    const other = await createUser(app, tracker, 'throttle-b');
    const category = (await prisma.category.findFirstOrThrow({ select: { id: true } })).id;
    const sharedIp = '198.51.100.77';

    for (let i = 0; i < 5; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/businesses')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('Content-Type', 'application/json')
        .set('X-Forwarded-For', sharedIp)
        .send({ name: `Throttle A ${i}`, categoryId: category, city: 'PODGORICA' });
      expect(res.status).toBe(201);
      tracker.businessIds.push(res.body.id as string);
    }

    const limited = await request(app.getHttpServer())
      .post('/api/v1/businesses')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .set('X-Forwarded-For', sharedIp)
      .send({ name: 'Throttle A overflow', categoryId: category, city: 'PODGORICA' });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');

    const otherOk = await request(app.getHttpServer())
      .post('/api/v1/businesses')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .set('Content-Type', 'application/json')
      .set('X-Forwarded-For', sharedIp)
      .send({ name: 'Throttle B first', categoryId: category, city: 'PODGORICA' });
    expect(otherOk.status).toBe(201);
    tracker.businessIds.push(otherOk.body.id as string);
  });

  it('GET allows all members; PATCH OWNER/ADMIN only', async () => {
    await expectBusinessAuthz(app, tracker, {
      method: 'get',
      path: (id) => `/api/v1/businesses/${id}`,
      allowedRoles: ['OWNER', 'ADMIN', 'STAFF'],
    });
    await expectBusinessAuthz(app, tracker, {
      method: 'patch',
      path: (id) => `/api/v1/businesses/${id}`,
      allowedRoles: ['OWNER', 'ADMIN'],
      body: { description: 'Updated' },
    });
  });

  it('DELETE soft-deletes for OWNER only; afterwards routes return 404', async () => {
    const owner = await createUser(app, tracker, 'del-owner');
    const business = await createBusiness(app, tracker, owner);
    const admin = await createUser(app, tracker, 'del-admin');
    const staff = await createUser(app, tracker, 'del-staff');
    await addMember(app, business.id, admin.id, 'ADMIN');
    await addMember(app, business.id, staff.id, 'STAFF');

    const adminForbidden = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(adminForbidden.status).toBe(403);

    const staffForbidden = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}`)
      .set('Authorization', `Bearer ${staff.accessToken}`);
    expect(staffForbidden.status).toBe(403);

    const deleted = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(deleted.status).toBe(204);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(after.status).toBe(404);
  });

  it('returns 409 SLUG_TAKEN for live and soft-deleted slugs; SLUG_LOCKED after approval', async () => {
    const owner = await createUser(app, tracker, 'slug-owner');
    const first = await createBusiness(app, tracker, owner, { name: 'Alpha Shop' });
    const second = await createBusiness(app, tracker, owner, { name: 'Beta Shop' });

    const taken = await request(app.getHttpServer())
      .patch(`/api/v1/businesses/${second.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ slug: first.slug });
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe('SLUG_TAKEN');

    await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${first.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const takenDeleted = await request(app.getHttpServer())
      .patch(`/api/v1/businesses/${second.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ slug: first.slug });
    expect(takenDeleted.status).toBe(409);
    expect(takenDeleted.body.error.code).toBe('SLUG_TAKEN');

    await prisma.business.update({
      where: { id: second.id },
      data: { status: 'APPROVED', approvedAt: FIXED_NOW },
    });
    const locked = await request(app.getHttpServer())
      .patch(`/api/v1/businesses/${second.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ slug: `locked-${randomUUID().slice(0, 8)}` });
    expect(locked.status).toBe(422);
    expect(locked.body.error.code).toBe('SLUG_LOCKED');

    // Same slug on an approved business is a no-op (not SLUG_LOCKED).
    const sameSlug = await request(app.getHttpServer())
      .patch(`/api/v1/businesses/${second.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ slug: second.slug, description: 'still ok' });
    expect(sameSlug.status).toBe(200);
  });

  it('route-walker: every :businessId route returns 404 for non-member, random id, and malformed id', async () => {
    const owner = await createUser(app, tracker, 'walk-owner');
    const business = await createBusiness(app, tracker, owner);
    const outsider = await createUser(app, tracker, 'walk-out');
    const routes = collectBusinessIdRoutes(app);
    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
      const method = route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'put' | 'delete';
      const randomPath = route.path.replace(':businessId', randomUUID());
      const memberPath = route.path.replace(':businessId', business.id);
      const badPath = route.path.replace(':businessId', 'not-a-uuid');

      const randomRes = await request(app.getHttpServer())
        [method](randomPath)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('Content-Type', 'application/json')
        .send({});
      expect(randomRes.status, `${route.method} ${randomPath}`).toBe(404);
      expect(randomRes.body.error?.code).toBe('NOT_FOUND');

      const outsiderRes = await request(app.getHttpServer())
        [method](memberPath)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .set('Content-Type', 'application/json')
        .send({});
      expect(outsiderRes.status, `${route.method} ${memberPath} outsider`).toBe(404);
      expect(outsiderRes.body.error?.code).toBe('NOT_FOUND');

      const badRes = await request(app.getHttpServer())
        [method](badPath)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('Content-Type', 'application/json')
        .send({});
      expect(badRes.status, `${route.method} ${badPath}`).toBe(404);
      expect(badRes.body.error?.code).toBe('NOT_FOUND');
    }
  });
});
