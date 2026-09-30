import { HttpStatus, Injectable } from '@nestjs/common';
import type {
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
import { buildObjectKey, isKeyUnderPrefix, keyPrefixFor } from './object-keys.js';
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
    return {
      key,
      url: result.url,
      fields: result.fields,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  async attachLogo(businessId: string, input: AttachUploadRequest) {
    await this.attachBusinessKey(businessId, 'LOGO', 'logoKey', input.key);
    return this.getBusinessUrls(businessId);
  }

  async attachCover(businessId: string, input: AttachUploadRequest) {
    await this.attachBusinessKey(businessId, 'COVER', 'coverKey', input.key);
    return this.getBusinessUrls(businessId);
  }

  async clearLogo(businessId: string) {
    await this.clearBusinessKey(businessId, 'logoKey');
  }

  async clearCover(businessId: string) {
    await this.clearBusinessKey(businessId, 'coverKey');
  }

  async attachStaffPhoto(businessId: string, staffId: string, input: AttachUploadRequest) {
    await this.requireStaff(businessId, staffId);
    await this.verifyUploadedObject(businessId, 'STAFF_PHOTO', input.key);
    const existing = await this.prisma.staffMember.findFirst({
      where: { id: staffId, businessId, deletedAt: null },
      select: { photoKey: true },
    });
    if (!existing) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Staff member not found.');
    }
    const now = this.clock.now();
    await this.prisma.staffMember.updateMany({
      where: { id: staffId, businessId, deletedAt: null },
      data: { photoKey: input.key, updatedAt: now },
    });
    if (existing.photoKey && existing.photoKey !== input.key) {
      await this.storage.deleteObject(existing.photoKey);
    }
    return { photoUrl: this.storage.publicUrl(input.key) };
  }

  async clearStaffPhoto(businessId: string, staffId: string): Promise<void> {
    await this.requireStaff(businessId, staffId);
    const existing = await this.prisma.staffMember.findFirst({
      where: { id: staffId, businessId, deletedAt: null },
      select: { photoKey: true },
    });
    if (!existing) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Staff member not found.');
    }
    const now = this.clock.now();
    await this.prisma.staffMember.updateMany({
      where: { id: staffId, businessId, deletedAt: null },
      data: { photoKey: null, updatedAt: now },
    });
    if (existing.photoKey) {
      await this.storage.deleteObject(existing.photoKey);
    }
  }

  urlFor(key: string | null | undefined): string | null {
    return this.storage.publicUrl(key);
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
    await this.prisma.business.updateMany({
      where: { id: businessId, deletedAt: null },
      data: { [column]: key, updatedAt: now },
    });
    if (previous && previous !== key) {
      await this.storage.deleteObject(previous);
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
    await this.prisma.business.updateMany({
      where: { id: businessId, deletedAt: null },
      data: { [column]: null, updatedAt: now },
    });
    if (previous) {
      await this.storage.deleteObject(previous);
    }
  }

  private async getBusinessUrls(businessId: string): Promise<{
    logoUrl: string | null;
    coverUrl: string | null;
  }> {
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
    const prefix = keyPrefixFor(businessId, kind);
    if (!isKeyUnderPrefix(key, prefix)) {
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
    if (head.contentLength < 1 || head.contentLength > UPLOAD_MAX_BYTES) {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'UPLOAD_INVALID',
        'Upload size is out of range.',
      );
    }
  }

  private async requireStaff(businessId: string, staffId: string): Promise<void> {
    const row = await this.prisma.staffMember.findFirst({
      where: { id: staffId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!row) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Staff member not found.');
    }
  }
}
