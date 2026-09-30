import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { AppModule } from '../src/app.module.js';
import { Clock, FixedClock } from '../src/common/clock.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  BusinessTestTracker,
  addMember,
  collectAdminRoutes,
  createBusiness,
  createUser,
} from './support/business-factories.js';

const FIXED_NOW = new Date('2026-06-15T12:00:00.000Z');

describe('Platform-admin moderation (e2e)', () => {
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

  async function grantAdmin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { isPlatformAdmin: true },
    });
  }

  it('exposes isPlatformAdmin on GET /me', async () => {
    const user = await createUser(app, tracker, 'me-flag');
    const before = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${user.accessToken}`);
    expect(before.status).toBe(200);
    expect(before.body.isPlatformAdmin).toBe(false);

    await grantAdmin(user.id);
    const after = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${user.accessToken}`);
    expect(after.body.isPlatformAdmin).toBe(true);
  });

  it('lists pending businesses, approves, rejects, and allows resubmit', async () => {
    const admin = await createUser(app, tracker, 'padmin');
    await grantAdmin(admin.id);
    const owner = await createUser(app, tracker, 'biz-own');
    const business = await createBusiness(app, tracker, owner);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/businesses')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.items.some((b: { id: string }) => b.id === business.id)).toBe(true);
    const item = listed.body.items.find((b: { id: string }) => b.id === business.id);
    expect(item.ownerEmail).toBe(owner.email);
    expect(item.categoryName).toBeTruthy();
    expect(item.staffCount).toBeGreaterThanOrEqual(0);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/businesses/${business.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.id).toBe(business.id);

    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/admin/businesses/${business.id}/reject`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ reason: 'Incomplete profile details.' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe('REJECTED');
    expect(rejected.body.rejectionReason).toBe('Incomplete profile details.');

    const badReject = await request(app.getHttpServer())
      .post(`/api/v1/admin/businesses/${business.id}/reject`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ reason: 'Already rejected once more.' });
    expect(badReject.status).toBe(409);
    expect(badReject.body.error.code).toBe('CONFLICT');

    const resubmitted = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/resubmit`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.status).toBe('PENDING_APPROVAL');

    const approved = await request(app.getHttpServer())
      .post(`/api/v1/admin/businesses/${business.id}/approve`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APPROVED');
    expect(approved.body.approvedAt).toBeTruthy();

    const badApprove = await request(app.getHttpServer())
      .post(`/api/v1/admin/businesses/${business.id}/approve`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(badApprove.status).toBe(409);

    const badResubmit = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/resubmit`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(badResubmit.status).toBe(409);
  });

  it('route-walker: every /admin/* route returns 403 for a non-admin', async () => {
    const user = await createUser(app, tracker, 'not-admin');
    const routes = collectAdminRoutes(app);
    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
      const method = route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'put' | 'delete';
      const path = route.path
        .replace(':businessId', randomUUID())
        .replace(/^\/api\/v1/, '')
        .replace(/^\//, '');
      const url = path.startsWith('api/') ? `/${path}` : `/api/v1/${path}`;

      const res = await request(app.getHttpServer())
        [method](url)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('Content-Type', 'application/json')
        .send({ reason: 'Not enough detail here for reject.' });
      expect(res.status, `${route.method} ${url}`).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    }
  });

  it('enforces OWNER/ADMIN on resubmit', async () => {
    const owner = await createUser(app, tracker, 'rs-own');
    const admin = await createUser(app, tracker, 'rs-adm');
    const staff = await createUser(app, tracker, 'rs-stf');
    const outsider = await createUser(app, tracker, 'rs-out');
    const business = await createBusiness(app, tracker, owner);
    await addMember(app, business.id, admin.id, 'ADMIN');
    await addMember(app, business.id, staff.id, 'STAFF');

    const denyOut = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/resubmit`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);
    expect(denyOut.status).toBe(404);

    await prisma.business.update({
      where: { id: business.id },
      data: { status: 'REJECTED', rejectionReason: 'Needs more photos and description.' },
    });
    const denyStaff = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/resubmit`)
      .set('Authorization', `Bearer ${staff.accessToken}`);
    expect(denyStaff.status).toBe(403);

    const okAdmin = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/resubmit`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(okAdmin.status).toBe(200);

    await prisma.business.update({
      where: { id: business.id },
      data: { status: 'REJECTED', rejectionReason: 'Needs more photos and description.' },
    });
    const okOwner = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/resubmit`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(okOwner.status).toBe(200);
  });
});
