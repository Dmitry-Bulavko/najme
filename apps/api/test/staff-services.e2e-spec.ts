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

  async function createStaff(token: string, businessId: string, displayName = 'Ana') {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${businessId}/staff`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ displayName });
    expect(res.status).toBe(201);
    return res.body as { id: string; displayName: string };
  }

  it('creates staff, lists them, patches, and soft-deletes with assignment unlink', async () => {
    const owner = await createUser(app, tracker, 'staff-owner');
    const business = await createBusiness(app, tracker, owner);

    const created = await createStaff(owner.accessToken, business.id, 'Ana');
    expect(created).toMatchObject({ displayName: 'Ana' });

    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/businesses/${business.id}/staff/${created.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ displayName: 'Ana Petrović', active: false });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ displayName: 'Ana Petrović', active: false });

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
        staffMemberIds: [created.id],
        customFields: [{ key: 'notes', label: 'Notes', type: 'TEXT', required: false }],
      });
    expect(service.status).toBe(201);
    expect(service.body.staffMemberIds).toEqual([created.id]);

    const deleted = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}/staff/${created.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(deleted.status).toBe(204);

    const listAfter = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/staff`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(listAfter.body).toHaveLength(0);

    const getDeleted = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/staff/${created.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(getDeleted.status).toBe(404);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/services/${service.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(after.status).toBe(200);
    expect(after.body.staffMemberIds).toEqual([]);
  });

  it('ownerIsStaff links staff; deleting that staff clears /me/businesses staffMemberId', async () => {
    const owner = await createUser(app, tracker, 'solo');
    await prisma.user.update({
      where: { id: owner.id },
      data: { displayName: null },
    });
    const category = await prisma.category.findFirstOrThrow({ select: { id: true } });
    const res = await request(app.getHttpServer())
      .post('/api/v1/businesses')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
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

    const staff = await prisma.staffMember.findUniqueOrThrow({
      where: { id: row.staffMemberId },
    });
    // displayName fell back to email local-part when User.displayName is null.
    expect(staff.displayName).toBe(owner.email.split('@')[0]);

    await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${res.body.id}/staff/${row.staffMemberId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const mineAfter = await request(app.getHttpServer())
      .get('/api/v1/me/businesses')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const rowAfter = mineAfter.body.find(
      (b: { businessId: string }) => b.businessId === res.body.id,
    );
    expect(rowAfter.staffMemberId).toBeNull();
  });

  it('enforces STAFF 403 on writes and foreign resource ids → 404', async () => {
    await expectBusinessAuthz(app, tracker, {
      method: 'post',
      path: (id) => `/api/v1/businesses/${id}/staff`,
      allowedRoles: ['OWNER', 'ADMIN'],
      body: { displayName: 'Temp' },
    });

    const owner = await createUser(app, tracker, 'authz-owner');
    const business = await createBusiness(app, tracker, owner);
    const staff = await createStaff(owner.accessToken, business.id);
    const service = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/services`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'Cut',
        durationMinutes: 30,
        price: { amount: 1000, currency: 'EUR' },
      });
    expect(service.status).toBe(201);

    await expectBusinessAuthz(app, tracker, {
      method: 'post',
      path: (id) => `/api/v1/businesses/${id}/services`,
      allowedRoles: ['OWNER', 'ADMIN'],
      body: {
        name: 'Authz Service',
        durationMinutes: 15,
        price: { amount: 500, currency: 'EUR' },
      },
    });

    let patchStaffId = '';
    await expectBusinessAuthz(app, tracker, {
      method: 'patch',
      path: (id) => `/api/v1/businesses/${id}/staff/${patchStaffId}`,
      allowedRoles: ['OWNER', 'ADMIN'],
      body: { displayName: 'Renamed' },
      prepare: async ({ businessId, ownerAccessToken }) => {
        patchStaffId = (await createStaff(ownerAccessToken, businessId, 'PatchMe')).id;
      },
    });

    let patchServiceId = '';
    await expectBusinessAuthz(app, tracker, {
      method: 'patch',
      path: (id) => `/api/v1/businesses/${id}/services/${patchServiceId}`,
      allowedRoles: ['OWNER', 'ADMIN'],
      body: { name: 'Renamed service' },
      prepare: async ({ app: nestApp, businessId, ownerAccessToken }) => {
        const created = await request(nestApp.getHttpServer())
          .post(`/api/v1/businesses/${businessId}/services`)
          .set('Authorization', `Bearer ${ownerAccessToken}`)
          .set('Content-Type', 'application/json')
          .send({
            name: 'ToPatch',
            durationMinutes: 20,
            price: { amount: 800, currency: 'EUR' },
          });
        expect(created.status).toBe(201);
        patchServiceId = created.body.id as string;
      },
    });

    // STAFF 403 on DELETE (expectBusinessAuthz cannot share one resource across allowed roles).
    const staffUser = await createUser(app, tracker, 'staff-writer');
    await addMember(app, business.id, staffUser.id, 'STAFF');
    for (const [method, path] of [
      ['delete', `/api/v1/businesses/${business.id}/staff/${staff.id}`],
      ['delete', `/api/v1/businesses/${business.id}/services/${service.body.id}`],
    ] as const) {
      const res = await request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${staffUser.accessToken}`);
      expect(res.status).toBe(403);
    }

    const other = await createUser(app, tracker, 'other-owner');
    const otherBiz = await createBusiness(app, tracker, other);
    const foreignStaff = await createStaff(other.accessToken, otherBiz.id, 'Foreign');
    const foreignService = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${otherBiz.id}/services`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'Foreign',
        durationMinutes: 15,
        price: { amount: 100, currency: 'EUR' },
      });
    expect(foreignService.status).toBe(201);

    for (const [method, path] of [
      ['get', `/api/v1/businesses/${business.id}/staff/${foreignStaff.id}`],
      ['patch', `/api/v1/businesses/${business.id}/staff/${foreignStaff.id}`],
      ['delete', `/api/v1/businesses/${business.id}/staff/${foreignStaff.id}`],
      ['get', `/api/v1/businesses/${business.id}/services/${foreignService.body.id}`],
      ['patch', `/api/v1/businesses/${business.id}/services/${foreignService.body.id}`],
      ['delete', `/api/v1/businesses/${business.id}/services/${foreignService.body.id}`],
    ] as const) {
      const res = await request(app.getHttpServer())
        [method](path)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('Content-Type', 'application/json')
        .send(method === 'patch' ? { displayName: 'x', name: 'x' } : {});
      expect(res.status, `${method} ${path}`).toBe(404);
    }

    // Soft-deleted staff in staffMemberIds → 422 with details.
    await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}/staff/${staff.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const softDeletedAssign = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/services`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'Bad assign',
        durationMinutes: 15,
        price: { amount: 100, currency: 'EUR' },
        staffMemberIds: [staff.id],
      });
    expect(softDeletedAssign.status).toBe(422);
    expect(softDeletedAssign.body.error.code).toBe('VALIDATION_FAILED');
    expect(softDeletedAssign.body.error.details.staffMemberIds).toEqual([staff.id]);

    const foreignAssign = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/services`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'Bad foreign',
        durationMinutes: 15,
        price: { amount: 100, currency: 'EUR' },
        staffMemberIds: [foreignStaff.id],
      });
    expect(foreignAssign.status).toBe(422);
    expect(foreignAssign.body.error.details.staffMemberIds).toEqual([foreignStaff.id]);
  });

  it('rejects duplicate staffMemberIds and invalid service payloads with 400', async () => {
    const owner = await createUser(app, tracker, 'val-owner');
    const business = await createBusiness(app, tracker, owner);
    const staff = await createStaff(owner.accessToken, business.id);

    const dup = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/services`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'Dup',
        durationMinutes: 30,
        price: { amount: 1000, currency: 'EUR' },
        staffMemberIds: [staff.id, staff.id],
      });
    expect(dup.status).toBe(400);

    const badDuration = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/services`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'Bad',
        durationMinutes: 7,
        price: { amount: 1000, currency: 'EUR' },
      });
    expect(badDuration.status).toBe(400);

    const badSelect = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/services`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'Bad select',
        durationMinutes: 30,
        price: { amount: 1000, currency: 'EUR' },
        customFields: [
          {
            key: 'intensity',
            label: 'Intensity',
            type: 'SELECT',
            required: true,
            options: [],
          },
        ],
      });
    expect(badSelect.status).toBe(400);
  });

  it('soft-deletes a service (list/GET exclude it)', async () => {
    const owner = await createUser(app, tracker, 'svc-del');
    const business = await createBusiness(app, tracker, owner);
    const created = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/services`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'Temp',
        durationMinutes: 30,
        price: { amount: 1000, currency: 'EUR' },
      });
    expect(created.status).toBe(201);

    const deleted = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}/services/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(deleted.status).toBe(204);

    const got = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/services/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(got.status).toBe(404);

    const list = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/services`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(list.body).toEqual([]);
  });

  it('upserts custom fields by key with {value,label} SELECT options', async () => {
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
            options: [
              { value: 'soft', label: 'Soft' },
              { value: 'strong', label: 'Strong' },
            ],
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
            options: [
              { value: 'soft', label: 'Soft' },
              { value: 'medium', label: 'Medium' },
              { value: 'strong', label: 'Strong' },
            ],
          },
        ],
      });
    expect(patched.status).toBe(200);
    expect(patched.body.customFields).toHaveLength(1);
    expect(patched.body.customFields[0].id).toBe(intensityId);
    expect(patched.body.customFields[0].label).toBe('Pressure');
    expect(patched.body.customFields[0].options).toEqual([
      { value: 'soft', label: 'Soft' },
      { value: 'medium', label: 'Medium' },
      { value: 'strong', label: 'Strong' },
    ]);
  });
});
