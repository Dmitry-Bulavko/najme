import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  AttachBusinessImageResponse,
  AttachStaffPhotoResponse,
  AttachUploadRequest,
  CreateUploadRequest,
  CreateUploadResponse,
  UploadContentType,
  UploadKind,
} from '@najme/contracts';
import { UPLOAD_MAX_BYTES } from '@najme/contracts';
import { Clock } from '../common/clock.js';
import { apiError } from '../common/errors/api-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { contentTypeForExtension, isValidUploadKey, buildObjectKey } from './object-keys.js';
import { ObjectStorage } from './object-storage.js';

const PRESIGN_TTL_SECONDS = 10 * 60;
const ALLOWED_TYPES = new Set<UploadContentType>(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class UploadsService {
  constructor(
    private readonly storage: ObjectStorage,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async createPresignedUpload(
    businessId: string,
    input: CreateUploadRequest,
  ): Promise<CreateUploadResponse> {
    const key = buildObjectKey(businessId, input.kind, input.contentType);
    const result = await this.storage.createPresignedPost({
      key,
      contentType: input.contentType,
      maxBytes: UPLOAD_MAX_BYTES,
      expiresInSeconds: PRESIGN_TTL_SECONDS,
    });
    const expiresAt = new Date(this.clock.now().getTime() + PRESIGN_TTL_SECONDS * 1000);
    return {
      key,
      url: result.url,
      fields: result.fields,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async attachLogo(
    businessId: string,
    input: AttachUploadRequest,
  ): Promise<AttachBusinessImageResponse> {
    await this.attachBusinessKey(businessId, 'LOGO', 'logoKey', input.key);
    return this.getBusinessUrls(businessId);
  }

  async attachCover(
    businessId: string,
    input: AttachUploadRequest,
  ): Promise<AttachBusinessImageResponse> {
    await this.attachBusinessKey(businessId, 'COVER', 'coverKey', input.key);
    return this.getBusinessUrls(businessId);
  }

  async clearLogo(businessId: string) {
    await this.clearBusinessKey(businessId, 'logoKey');
  }

  async clearCover(businessId: string) {
    await this.clearBusinessKey(businessId, 'coverKey');
  }

  async attachStaffPhoto(
    businessId: string,
    staffId: string,
    input: AttachUploadRequest,
  ): Promise<AttachStaffPhotoResponse> {
    const existing = await this.prisma.staffMember.findFirst({
      where: { id: staffId, businessId, deletedAt: null },
      select: { id: true, photoKey: true },
    });
    if (!existing) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Staff member not found.');
    }

    await this.verifyUploadedObject(businessId, 'STAFF_PHOTO', input.key);

    const shared = await this.prisma.staffMember.findFirst({
      where: {
        businessId,
        deletedAt: null,
        photoKey: input.key,
        NOT: { id: staffId },
      },
      select: { id: true },
    });
    if (shared) {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'UPLOAD_INVALID',
        'Upload key is already attached to another staff member.',
      );
    }

    const previous = existing.photoKey;
    const now = this.clock.now();
    const updated = await this.prisma.staffMember.updateMany({
      where: { id: staffId, businessId, deletedAt: null, photoKey: previous },
      data: { photoKey: input.key, updatedAt: now },
    });
    if (updated.count === 0) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Staff member not found.');
    }
    if (previous && previous !== input.key) {
      await this.deleteObjectIfUnreferenced(previous);
    }
    return { photoUrl: this.storage.publicUrl(input.key) };
  }

  async clearStaffPhoto(businessId: string, staffId: string): Promise<void> {
    const existing = await this.prisma.staffMember.findFirst({
      where: { id: staffId, businessId, deletedAt: null },
      select: { photoKey: true },
    });
    if (!existing) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Staff member not found.');
    }
    const previous = existing.photoKey;
    const now = this.clock.now();
    const updated = await this.prisma.staffMember.updateMany({
      where: { id: staffId, businessId, deletedAt: null, photoKey: previous },
      data: { photoKey: null, updatedAt: now },
    });
    if (updated.count === 0) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Staff member not found.');
    }
    if (previous) {
      await this.deleteObjectIfUnreferenced(previous);
    }
  }

  private async attachBusinessKey(
    businessId: string,
    kind: UploadKind,
    column: 'logoKey' | 'coverKey',
    key: string,
  ): Promise<void> {
    await this.verifyUploadedObject(businessId, kind, key);
    const existing = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { logoKey: true, coverKey: true },
    });
    if (!existing) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Business not found.');
    }
    const previous = existing[column];
    const now = this.clock.now();
    const updated = await this.prisma.business.updateMany({
      where: { id: businessId, deletedAt: null, [column]: previous },
      data: { [column]: key, updatedAt: now },
    });
    if (updated.count === 0) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Business not found.');
    }
    if (previous && previous !== key) {
      await this.deleteObjectIfUnreferenced(previous);
    }
  }

  private async clearBusinessKey(
    businessId: string,
    column: 'logoKey' | 'coverKey',
  ): Promise<void> {
    const existing = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { logoKey: true, coverKey: true },
    });
    if (!existing) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Business not found.');
    }
    const previous = existing[column];
    const now = this.clock.now();
    const updated = await this.prisma.business.updateMany({
      where: { id: businessId, deletedAt: null, [column]: previous },
      data: { [column]: null, updatedAt: now },
    });
    if (updated.count === 0) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Business not found.');
    }
    if (previous) {
      await this.deleteObjectIfUnreferenced(previous);
    }
  }

  private async getBusinessUrls(businessId: string): Promise<AttachBusinessImageResponse> {
    const row = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { logoKey: true, coverKey: true },
    });
    if (!row) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Business not found.');
    }
    return {
      logoUrl: this.storage.publicUrl(row.logoKey),
      coverUrl: this.storage.publicUrl(row.coverKey),
    };
  }

  private async verifyUploadedObject(
    businessId: string,
    kind: UploadKind,
    key: string,
  ): Promise<void> {
    if (!isValidUploadKey(key, businessId, kind)) {
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'UPLOAD_INVALID', 'Upload key is invalid.');
    }
    const head = await this.storage.headObject(key);
    if (!head) {
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'UPLOAD_INVALID', 'Upload object not found.');
    }
    if (!ALLOWED_TYPES.has(head.contentType as UploadContentType)) {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'UPLOAD_INVALID',
        'Upload content type is not allowed.',
      );
    }
    const ext = key.slice(key.lastIndexOf('.') + 1);
    const expectedType = contentTypeForExtension(ext);
    if (!expectedType || expectedType !== head.contentType) {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'UPLOAD_INVALID',
        'Upload content type does not match the key extension.',
      );
    }
    if (head.contentLength < 1 || head.contentLength > UPLOAD_MAX_BYTES) {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'UPLOAD_INVALID',
        'Upload size is out of range.',
      );
    }
  }

  /** Skip best-effort delete while any live row still references the key. */
  private async deleteObjectIfUnreferenced(key: string): Promise<void> {
    const [staffRefs, businessRefs] = await Promise.all([
      this.prisma.staffMember.count({
        where: { photoKey: key, deletedAt: null },
      }),
      this.prisma.business.count({
        where: {
          deletedAt: null,
          OR: [{ logoKey: key }, { coverKey: key }],
        },
      }),
    ]);
    if (staffRefs + businessRefs > 0) {
      return;
    }
    await this.storage.deleteObject(key);
  }
}
