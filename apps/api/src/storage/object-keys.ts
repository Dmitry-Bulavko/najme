import type { UploadContentType, UploadKind } from '@najme/contracts';
import { UPLOAD_MAX_BYTES } from '@najme/contracts';
import { newId } from '../common/id.js';

const EXT_BY_TYPE: Record<UploadContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const KIND_SEGMENT: Record<UploadKind, string> = {
  LOGO: 'logo',
  COVER: 'cover',
  STAFF_PHOTO: 'staff',
};

export { UPLOAD_MAX_BYTES };

export function extensionForContentType(contentType: UploadContentType): string {
  return EXT_BY_TYPE[contentType];
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

export function isKeyUnderPrefix(key: string, prefix: string): boolean {
  return key.startsWith(prefix) && !key.includes('..');
}
