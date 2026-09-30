import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UPLOAD_MAX_BYTES } from '@najme/contracts';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { AppModule } from '../src/app.module.js';
import { Clock, FixedClock } from '../src/common/clock.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ObjectStorage } from '../src/storage/object-storage.js';
import {
  BusinessTestTracker,
  createBusiness,
  createUser,
  expectBusinessAuthz,
} from './support/business-factories.js';
import { FakeObjectStorage } from './support/fake-object-storage.js';

const FIXED_NOW = new Date('2026-06-15T12:00:00.000Z');

describe('Uploads (e2e, fake storage)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tracker: BusinessTestTracker;
  let storage: FakeObjectStorage;
  let clock: FixedClock;

  beforeAll(async () => {
    storage = new FakeObjectStorage();
    clock = new FixedClock(FIXED_NOW);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ObjectStorage)
      .useValue(storage)
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
    storage.objects.clear();
    storage.deletedKeys.length = 0;
    storage.failDeleteWith = null;
    clock.set(FIXED_NOW);
  });

  afterEach(async () => {
    await tracker.cleanup(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('presigns with Content-Type field and FixedClock expiresAt, attaches logo, clears it', async () => {
    const owner = await createUser(app, tracker, 'up-owner');
    const business = await createBusiness(app, tracker, owner);

    const presign = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/uploads`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        kind: 'LOGO',
        contentType: 'image/png',
        contentLength: 1200,
      });
    expect(presign.status).toBe(201);
    expect(presign.body.key).toMatch(
      new RegExp(`^businesses/${business.id}/logo/[0-9a-f-]+\\.png$`),
    );
    expect(presign.body.url).toBeTruthy();
    expect(presign.body.fields.key).toBe(presign.body.key);
    expect(presign.body.fields['Content-Type']).toBe('image/png');
    expect(presign.body.expiresAt).toBe('2026-06-15T12:10:00.000Z');

    storage.put(presign.body.key as string, 'image/png', 1200);

    const attached = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/logo`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ key: presign.body.key });
    expect(attached.status).toBe(200);
    expect(attached.body.logoUrl).toBe(`http://localhost:9000/najme/${presign.body.key as string}`);

    const me = await request(app.getHttpServer())
      .get('/api/v1/me/businesses')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(me.status).toBe(200);
    const listed = (me.body as Array<{ businessId: string; logoUrl: string | null }>).find(
      (b) => b.businessId === business.id,
    );
    expect(listed?.logoUrl).toBe(attached.body.logoUrl);

    const got = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(got.status).toBe(200);
    expect(got.body.logoUrl).toBe(attached.body.logoUrl);

    const cleared = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}/logo`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(cleared.status).toBe(204);
    expect(storage.deletedKeys).toContain(presign.body.key);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(after.body.logoUrl).toBeNull();
  });

  it('rejects invalid create-upload bodies with 400', async () => {
    const owner = await createUser(app, tracker, 'bad-presign');
    const business = await createBusiness(app, tracker, owner);
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    for (const body of [
      { kind: 'LOGO', contentType: 'image/png', contentLength: 0 },
      { kind: 'LOGO', contentType: 'image/png', contentLength: UPLOAD_MAX_BYTES + 1 },
      { kind: 'LOGO', contentType: 'image/png', contentLength: 1.5 },
      { kind: 'LOGO', contentType: 'image/gif', contentLength: 10 },
      { kind: 'UNKNOWN', contentType: 'image/png', contentLength: 10 },
    ]) {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/businesses/${business.id}/uploads`)
        .set(auth)
        .set('Content-Type', 'application/json')
        .send(body);
      expect(res.status).toBe(400);
    }
  });

  it('rejects attach when object missing, wrong prefix, traversal, or type mismatch', async () => {
    const owner = await createUser(app, tracker, 'bad-up');
    const business = await createBusiness(app, tracker, owner);
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    const missing = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/logo`)
      .set(auth)
      .set('Content-Type', 'application/json')
      .send({ key: `businesses/${business.id}/logo/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png` });
    expect(missing.status).toBe(422);
    expect(missing.body.error.code).toBe('UPLOAD_INVALID');

    const wrongPrefix = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/cover`)
      .set(auth)
      .set('Content-Type', 'application/json')
      .send({ key: `businesses/${business.id}/logo/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png` });
    expect(wrongPrefix.status).toBe(422);

    const traversal = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/logo`)
      .set(auth)
      .set('Content-Type', 'application/json')
      .send({
        key: `businesses/${business.id}/logo/../cover/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`,
      });
    expect(traversal.status).toBe(422);

    const staffKey = `businesses/${business.id}/staff/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`;
    storage.put(staffKey, 'image/webp', 100);
    const staffAsLogo = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/logo`)
      .set(auth)
      .set('Content-Type', 'application/json')
      .send({ key: staffKey });
    expect(staffAsLogo.status).toBe(422);

    const typed = `businesses/${business.id}/logo/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`;
    storage.put(typed, 'image/jpeg', 100);
    const typeMismatch = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/logo`)
      .set(auth)
      .set('Content-Type', 'application/json')
      .send({ key: typed });
    expect(typeMismatch.status).toBe(422);

    const oversized = `businesses/${business.id}/logo/bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`;
    storage.put(oversized, 'image/png', UPLOAD_MAX_BYTES + 1);
    const sizeMismatch = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/logo`)
      .set(auth)
      .set('Content-Type', 'application/json')
      .send({ key: oversized });
    expect(sizeMismatch.status).toBe(422);
  });

  it('cover happy path and replace deletes previous key', async () => {
    const owner = await createUser(app, tracker, 'cover-up');
    const business = await createBusiness(app, tracker, owner);
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    const firstKey = `businesses/${business.id}/cover/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`;
    const secondKey = `businesses/${business.id}/cover/bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`;
    storage.put(firstKey, 'image/webp', 200);
    storage.put(secondKey, 'image/webp', 200);

    expect(
      (
        await request(app.getHttpServer())
          .put(`/api/v1/businesses/${business.id}/cover`)
          .set(auth)
          .set('Content-Type', 'application/json')
          .send({ key: firstKey })
      ).status,
    ).toBe(200);

    const replaced = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/cover`)
      .set(auth)
      .set('Content-Type', 'application/json')
      .send({ key: secondKey });
    expect(replaced.status).toBe(200);
    expect(storage.deletedKeys).toContain(firstKey);

    // Re-attaching the same key must not delete it.
    storage.deletedKeys.length = 0;
    expect(
      (
        await request(app.getHttpServer())
          .put(`/api/v1/businesses/${business.id}/cover`)
          .set(auth)
          .set('Content-Type', 'application/json')
          .send({ key: secondKey })
      ).status,
    ).toBe(200);
    expect(storage.deletedKeys).toHaveLength(0);

    expect(
      (
        await request(app.getHttpServer())
          .delete(`/api/v1/businesses/${business.id}/cover`)
          .set(auth)
      ).status,
    ).toBe(204);
  });

  it('failed storage delete does not fail the attach request', async () => {
    const owner = await createUser(app, tracker, 'del-fail');
    const business = await createBusiness(app, tracker, owner);
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const firstKey = `businesses/${business.id}/logo/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`;
    const secondKey = `businesses/${business.id}/logo/bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`;
    storage.put(firstKey, 'image/png', 50);
    storage.put(secondKey, 'image/png', 50);
    await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/logo`)
      .set(auth)
      .set('Content-Type', 'application/json')
      .send({ key: firstKey });

    storage.failDeleteWith = new Error('simulated delete failure');
    const replaced = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/logo`)
      .set(auth)
      .set('Content-Type', 'application/json')
      .send({ key: secondKey });
    expect(replaced.status).toBe(200);
    expect(storage.deletedKeys).toContain(firstKey);
    expect(storage.objects.has(firstKey)).toBe(true);
  });

  it('attaches and clears a staff photo; rejects shared keys', async () => {
    const owner = await createUser(app, tracker, 'staff-photo');
    const business = await createBusiness(app, tracker, owner);
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    const staff1 = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff`)
      .set(auth)
      .set('Content-Type', 'application/json')
      .send({ displayName: 'Photo Staff 1' });
    expect(staff1.status).toBe(201);
    const staff2 = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff`)
      .set(auth)
      .set('Content-Type', 'application/json')
      .send({ displayName: 'Photo Staff 2' });
    expect(staff2.status).toBe(201);

    const key = `businesses/${business.id}/staff/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`;
    storage.put(key, 'image/webp', 800);

    const attached = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/staff/${staff1.body.id}/photo`)
      .set(auth)
      .set('Content-Type', 'application/json')
      .send({ key });
    expect(attached.status).toBe(200);
    expect(attached.body.photoUrl).toContain(key);

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/staff`)
      .set(auth);
    expect(listed.status).toBe(200);
    const row = (listed.body as Array<{ id: string; photoUrl: string | null }>).find(
      (s) => s.id === staff1.body.id,
    );
    expect(row?.photoUrl).toBe(attached.body.photoUrl);

    const shared = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/staff/${staff2.body.id}/photo`)
      .set(auth)
      .set('Content-Type', 'application/json')
      .send({ key });
    expect(shared.status).toBe(422);
    expect(shared.body.error.code).toBe('UPLOAD_INVALID');

    const cleared = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}/staff/${staff1.body.id}/photo`)
      .set(auth);
    expect(cleared.status).toBe(204);
    expect(storage.deletedKeys).toContain(key);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/staff/${staff1.body.id}`)
      .set(auth);
    expect(after.body.photoUrl).toBeNull();
  });

  it('rejects a foreign staffId with 404 and another business key with 422', async () => {
    const owner = await createUser(app, tracker, 'foreign');
    const business = await createBusiness(app, tracker, owner);
    const other = await createBusiness(app, tracker, owner);
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    const foreignStaff = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/staff/${randomUUID()}/photo`)
      .set(auth)
      .set('Content-Type', 'application/json')
      .send({ key: `businesses/${business.id}/staff/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp` });
    expect(foreignStaff.status).toBe(404);

    const otherKey = `businesses/${other.id}/logo/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`;
    storage.put(otherKey, 'image/png', 10);
    const crossBiz = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/logo`)
      .set(auth)
      .set('Content-Type', 'application/json')
      .send({ key: otherKey });
    expect(crossBiz.status).toBe(422);
    expect(crossBiz.body.error.code).toBe('UPLOAD_INVALID');
  });

  it('enforces OWNER/ADMIN on all seven upload routes (STAFF → 403)', async () => {
    await expectBusinessAuthz(app, tracker, {
      method: 'post',
      path: (id) => `/api/v1/businesses/${id}/uploads`,
      allowedRoles: ['OWNER', 'ADMIN'],
      body: { kind: 'LOGO', contentType: 'image/png', contentLength: 100 },
    });

    const logoBody = { key: '' };
    await expectBusinessAuthz(app, tracker, {
      method: 'put',
      path: (id) => `/api/v1/businesses/${id}/logo`,
      allowedRoles: ['OWNER', 'ADMIN'],
      body: logoBody,
      prepare: async ({ businessId }) => {
        logoBody.key = `businesses/${businessId}/logo/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`;
        storage.put(logoBody.key, 'image/png', 100);
      },
    });

    await expectBusinessAuthz(app, tracker, {
      method: 'delete',
      path: (id) => `/api/v1/businesses/${id}/logo`,
      allowedRoles: ['OWNER', 'ADMIN'],
    });

    const coverBody = { key: '' };
    await expectBusinessAuthz(app, tracker, {
      method: 'put',
      path: (id) => `/api/v1/businesses/${id}/cover`,
      allowedRoles: ['OWNER', 'ADMIN'],
      body: coverBody,
      prepare: async ({ businessId }) => {
        coverBody.key = `businesses/${businessId}/cover/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`;
        storage.put(coverBody.key, 'image/webp', 100);
      },
    });

    await expectBusinessAuthz(app, tracker, {
      method: 'delete',
      path: (id) => `/api/v1/businesses/${id}/cover`,
      allowedRoles: ['OWNER', 'ADMIN'],
    });

    let staffId = '';
    const photoBody = { key: '' };
    await expectBusinessAuthz(app, tracker, {
      method: 'put',
      path: (id) => `/api/v1/businesses/${id}/staff/${staffId}/photo`,
      allowedRoles: ['OWNER', 'ADMIN'],
      body: photoBody,
      prepare: async ({ app: nestApp, businessId, ownerAccessToken }) => {
        const staff = await request(nestApp.getHttpServer())
          .post(`/api/v1/businesses/${businessId}/staff`)
          .set('Authorization', `Bearer ${ownerAccessToken}`)
          .set('Content-Type', 'application/json')
          .send({ displayName: 'Authz Photo' });
        expect(staff.status).toBe(201);
        staffId = staff.body.id as string;
        photoBody.key = `businesses/${businessId}/staff/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`;
        storage.put(photoBody.key, 'image/webp', 100);
      },
    });

    let clearStaffId = '';
    await expectBusinessAuthz(app, tracker, {
      method: 'delete',
      path: (id) => `/api/v1/businesses/${id}/staff/${clearStaffId}/photo`,
      allowedRoles: ['OWNER', 'ADMIN'],
      prepare: async ({ app: nestApp, businessId, ownerAccessToken }) => {
        const staff = await request(nestApp.getHttpServer())
          .post(`/api/v1/businesses/${businessId}/staff`)
          .set('Authorization', `Bearer ${ownerAccessToken}`)
          .set('Content-Type', 'application/json')
          .send({ displayName: 'Clear Photo' });
        expect(staff.status).toBe(201);
        clearStaffId = staff.body.id as string;
      },
    });
  });
});
