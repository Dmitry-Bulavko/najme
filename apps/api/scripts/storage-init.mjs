#!/usr/bin/env node
/**
 * Create the app bucket and anonymous read under businesses/*.
 * Shared by compose.dev (minio-init) and CI — uses @aws-sdk/client-s3 (no mc image).
 * CORS is configured on the MinIO server via MINIO_API_CORS_ALLOW_ORIGIN (compose/CI),
 * because PutBucketCors is not implemented on the Pigsty MinIO image.
 *
 * Env: STORAGE_ENDPOINT, STORAGE_REGION, STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID,
 *      STORAGE_SECRET_ACCESS_KEY.
 */
import { CreateBucketCommand, PutBucketPolicyCommand, S3Client } from '@aws-sdk/client-s3';

const endpoint = (process.env.STORAGE_ENDPOINT ?? 'http://127.0.0.1:9000').replace(/\/+$/, '');
const region = process.env.STORAGE_REGION ?? 'us-east-1';
const bucket = process.env.STORAGE_BUCKET ?? 'najme';
const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID ?? 'minioadmin';
const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY ?? 'minioadmin';

const client = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
  // Newer AWS SDK default checksum headers are not implemented by MinIO/Pigsty.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

async function waitForStorage(attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${endpoint}/minio/health/live`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`storage not healthy at ${endpoint}`);
}

async function ensureBucket() {
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const status =
      err && typeof err === 'object' && '$metadata' in err
        ? /** @type {{ $metadata?: { httpStatusCode?: number } }} */ (err).$metadata?.httpStatusCode
        : undefined;
    if (name !== 'BucketAlreadyOwnedByYou' && name !== 'BucketAlreadyExists' && status !== 409) {
      throw err;
    }
  }
}

async function main() {
  await waitForStorage();
  await ensureBucket();
  await client.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucket}/businesses/*`],
          },
        ],
      }),
    }),
  );
  console.log(`storage-init: bucket=${bucket} endpoint=${endpoint} ok`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => client.destroy());
