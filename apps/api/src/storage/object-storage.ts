export type PresignPostInput = {
  key: string;
  contentType: string;
  maxBytes: number;
  expiresInSeconds: number;
};

export type PresignPostResult = {
  url: string;
  fields: Record<string, string>;
  expiresAt: Date;
};

export type ObjectHead = {
  contentType: string;
  contentLength: number;
};

/**
 * Object-storage seam (ADR-0014). Production uses S3-compatible APIs; tests substitute a fake.
 * Implementations must not open network connections in the constructor.
 */
export abstract class ObjectStorage {
  abstract createPresignedPost(input: PresignPostInput): Promise<PresignPostResult>;

  abstract headObject(key: string): Promise<ObjectHead | null>;

  /** Best-effort delete — implementations log and swallow failures. */
  abstract deleteObject(key: string): Promise<void>;

  /** Absolute public URL for a stored key (or null when key is null/empty). */
  abstract publicUrl(key: string | null | undefined): string | null;
}
