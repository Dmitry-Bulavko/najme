import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { businessSchema, myBusinessesResponseSchema } from '@najme/contracts';
import { configureApp } from '../src/app.setup.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  BusinessTestTracker,
  addMember,
  collectBusinessIdRoutes,
  createBusiness,
  createUser,
  expectBusinessAuthz,
} from './support/business-factories.js';

describe('Businesses (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tracker: BusinessTestTracker;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    tracker = new BusinessTestTracker();
  });

  afterEach(async () => {
    await tracker.cleanup(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a business, lists it on /me/businesses, and returns it to members', async () => {
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
    });
  });

  it('rejects an unknown category with 422 VALIDATION_FAILED', async () => {
    const owner = await createUser(app, tracker, 'cat');
    const res = await request(app.getHttpServer())
      .post('/api/v1/businesses')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .set('X-Forwarded-For', `198.51.100.${Math.floor(Math.random() * 200)}`)
      .send({
        name: 'No Category',
        categoryId: randomUUID(),
        city: 'BUDVA',
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('PATCH updates profile for OWNER/ADMIN and forbids STAFF', async () => {
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
    await addMember(app, business.id, admin.id, 'ADMIN');

    const forbidden = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(forbidden.status).toBe(403);

    const deleted = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(deleted.status).toBe(204);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(after.status).toBe(404);
  });

  it('returns 409 SLUG_TAKEN and 422 SLUG_LOCKED when appropriate', async () => {
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

    await prisma.business.update({
      where: { id: first.id },
      data: { status: 'APPROVED' },
    });
    const locked = await request(app.getHttpServer())
      .patch(`/api/v1/businesses/${first.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ slug: `locked-${randomUUID().slice(0, 8)}` });
    expect(locked.status).toBe(422);
    expect(locked.body.error.code).toBe('SLUG_LOCKED');
  });

  it('route-walker: every :businessId route returns 404 for non-member and random id', async () => {
    const owner = await createUser(app, tracker, 'walk-owner');
    const business = await createBusiness(app, tracker, owner);
    const outsider = await createUser(app, tracker, 'walk-out');
    const routes = collectBusinessIdRoutes(app);
    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
      const method = route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'put' | 'delete';
      const randomPath = route.path.replace(':businessId', randomUUID());
      const memberPath = route.path.replace(':businessId', business.id);

      const randomRes = await request(app.getHttpServer())
        [method](randomPath)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('Content-Type', 'application/json')
        .send({});
      expect(randomRes.status, `${route.method} ${randomPath}`).toBe(404);

      const outsiderRes = await request(app.getHttpServer())
        [method](memberPath)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .set('Content-Type', 'application/json')
        .send({});
      expect(outsiderRes.status, `${route.method} ${memberPath} outsider`).toBe(404);
    }
  });
});
