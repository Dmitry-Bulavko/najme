import 'reflect-metadata';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  PutBucketPolicyCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UPLOAD_MAX_BYTES } from '@najme/contracts';
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

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function minioReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${ENDPOINT}/minio/health/live`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

function s3Client(): S3Client {
  return new S3Client({
    region: REGION,
    endpoint: ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

async function ensureBucket(): Promise<void> {
  const client = s3Client();
  try {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name !== 'BucketAlreadyOwnedByYou' && name !== 'BucketAlreadyExists') {
      const status =
        err && typeof err === 'object' && '$metadata' in err
          ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
          : undefined;
      if (status !== 409) {
        throw err;
      }
    }
  }
  await client.send(
    new PutBucketPolicyCommand({
      Bucket: BUCKET,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET}/businesses/*`],
          },
        ],
      }),
    }),
  );
  client.destroy();
}

async function postPresigned(
  url: string,
  fields: Record<string, string>,
  body: Buffer,
  contentType: string,
): Promise<Response> {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value);
  }
  form.append('file', new Blob([new Uint8Array(body)], { type: contentType }), 'upload.bin');
  return fetch(url, { method: 'POST', body: form });
}

describe('Uploads against MinIO (integration)', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService | undefined;
  let available = false;

  beforeAll(async () => {
    available = await minioReachable();
    if (!available) {
      if (process.env.CI) {
        throw new Error('MinIO must be reachable in CI for the upload integration test.');
      }
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

  it('presigned POST uploads bytes, attach stores the key, public URL returns 200', async (ctx) => {
    if (!available || !app || !prisma) {
      ctx.skip();
      return;
    }
    const tracker = new BusinessTestTracker();
    const client = s3Client();
    try {
      const owner = await createUser(app, tracker, 'minio-owner');
      const business = await createBusiness(app, tracker, owner);

      const presign = await request(app.getHttpServer())
        .post(`/api/v1/businesses/${business.id}/uploads`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('Content-Type', 'application/json')
        .send({
          kind: 'LOGO',
          contentType: 'image/png',
          contentLength: TINY_PNG.length,
        });
      expect(presign.status).toBe(201);

      const uploaded = await postPresigned(
        presign.body.url as string,
        presign.body.fields as Record<string, string>,
        TINY_PNG,
        'image/png',
      );
      expect(uploaded.status).toBe(204);

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

      await client.send(
        new DeleteObjectCommand({ Bucket: BUCKET, Key: presign.body.key as string }),
      );
    } finally {
      await tracker.cleanup(prisma);
      client.destroy();
    }
  });

  it('rejects a POST with the wrong Content-Type (403 from storage)', async (ctx) => {
    if (!available || !app || !prisma) {
      ctx.skip();
      return;
    }
    const tracker = new BusinessTestTracker();
    try {
      const owner = await createUser(app, tracker, 'minio-ctype');
      const business = await createBusiness(app, tracker, owner);

      const presign = await request(app.getHttpServer())
        .post(`/api/v1/businesses/${business.id}/uploads`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('Content-Type', 'application/json')
        .send({
          kind: 'LOGO',
          contentType: 'image/png',
          contentLength: TINY_PNG.length,
        });
      expect(presign.status).toBe(201);

      const fields = { ...(presign.body.fields as Record<string, string>) };
      fields['Content-Type'] = 'image/jpeg';
      const uploaded = await postPresigned(
        presign.body.url as string,
        fields,
        TINY_PNG,
        'image/jpeg',
      );
      expect(uploaded.status).toBe(403);
    } finally {
      await tracker.cleanup(prisma);
    }
  });

  it('rejects a POST larger than 5 MiB (EntityTooLarge from storage)', async (ctx) => {
    if (!available || !app || !prisma) {
      ctx.skip();
      return;
    }
    const tracker = new BusinessTestTracker();
    try {
      const owner = await createUser(app, tracker, 'minio-big');
      const business = await createBusiness(app, tracker, owner);

      const presign = await request(app.getHttpServer())
        .post(`/api/v1/businesses/${business.id}/uploads`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('Content-Type', 'application/json')
        .send({
          kind: 'COVER',
          contentType: 'image/png',
          contentLength: UPLOAD_MAX_BYTES,
        });
      expect(presign.status).toBe(201);

      const oversized = Buffer.alloc(UPLOAD_MAX_BYTES + 1, 1);
      const uploaded = await postPresigned(
        presign.body.url as string,
        presign.body.fields as Record<string, string>,
        oversized,
        'image/png',
      );
      // Pigsty MinIO returns 400 EntityTooLarge for content-length-range violations (not 403).
      expect(uploaded.status).toBe(400);
      expect(await uploaded.text()).toContain('EntityTooLarge');
    } finally {
      await tracker.cleanup(prisma);
    }
  });
});
