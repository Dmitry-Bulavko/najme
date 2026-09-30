import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FakeObjectStorage } from '../src/storage/fake-object-storage.js';
import { ObjectStorage } from '../src/storage/object-storage.js';
import { BusinessTestTracker, createBusiness, createUser } from './support/business-factories.js';

describe('Uploads (e2e, fake storage)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tracker: BusinessTestTracker;
  let storage: FakeObjectStorage;

  beforeAll(async () => {
    storage = new FakeObjectStorage();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ObjectStorage)
      .useValue(storage)
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
  });

  afterEach(async () => {
    await tracker.cleanup(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('presigns, attaches a logo after a simulated upload, and clears it', async () => {
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
    expect(presign.body.expiresAt).toMatch(/Z$/);

    // Simulate the browser completing the presigned POST.
    storage.put(presign.body.key as string, 'image/png', 1200);

    const attached = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/logo`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ key: presign.body.key });
    expect(attached.status).toBe(200);
    expect(attached.body.logoUrl).toBe(`http://localhost:9000/najme/${presign.body.key as string}`);

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

  it('rejects attach when the object is missing or the key prefix is wrong', async () => {
    const owner = await createUser(app, tracker, 'bad-up');
    const business = await createBusiness(app, tracker, owner);

    const missing = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/logo`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ key: `businesses/${business.id}/logo/missing.png` });
    expect(missing.status).toBe(422);
    expect(missing.body.error.code).toBe('UPLOAD_INVALID');

    const wrongPrefix = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/cover`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ key: `businesses/${business.id}/logo/not-cover.png` });
    expect(wrongPrefix.status).toBe(422);
    expect(wrongPrefix.body.error.code).toBe('UPLOAD_INVALID');
  });

  it('attaches and clears a staff photo', async () => {
    const owner = await createUser(app, tracker, 'staff-photo');
    const business = await createBusiness(app, tracker, owner);
    const staff = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ displayName: 'Photo Staff' });
    expect(staff.status).toBe(201);

    const presign = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/uploads`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        kind: 'STAFF_PHOTO',
        contentType: 'image/webp',
        contentLength: 800,
      });
    expect(presign.status).toBe(201);
    storage.put(presign.body.key as string, 'image/webp', 800);

    const attached = await request(app.getHttpServer())
      .put(`/api/v1/businesses/${business.id}/staff/${staff.body.id}/photo`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ key: presign.body.key });
    expect(attached.status).toBe(200);
    expect(attached.body.photoUrl).toContain(presign.body.key);

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/staff/${staff.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(listed.body.photoUrl).toBe(attached.body.photoUrl);
  });
});
