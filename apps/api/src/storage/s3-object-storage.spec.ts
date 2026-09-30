import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import type { Env } from '../config/env.schema.js';
import { S3ObjectStorage } from './s3-object-storage.js';

const send = vi.fn();

vi.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', async () => {
  const actual = await vi.importActual<typeof import('@aws-sdk/client-s3')>('@aws-sdk/client-s3');
  class MockS3Client {
    send = send;
  }
  return {
    ...actual,
    S3Client: MockS3Client,
  };
});

const env = {
  STORAGE_REGION: 'us-east-1',
  STORAGE_ENDPOINT: 'http://localhost:9000',
  STORAGE_FORCE_PATH_STYLE: true,
  STORAGE_ACCESS_KEY_ID: 'minioadmin',
  STORAGE_SECRET_ACCESS_KEY: 'minioadmin',
  STORAGE_BUCKET: 'najme',
  STORAGE_PUBLIC_BASE_URL: 'http://localhost:9000/najme',
} as Env;

describe('S3ObjectStorage', () => {
  beforeEach(() => {
    send.mockReset();
    vi.mocked(createPresignedPost).mockReset();
  });

  it('presigns with content-type and content-length-range policy conditions', async () => {
    vi.mocked(createPresignedPost).mockResolvedValue({
      url: 'http://localhost:9000/najme',
      fields: {
        key: 'businesses/b/logo/x.png',
        Policy: Buffer.from(
          JSON.stringify({
            conditions: [
              ['content-length-range', 1, 5 * 1024 * 1024],
              ['eq', '$Content-Type', 'image/png'],
            ],
          }),
        ).toString('base64'),
        'Content-Type': 'image/png',
      },
    });

    const storage = new S3ObjectStorage(env);
    const result = await storage.createPresignedPost({
      key: 'businesses/b/logo/x.png',
      contentType: 'image/png',
      maxBytes: 5 * 1024 * 1024,
      expiresInSeconds: 600,
    });

    expect(createPresignedPost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        Bucket: 'najme',
        Key: 'businesses/b/logo/x.png',
        Conditions: [
          ['content-length-range', 1, 5 * 1024 * 1024],
          ['eq', '$Content-Type', 'image/png'],
        ],
        Fields: { 'Content-Type': 'image/png' },
      }),
    );

    const policy = result.fields.Policy;
    expect(policy).toBeTruthy();
    if (!policy) {
      throw new Error('expected Policy field on presigned POST');
    }
    const policyJson = JSON.parse(Buffer.from(policy, 'base64').toString('utf8')) as {
      conditions: unknown[];
    };
    expect(policyJson.conditions).toEqual(
      expect.arrayContaining([
        ['content-length-range', 1, 5 * 1024 * 1024],
        ['eq', '$Content-Type', 'image/png'],
      ]),
    );
  });

  it('returns null for HeadObject 404', async () => {
    send.mockRejectedValue({
      name: 'NotFound',
      $metadata: { httpStatusCode: 404 },
    });

    const storage = new S3ObjectStorage(env);
    await expect(storage.headObject('missing')).resolves.toBeNull();
    expect(send).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
  });

  it('swallows delete errors', async () => {
    send.mockRejectedValue(new Error('boom'));

    const storage = new S3ObjectStorage(env);
    await expect(storage.deleteObject('k')).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
  });
});
