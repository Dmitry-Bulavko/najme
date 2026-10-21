import type { UploadContentType, UploadKind } from '@najme/contracts';
import { newId } from '../common/id.js';

const EXT_BY_TYPE: Record<UploadContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const TYPE_BY_EXT: Record<string, UploadContentType> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const KIND_SEGMENT: Record<UploadKind, string> = {
  LOGO: 'logo',
  COVER: 'cover',
  STAFF_PHOTO: 'staff',
};

export function extensionForContentType(contentType: UploadContentType): string {
  return EXT_BY_TYPE[contentType];
}

export function contentTypeForExtension(ext: string): UploadContentType | undefined {
  return TYPE_BY_EXT[ext];
}

export function kindSegment(kind: UploadKind): string {
  return KIND_SEGMENT[kind];
}

/** `businesses/<businessId>/<logo|cover|staff>/<uuidv7>.<ext>` */
export function buildObjectKey(
  businessId: string,
  kind: UploadKind,
  contentType: UploadContentType,
): string {
  const ext = extensionForContentType(contentType);
  return `businesses/${businessId}/${kindSegment(kind)}/${newId()}.${ext}`;
}

export function publicObjectUrl(publicBaseUrl: string, key: string): string {
  return `${publicBaseUrl.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`;
}

/** Prefix every object for this business+kind must live under. */
export function keyPrefixFor(businessId: string, kind: UploadKind): string {
  return `businesses/${businessId}/${kindSegment(kind)}/`;
}

/**
 * Strict key shape for attach: prefix + uuid + allowed extension, no path tricks.
 * UUID is the canonical 8-4-4-4-12 hex form (v7 from {@link newId}).
 */
export function isValidUploadKey(key: string, businessId: string, kind: UploadKind): boolean {
  const segment = kindSegment(kind);
  const pattern = new RegExp(
    `^businesses/${businessId}/${segment}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)$`,
  );
  return pattern.test(key);
}
