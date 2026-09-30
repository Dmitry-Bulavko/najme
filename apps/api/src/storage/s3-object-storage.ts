import { Inject, Injectable, Logger } from '@nestjs/common';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { DeleteObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Env } from '../config/env.schema.js';
import { ENV } from '../config/env.token.js';
import { publicObjectUrl } from './object-keys.js';
import {
  type ObjectHead,
  ObjectStorage,
  type PresignPostInput,
  type PresignPostResult,
} from './object-storage.js';

@Injectable()
export class S3ObjectStorage extends ObjectStorage {
  private readonly logger = new Logger(S3ObjectStorage.name);
  private client: S3Client | undefined;

  constructor(@Inject(ENV) private readonly env: Env) {
    super();
  }

  /** Lazy so Nest bootstrap does not require MinIO to be up (ADR-0014). */
  private getClient(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: this.env.STORAGE_REGION,
        endpoint: this.env.STORAGE_ENDPOINT,
        forcePathStyle: this.env.STORAGE_FORCE_PATH_STYLE,
        credentials: {
          accessKeyId: this.env.STORAGE_ACCESS_KEY_ID,
          secretAccessKey: this.env.STORAGE_SECRET_ACCESS_KEY,
        },
      });
    }
    return this.client;
  }

  async createPresignedPost(input: PresignPostInput): Promise<PresignPostResult> {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    const { url, fields } = await createPresignedPost(this.getClient(), {
      Bucket: this.env.STORAGE_BUCKET,
      Key: input.key,
      Expires: input.expiresInSeconds,
      Conditions: [
        ['content-length-range', 1, input.maxBytes],
        ['eq', '$Content-Type', input.contentType],
      ],
      Fields: {
        'Content-Type': input.contentType,
      },
    });
    return { url, fields, expiresAt };
  }

  async headObject(key: string): Promise<ObjectHead | null> {
    try {
      const result = await this.getClient().send(
        new HeadObjectCommand({ Bucket: this.env.STORAGE_BUCKET, Key: key }),
      );
      const contentType = result.ContentType;
      const contentLength = result.ContentLength;
      if (!contentType || contentLength === undefined) {
        return null;
      }
      return { contentType, contentLength };
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotFound' || name === 'NoSuchKey') {
        return null;
      }
      // AWS SDK v3 often uses $metadata.httpStatusCode === 404
      if (
        err &&
        typeof err === 'object' &&
        '$metadata' in err &&
        (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.getClient().send(
        new DeleteObjectCommand({ Bucket: this.env.STORAGE_BUCKET, Key: key }),
      );
    } catch (err) {
      this.logger.warn(
        `Best-effort delete failed for key=${key} name=${err instanceof Error ? err.name : 'unknown'}`,
      );
    }
  }

  publicUrl(key: string | null | undefined): string | null {
    if (!key) {
      return null;
    }
    return publicObjectUrl(this.env.STORAGE_PUBLIC_BASE_URL, key);
  }
}
