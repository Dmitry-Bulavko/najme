import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  BusinessTestTracker,
  addMember,
  createBusiness,
  createUser,
} from './support/business-factories.js';

describe('Working hours and time off (e2e)', () => {
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

  async function createStaff(ownerToken: string, businessId: string) {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${businessId}/staff`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Content-Type', 'application/json')
      .send({ displayName: 'Scheduler' });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  it('replaces working hours including 24:00 ends', async () => {
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
  });

  it('forbids STAFF from managing another staff member', async () => {
    const owner = await createUser(app, tracker, 'authz-owner');
    const business = await createBusiness(app, tracker, owner);
    const staffA = await createStaff(owner.accessToken, business.id);
    const staffB = await createStaff(owner.accessToken, business.id);
    const staffUser = await createUser(app, tracker, 'authz-staff');
    await addMember(app, business.id, staffUser.id, 'STAFF');
    await prisma.membership.update({
      where: { userId_businessId: { userId: staffUser.id, businessId: business.id } },
      data: { staffMemberId: staffA },
    });

    const forbidden = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/staff/${staffB}/working-hours`)
      .set('Authorization', `Bearer ${staffUser.accessToken}`);
    expect(forbidden.status).toBe(403);

    const allowed = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/staff/${staffA}/working-hours`)
      .set('Authorization', `Bearer ${staffUser.accessToken}`);
    expect(allowed.status).toBe(200);
  });
});
