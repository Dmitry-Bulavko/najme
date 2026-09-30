import 'reflect-metadata';
import { CreateBucketCommand, PutBucketPolicyCommand, S3Client } from '@aws-sdk/client-s3';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { BusinessTestTracker, createBusiness, createUser } from './support/business-factories.js';

const ENDPOINT = process.env.STORAGE_ENDPOINT ?? 'http://localhost:9000';
const BUCKET = process.env.STORAGE_BUCKET ?? 'najme';
const ACCESS_KEY = process.env.STORAGE_ACCESS_KEY_ID ?? 'minioadmin';
const SECRET_KEY = process.env.STORAGE_SECRET_ACCESS_KEY ?? 'minioadmin';
const REGION = process.env.STORAGE_REGION ?? 'us-east-1';

async function minioReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${ENDPOINT}/minio/health/live`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureBucket(): Promise<void> {
  const client = new S3Client({
    region: REGION,
    endpoint: ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  });
  try {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name !== 'BucketAlreadyOwnedByYou' && name !== 'BucketAlreadyExists') {
      // MinIO may also return 409 without those names — ignore conflict-ish errors.
      const status =
        err && typeof err === 'object' && '$metadata' in err
          ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
          : undefined;
      if (status !== 409) {
        throw err;
      }
    }
  }
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET}/businesses/*`],
      },
    ],
  };
  await client.send(new PutBucketPolicyCommand({ Bucket: BUCKET, Policy: JSON.stringify(policy) }));
  client.destroy();
}

describe('Uploads against MinIO (integration)', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService | undefined;
  let tracker: BusinessTestTracker;
  let skip = false;

  beforeAll(async () => {
    skip = !(await minioReachable());
    if (skip) {
      return;
    }
    await ensureBucket();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('presigned POST uploads bytes, attach stores the key, public URL returns 200', async () => {
    if (skip || !app || !prisma) {
      if (process.env.CI) {
        throw new Error('MinIO must be reachable in CI for the upload integration test.');
      }
      return;
    }
    tracker = new BusinessTestTracker();
    try {
      const owner = await createUser(app, tracker, 'minio-owner');
      const business = await createBusiness(app, tracker, owner);

      const tinyPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      );

      const presign = await request(app.getHttpServer())
        .post(`/api/v1/businesses/${business.id}/uploads`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('Content-Type', 'application/json')
        .send({
          kind: 'LOGO',
          contentType: 'image/png',
          contentLength: tinyPng.length,
        });
      expect(presign.status).toBe(201);

      const form = new FormData();
      for (const [name, value] of Object.entries(presign.body.fields as Record<string, string>)) {
        form.append(name, value);
      }
      form.append('file', new Blob([tinyPng], { type: 'image/png' }), 'logo.png');

      const uploaded = await fetch(presign.body.url as string, { method: 'POST', body: form });
      expect(uploaded.ok || uploaded.status === 204).toBe(true);

      const attached = await request(app.getHttpServer())
        .put(`/api/v1/businesses/${business.id}/logo`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('Content-Type', 'application/json')
        .send({ key: presign.body.key });
      expect(attached.status).toBe(200);
      expect(attached.body.logoUrl).toMatch(/^http/);

      const publicGet = await fetch(attached.body.logoUrl as string);
      expect(publicGet.status).toBe(200);
      expect(publicGet.headers.get('content-type')).toMatch(/image\/png/);
    } finally {
      await tracker.cleanup(prisma);
    }
  });
});
