import 'reflect-metadata';
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
  createBusiness,
  createUser,
  expectBusinessAuthz,
} from './support/business-factories.js';

describe('Working hours and time off (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tracker: BusinessTestTracker;
  let clock: FixedClock;

  beforeAll(async () => {
    clock = new FixedClock(new Date('2026-06-15T12:00:00.000Z'));
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
    clock.set(new Date('2026-06-15T12:00:00.000Z'));
  });

  afterEach(async () => {
    await tracker.cleanup(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createStaff(ownerToken: string, businessId: string, displayName = 'Scheduler') {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${businessId}/staff`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Content-Type', 'application/json')
      .send({ displayName });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function linkStaff(
    businessId: string,
    userId: string,
    staffMemberId: string,
  ): Promise<void> {
    await prisma.membership.update({
      where: { userId_businessId: { userId, businessId } },
      data: { staffMemberId },
    });
  }

  it('replaces working hours including 24:00 ends and reports validation details', async () => {
    const owner = await createUser(app, tracker, 'wh-owner');
    const business = await createBusiness(app, tracker, owner);
    const staffId = await createStaff(owner.accessToken, business.id);

    const put = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/staff/${staffId}/working-hours`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        intervals: [
          { weekday: 'MONDAY', start: '09:00', end: '12:00' },
          { weekday: 'MONDAY', start: '13:00', end: '24:00' },
        ],
      });
    expect(put.status).toBe(200);
    expect(put.body.intervals).toEqual([
      { weekday: 'MONDAY', start: '09:00', end: '12:00' },
      { weekday: 'MONDAY', start: '13:00', end: '24:00' },
    ]);

    const replaced = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/staff/${staffId}/working-hours`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        intervals: [{ weekday: 'TUESDAY', start: '10:00', end: '14:00' }],
      });
    expect(replaced.status).toBe(200);
    expect(replaced.body.intervals).toEqual([{ weekday: 'TUESDAY', start: '10:00', end: '14:00' }]);

    const invalid = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/staff/${staffId}/working-hours`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        intervals: [{ weekday: 'WEDNESDAY', start: '09:03', end: '12:00' }],
      });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error?.code).toBe('VALIDATION_FAILED');
    expect(invalid.body.error?.details?.issues).toEqual(expect.any(Array));
    expect(invalid.body.error.details.issues.length).toBeGreaterThan(0);
  });

  it('creates time off in business-local time stored as UTC', async () => {
    const owner = await createUser(app, tracker, 'to-owner');
    const business = await createBusiness(app, tracker, owner);
    const staffId = await createStaff(owner.accessToken, business.id);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff/${staffId}/time-off`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        start: '2026-01-15T09:00',
        end: '2026-01-15T17:00',
        reason: 'Holiday',
      });
    expect(created.status).toBe(201);
    expect(created.body.startsAt).toBe('2026-01-15T08:00:00.000Z');
    expect(created.body.endsAt).toBe('2026-01-15T16:00:00.000Z');
    expect(created.body.conflictingBookings).toEqual([]);

    const tooLong = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff/${staffId}/time-off`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        start: '2026-01-01T00:00',
        end: '2027-01-03T00:00',
      });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error?.code).toBe('VALIDATION_FAILED');

    const badDate = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff/${staffId}/time-off`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        start: '2026-02-30T09:00',
        end: '2026-03-01T09:00',
      });
    expect(badDate.status).toBe(400);
  });

  it('lists upcoming time off by default and respects from/to; DELETE is idempotent via 404', async () => {
    const owner = await createUser(app, tracker, 'list-owner');
    const business = await createBusiness(app, tracker, owner);
    const staffId = await createStaff(owner.accessToken, business.id);

    const past = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff/${staffId}/time-off`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ start: '2026-05-01T09:00', end: '2026-05-01T17:00' });
    expect(past.status).toBe(201);

    const upcoming = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff/${staffId}/time-off`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ start: '2026-07-01T09:00', end: '2026-07-01T17:00' });
    expect(upcoming.status).toBe(201);

    const later = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff/${staffId}/time-off`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ start: '2026-08-01T09:00', end: '2026-08-01T17:00' });
    expect(later.status).toBe(201);

    const defaultList = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/staff/${staffId}/time-off`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(defaultList.status).toBe(200);
    expect(defaultList.body.map((row: { id: string }) => row.id)).toEqual([
      upcoming.body.id,
      later.body.id,
    ]);

    const ranged = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/staff/${staffId}/time-off`)
      .query({
        from: '2026-07-15T00:00:00.000Z',
        to: '2026-08-15T00:00:00.000Z',
      })
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(ranged.status).toBe(200);
    expect(ranged.body.map((row: { id: string }) => row.id)).toEqual([later.body.id]);

    const deleted = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}/staff/${staffId}/time-off/${upcoming.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(deleted.status).toBe(204);

    const again = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}/staff/${staffId}/time-off/${upcoming.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(again.status).toBe(404);
  });

  it('enforces business authz on schedule routes (OWNER/ADMIN; STAFF without link → 403)', async () => {
    let staffId = '';
    await expectBusinessAuthz(app, tracker, {
      method: 'get',
      path: (id) => `/api/v1/businesses/${id}/staff/${staffId}/working-hours`,
      allowedRoles: ['OWNER', 'ADMIN'],
      prepare: async ({ businessId, ownerAccessToken }) => {
        staffId = await createStaff(ownerAccessToken, businessId);
      },
    });

    let putStaffId = '';
    await expectBusinessAuthz(app, tracker, {
      method: 'put',
      path: (id) => `/api/v1/businesses/${id}/staff/${putStaffId}/working-hours`,
      allowedRoles: ['OWNER', 'ADMIN'],
      body: { intervals: [] },
      prepare: async ({ businessId, ownerAccessToken }) => {
        putStaffId = await createStaff(ownerAccessToken, businessId);
      },
    });

    let listStaffId = '';
    await expectBusinessAuthz(app, tracker, {
      method: 'get',
      path: (id) => `/api/v1/businesses/${id}/staff/${listStaffId}/time-off`,
      allowedRoles: ['OWNER', 'ADMIN'],
      prepare: async ({ businessId, ownerAccessToken }) => {
        listStaffId = await createStaff(ownerAccessToken, businessId);
      },
    });

    let postStaffId = '';
    await expectBusinessAuthz(app, tracker, {
      method: 'post',
      path: (id) => `/api/v1/businesses/${id}/staff/${postStaffId}/time-off`,
      allowedRoles: ['OWNER', 'ADMIN'],
      body: { start: '2026-07-01T09:00', end: '2026-07-01T12:00' },
      prepare: async ({ businessId, ownerAccessToken }) => {
        postStaffId = await createStaff(ownerAccessToken, businessId);
      },
    });
  });

  it('allows STAFF on their own schedule and forbids another staff member', async () => {
    const owner = await createUser(app, tracker, 'authz-owner');
    const business = await createBusiness(app, tracker, owner);
    const staffA = await createStaff(owner.accessToken, business.id, 'A');
    const staffB = await createStaff(owner.accessToken, business.id, 'B');
    const staffUser = await createUser(app, tracker, 'authz-staff');
    await addMember(app, business.id, staffUser.id, 'STAFF');
    await linkStaff(business.id, staffUser.id, staffA);

    const hoursBody = {
      intervals: [{ weekday: 'MONDAY', start: '09:00', end: '12:00' }],
    };
    const timeOffBody = { start: '2026-07-10T09:00', end: '2026-07-10T12:00' };

    for (const [method, path, body] of [
      ['put', `/api/v1/businesses/${business.id}/staff/${staffB}/working-hours`, hoursBody],
      ['post', `/api/v1/businesses/${business.id}/staff/${staffB}/time-off`, timeOffBody],
      ['get', `/api/v1/businesses/${business.id}/staff/${staffB}/working-hours`, undefined],
    ] as const) {
      const forbidden = await request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${staffUser.accessToken}`)
        .set('Content-Type', 'application/json')
        .send(body ?? {});
      expect(forbidden.status).toBe(403);
    }

    const ownPut = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/staff/${staffA}/working-hours`)
      .set('Authorization', `Bearer ${staffUser.accessToken}`)
      .set('Content-Type', 'application/json')
      .send(hoursBody);
    expect(ownPut.status).toBe(200);

    const ownPost = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff/${staffA}/time-off`)
      .set('Authorization', `Bearer ${staffUser.accessToken}`)
      .set('Content-Type', 'application/json')
      .send(timeOffBody);
    expect(ownPost.status).toBe(201);

    const ownGet = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/staff/${staffA}/working-hours`)
      .set('Authorization', `Bearer ${staffUser.accessToken}`);
    expect(ownGet.status).toBe(200);

    const ownDelete = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}/staff/${staffA}/time-off/${ownPost.body.id}`)
      .set('Authorization', `Bearer ${staffUser.accessToken}`);
    expect(ownDelete.status).toBe(204);

    const otherTimeOff = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff/${staffB}/time-off`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send(timeOffBody);
    expect(otherTimeOff.status).toBe(201);

    const deleteOther = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}/staff/${staffA}/time-off/${otherTimeOff.body.id}`)
      .set('Authorization', `Bearer ${staffUser.accessToken}`);
    expect(deleteOther.status).toBe(404);

    const deleteForbidden = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}/staff/${staffB}/time-off/${otherTimeOff.body.id}`)
      .set('Authorization', `Bearer ${staffUser.accessToken}`);
    expect(deleteForbidden.status).toBe(403);
  });

  it('returns 404 for another business staffId', async () => {
    const owner = await createUser(app, tracker, 'biz-a');
    const business = await createBusiness(app, tracker, owner);
    const otherOwner = await createUser(app, tracker, 'biz-b');
    const otherBiz = await createBusiness(app, tracker, otherOwner);
    const foreignStaff = await createStaff(otherOwner.accessToken, otherBiz.id, 'Foreign');

    const res = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/staff/${foreignStaff}/working-hours`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('soft-delete clears working hours and future/in-progress time off, keeps past', async () => {
    const owner = await createUser(app, tracker, 'soft-owner');
    const business = await createBusiness(app, tracker, owner);
    const staffId = await createStaff(owner.accessToken, business.id);

    await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/staff/${staffId}/working-hours`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        intervals: [{ weekday: 'MONDAY', start: '09:00', end: '17:00' }],
      });

    const past = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff/${staffId}/time-off`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ start: '2026-05-01T09:00', end: '2026-05-01T17:00' });
    expect(past.status).toBe(201);

    const future = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff/${staffId}/time-off`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ start: '2026-07-01T09:00', end: '2026-07-01T17:00' });
    expect(future.status).toBe(201);

    // In-progress: started before FixedClock now, ends after.
    const inProgress = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff/${staffId}/time-off`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ start: '2026-06-15T10:00', end: '2026-06-15T18:00' });
    expect(inProgress.status).toBe(201);

    const deleted = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}/staff/${staffId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(deleted.status).toBe(204);

    const hours = await prisma.workingHours.count({ where: { staffMemberId: staffId } });
    expect(hours).toBe(0);

    const remaining = await prisma.timeOff.findMany({ where: { staffMemberId: staffId } });
    expect(remaining.map((row) => row.id)).toEqual([past.body.id]);
  });
});
