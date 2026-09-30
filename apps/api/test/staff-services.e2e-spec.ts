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
  createBusiness,
  createUser,
  expectBusinessAuthz,
} from './support/business-factories.js';

describe('Staff and services (e2e)', () => {
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

  it('creates staff, lists them, and soft-deletes with assignment unlink', async () => {
    const owner = await createUser(app, tracker, 'staff-owner');
    const business = await createBusiness(app, tracker, owner);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ displayName: 'Ana' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ displayName: 'Ana', photoUrl: null, active: true });

    const list = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/staff`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const service = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/services`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'Cut',
        durationMinutes: 30,
        price: { amount: 1500, currency: 'EUR' },
        staffMemberIds: [created.body.id],
        customFields: [
          {
            key: 'notes',
            label: 'Notes',
            type: 'TEXT',
            required: false,
          },
        ],
      });
    expect(service.status).toBe(201);
    expect(service.body.staffMemberIds).toEqual([created.body.id]);
    expect(service.body.customFields).toHaveLength(1);

    const deleted = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}/staff/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(deleted.status).toBe(204);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/services/${service.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(after.status).toBe(200);
    expect(after.body.staffMemberIds).toEqual([]);
  });

  it('ownerIsStaff links a staff member on business create', async () => {
    const owner = await createUser(app, tracker, 'solo');
    const category = await prisma.category.findFirstOrThrow({ select: { id: true } });
    const res = await request(app.getHttpServer())
      .post('/api/v1/businesses')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .set(
        'X-Forwarded-For',
        `198.18.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`,
      )
      .send({
        name: 'Solo Studio',
        categoryId: category.id,
        city: 'BUDVA',
        ownerIsStaff: true,
      });
    expect(res.status).toBe(201);
    tracker.businessIds.push(res.body.id);

    const mine = await request(app.getHttpServer())
      .get('/api/v1/me/businesses')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(mine.status).toBe(200);
    const row = mine.body.find((b: { businessId: string }) => b.businessId === res.body.id);
    expect(row.staffMemberId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('rejects STAFF writes with 403 and foreign staffMemberIds with 422', async () => {
    await expectBusinessAuthz(app, tracker, {
      method: 'post',
      path: (id) => `/api/v1/businesses/${id}/staff`,
      allowedRoles: ['OWNER', 'ADMIN'],
      body: { displayName: 'Temp' },
    });

    const owner = await createUser(app, tracker, 'svc-owner');
    const business = await createBusiness(app, tracker, owner);
    const other = await createUser(app, tracker, 'other-owner');
    const otherBiz = await createBusiness(app, tracker, other);
    const foreignStaff = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${otherBiz.id}/staff`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ displayName: 'Foreign' });
    expect(foreignStaff.status).toBe(201);

    const bad = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/services`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'Bad',
        durationMinutes: 15,
        price: { amount: 100, currency: 'EUR' },
        staffMemberIds: [foreignStaff.body.id],
      });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
    expect(bad.body.error.details.staffMemberIds).toEqual([foreignStaff.body.id]);
  });

  it('upserts custom fields by key and deletes omitted ones', async () => {
    const owner = await createUser(app, tracker, 'cf-owner');
    const business = await createBusiness(app, tracker, owner);
    const created = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/services`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'Massage',
        durationMinutes: 60,
        price: { amount: 4000, currency: 'EUR' },
        customFields: [
          {
            key: 'intensity',
            label: 'Intensity',
            type: 'SELECT',
            required: true,
            options: ['soft', 'strong'],
          },
          { key: 'notes', label: 'Notes', type: 'TEXT', required: false },
        ],
      });
    expect(created.status).toBe(201);
    const intensityId = created.body.customFields.find(
      (f: { key: string }) => f.key === 'intensity',
    ).id;

    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/businesses/${business.id}/services/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        customFields: [
          {
            key: 'intensity',
            label: 'Pressure',
            type: 'SELECT',
            required: true,
            options: ['soft', 'medium', 'strong'],
          },
        ],
      });
    expect(patched.status).toBe(200);
    expect(patched.body.customFields).toHaveLength(1);
    expect(patched.body.customFields[0].id).toBe(intensityId);
    expect(patched.body.customFields[0].label).toBe('Pressure');
    expect(patched.body.customFields[0].options).toEqual(['soft', 'medium', 'strong']);
  });
});
