import { publicObjectUrl } from './object-keys.js';
import {
  type ObjectHead,
  ObjectStorage,
  type PresignPostInput,
  type PresignPostResult,
} from './object-storage.js';

type StoredObject = {
  contentType: string;
  contentLength: number;
  body?: Buffer;
};

/**
 * In-memory ObjectStorage for e2e. Call {@link put} to simulate a completed browser upload
 * before attach endpoints run HeadObject.
 */
export class FakeObjectStorage extends ObjectStorage {
  readonly objects = new Map<string, StoredObject>();
  readonly deletedKeys: string[] = [];
  private readonly publicBaseUrl: string;
  private readonly postUrl: string;

  constructor(opts?: { publicBaseUrl?: string; postUrl?: string }) {
    super();
    this.publicBaseUrl = opts?.publicBaseUrl ?? 'http://localhost:9000/najme';
    this.postUrl = opts?.postUrl ?? 'http://localhost:9000/najme';
  }

  put(key: string, contentType: string, contentLength: number, body?: Buffer): void {
    this.objects.set(key, { contentType, contentLength, body });
  }

  async createPresignedPost(input: PresignPostInput): Promise<PresignPostResult> {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    return {
      url: this.postUrl,
      fields: {
        key: input.key,
        'Content-Type': input.contentType,
        Policy: 'fake-policy',
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': 'fake',
        'X-Amz-Date': '20260101T000000Z',
        'X-Amz-Signature': 'fake',
      },
      expiresAt,
    };
  }

  async headObject(key: string): Promise<ObjectHead | null> {
    const row = this.objects.get(key);
    if (!row) {
      return null;
    }
    return { contentType: row.contentType, contentLength: row.contentLength };
  }

  async deleteObject(key: string): Promise<void> {
    this.deletedKeys.push(key);
    this.objects.delete(key);
  }

  publicUrl(key: string | null | undefined): string | null {
    if (!key) {
      return null;
    }
    return publicObjectUrl(this.publicBaseUrl, key);
  }
}
