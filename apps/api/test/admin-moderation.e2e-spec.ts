import 'reflect-metadata';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
const __dirname = dirname(fileURLToPath(import.meta.url));
const adminFlagScript = resolve(__dirname, '../scripts/admin-flag.mjs');

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

  it('revokes admin access immediately and rejects soft-deleted admins', async () => {
    const admin = await createUser(app, tracker, 'rev-admin');
    await grantAdmin(admin.id);

    const ok = await request(app.getHttpServer())
      .get('/api/v1/admin/businesses')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(ok.status).toBe(200);

    await prisma.user.update({
      where: { id: admin.id },
      data: { isPlatformAdmin: false },
    });
    const revoked = await request(app.getHttpServer())
      .get('/api/v1/admin/businesses')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(revoked.status).toBe(403);

    await grantAdmin(admin.id);
    await prisma.user.update({
      where: { id: admin.id },
      data: { deletedAt: FIXED_NOW },
    });
    const deleted = await request(app.getHttpServer())
      .get('/api/v1/admin/businesses')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(deleted.status).toBe(403);
  });

  it('lists with default PENDING filter, status filter, counts, and cursor pagination', async () => {
    const admin = await createUser(app, tracker, 'list-admin');
    await grantAdmin(admin.id);
    const owner = await createUser(app, tracker, 'list-own');
    const pendingA = await createBusiness(app, tracker, owner, { name: 'Pending A' });
    const pendingB = await createBusiness(app, tracker, owner, { name: 'Pending B' });
    const rejectedBiz = await createBusiness(app, tracker, owner, { name: 'Rejected Biz' });
    await prisma.business.update({
      where: { id: rejectedBiz.id },
      data: { status: 'REJECTED', rejectionReason: 'Missing photos and hours.' },
    });

    const defaults = await request(app.getHttpServer())
      .get('/api/v1/admin/businesses')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(defaults.status).toBe(200);
    expect(
      defaults.body.items.every((b: { status: string }) => b.status === 'PENDING_APPROVAL'),
    ).toBe(true);
    const pendingIds = defaults.body.items.map((b: { id: string }) => b.id);
    expect(pendingIds).toContain(pendingA.id);
    expect(pendingIds).toContain(pendingB.id);
    expect(pendingIds).not.toContain(rejectedBiz.id);

    const idxA = pendingIds.indexOf(pendingA.id);
    const idxB = pendingIds.indexOf(pendingB.id);
    expect(idxA).toBeLessThan(idxB);

    const itemA = defaults.body.items.find((b: { id: string }) => b.id === pendingA.id);
    expect(itemA.staffCount).toBe(0);
    expect(itemA.servicesCount).toBe(0);
    expect(itemA.staffWithWorkingHoursCount).toBe(0);

    const rejectedList = await request(app.getHttpServer())
      .get('/api/v1/admin/businesses?status=REJECTED')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(rejectedList.status).toBe(200);
    expect(rejectedList.body.items.some((b: { id: string }) => b.id === rejectedBiz.id)).toBe(true);

    const page1 = await request(app.getHttpServer())
      .get('/api/v1/admin/businesses?limit=1')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(1);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2 = await request(app.getHttpServer())
      .get(`/api/v1/admin/businesses?limit=1&cursor=${page1.body.nextCursor}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(page2.status).toBe(200);
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.items[0].id).not.toBe(page1.body.items[0].id);

    const garbage = await request(app.getHttpServer())
      .get('/api/v1/admin/businesses?cursor=not-a-cursor')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(garbage.status).toBe(400);

    const crafted = Buffer.from(
      JSON.stringify({ createdAt: 'not-a-date', id: 'also-not-uuid' }),
      'utf8',
    ).toString('base64url');
    const craftedRes = await request(app.getHttpServer())
      .get(`/api/v1/admin/businesses?cursor=${crafted}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(craftedRes.status).toBe(400);
  });

  it('lists ownerless businesses without failing the queue', async () => {
    const admin = await createUser(app, tracker, 'ownless-adm');
    await grantAdmin(admin.id);
    const owner = await createUser(app, tracker, 'ownless-own');
    const business = await createBusiness(app, tracker, owner);
    await prisma.membership.deleteMany({ where: { businessId: business.id, role: 'OWNER' } });

    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/businesses')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(listed.status).toBe(200);
    const item = listed.body.items.find((b: { id: string }) => b.id === business.id);
    expect(item).toBeTruthy();
    expect(item.ownerEmail).toBeNull();
    expect(item.ownerEmailVerified).toBeNull();

    const approved = await request(app.getHttpServer())
      .post(`/api/v1/admin/businesses/${business.id}/approve`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APPROVED');
    expect(approved.body.ownerEmail).toBeNull();
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
    expect(item.staffCount).toBe(0);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/businesses/${business.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.id).toBe(business.id);

    const shortReason = await request(app.getHttpServer())
      .post(`/api/v1/admin/businesses/${business.id}/reject`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ reason: '123456789' });
    expect(shortReason.status).toBe(400);

    const longReason = await request(app.getHttpServer())
      .post(`/api/v1/admin/businesses/${business.id}/reject`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ reason: 'x'.repeat(501) });
    expect(longReason.status).toBe(400);

    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/admin/businesses/${business.id}/reject`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ reason: 'Incomplete profile details.' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe('REJECTED');
    expect(rejected.body.rejectionReason).toBe('Incomplete profile details.');
    expect(rejected.body.reviewedAt).toBe(FIXED_NOW.toISOString());
    const afterReject = await prisma.business.findUniqueOrThrow({ where: { id: business.id } });
    expect(afterReject.reviewedByUserId).toBe(admin.id);

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
    expect(approved.body.approvedAt).toBe(FIXED_NOW.toISOString());
    expect(approved.body.reviewedAt).toBe(FIXED_NOW.toISOString());
    expect(approved.body.rejectionReason).toBeNull();
    const afterApprove = await prisma.business.findUniqueOrThrow({ where: { id: business.id } });
    expect(afterApprove.reviewedByUserId).toBe(admin.id);

    const rejectApproved = await request(app.getHttpServer())
      .post(`/api/v1/admin/businesses/${business.id}/reject`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ reason: 'Cannot reject an approved business.' });
    expect(rejectApproved.status).toBe(409);

    const badApprove = await request(app.getHttpServer())
      .post(`/api/v1/admin/businesses/${business.id}/approve`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(badApprove.status).toBe(409);

    const badResubmit = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/resubmit`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(badResubmit.status).toBe(409);
  });

  it('approves REJECTED businesses directly and 404s missing ids', async () => {
    const admin = await createUser(app, tracker, 'rej-appr');
    await grantAdmin(admin.id);
    const owner = await createUser(app, tracker, 'rej-own');
    const business = await createBusiness(app, tracker, owner);
    await prisma.business.update({
      where: { id: business.id },
      data: { status: 'REJECTED', rejectionReason: 'Fix the address and phone.' },
    });

    const approved = await request(app.getHttpServer())
      .post(`/api/v1/admin/businesses/${business.id}/approve`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APPROVED');
    expect(approved.body.rejectionReason).toBeNull();

    const missingId = randomUUID();
    const missingApprove = await request(app.getHttpServer())
      .post(`/api/v1/admin/businesses/${missingId}/approve`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(missingApprove.status).toBe(404);

    const missingReject = await request(app.getHttpServer())
      .post(`/api/v1/admin/businesses/${missingId}/reject`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ reason: 'Business does not exist at all.' });
    expect(missingReject.status).toBe(404);
  });

  it('CLI exits 1 for an unknown email', () => {
    const result = spawnSync(process.execPath, [adminFlagScript, 'grant', 'nobody@example.com'], {
      encoding: 'utf8',
      env: process.env,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/No user found/i);
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
