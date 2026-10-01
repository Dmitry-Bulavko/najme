import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  AdminBusinessDetail,
  AdminBusinessListItem,
  AdminBusinessListQuery,
  AdminBusinessListResponse,
  BusinessStatus,
  RejectBusinessRequest,
} from '@najme/contracts';
import { adminListCursorSchema } from '@najme/contracts';
import { Clock } from '../common/clock.js';
import { apiError } from '../common/errors/api-error.js';
import { PrismaService } from '../prisma/prisma.service.js';

type CursorPayload = { createdAt: string; id: string };

@Injectable()
export class AdminBusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async list(query: AdminBusinessListQuery): Promise<AdminBusinessListResponse> {
    const status = query.status;
    const limit = query.limit;
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    const rows = await this.prisma.business.findMany({
      where: {
        deletedAt: null,
        status,
        ...(cursor
          ? {
              OR: [
                { createdAt: { gt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        city: true,
        categoryId: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
        approvedAt: true,
        reviewedAt: true,
        category: {
          select: {
            translations: {
              where: { locale: 'en' },
              take: 1,
              select: { name: true },
            },
            slug: true,
          },
        },
        memberships: {
          where: { role: 'OWNER', user: { deletedAt: null } },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: {
            user: { select: { email: true, emailVerifiedAt: true, deletedAt: true } },
          },
        },
        _count: {
          select: {
            staffMembers: { where: { deletedAt: null } },
            services: { where: { deletedAt: null } },
          },
        },
      },
    });

    const page = rows.slice(0, limit);
    const staffWithHours = await this.countStaffWithHours(page.map((r) => r.id));

    const items = page.map((row) => this.toListItem(row, staffWithHours.get(row.id) ?? 0));
    const next =
      rows.length > limit
        ? encodeCursor({
            createdAt: page[page.length - 1]!.createdAt.toISOString(),
            id: page[page.length - 1]!.id,
          })
        : null;

    return { items, nextCursor: next };
  }

  async get(businessId: string): Promise<AdminBusinessDetail> {
    const row = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        city: true,
        categoryId: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
        approvedAt: true,
        reviewedAt: true,
        category: {
          select: {
            translations: {
              where: { locale: 'en' },
              take: 1,
              select: { name: true },
            },
            slug: true,
          },
        },
        memberships: {
          where: { role: 'OWNER', user: { deletedAt: null } },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: {
            user: { select: { email: true, emailVerifiedAt: true, deletedAt: true } },
          },
        },
        _count: {
          select: {
            staffMembers: { where: { deletedAt: null } },
            services: { where: { deletedAt: null } },
          },
        },
      },
    });
    if (!row) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Business not found.');
    }
    const hours = await this.countStaffWithHours([row.id]);
    return this.toListItem(row, hours.get(row.id) ?? 0);
  }

  async approve(businessId: string, adminUserId: string): Promise<AdminBusinessDetail> {
    const now = this.clock.now();
    const existing = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Business not found.');
    }
    const result = await this.prisma.business.updateMany({
      where: {
        id: businessId,
        deletedAt: null,
        status: { in: ['PENDING_APPROVAL', 'REJECTED'] },
      },
      data: {
        status: 'APPROVED',
        approvedAt: now,
        reviewedAt: now,
        reviewedByUserId: adminUserId,
        // Cleared on approve so the queue does not keep a stale reject note after re-approval.
        rejectionReason: null,
        updatedAt: now,
      },
    });
    if (result.count !== 1) {
      throw apiError(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'Business cannot be approved from its current status.',
      );
    }
    return this.get(businessId);
  }

  async reject(
    businessId: string,
    adminUserId: string,
    input: RejectBusinessRequest,
  ): Promise<AdminBusinessDetail> {
    const now = this.clock.now();
    const existing = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Business not found.');
    }
    const result = await this.prisma.business.updateMany({
      where: {
        id: businessId,
        deletedAt: null,
        status: 'PENDING_APPROVAL',
      },
      data: {
        status: 'REJECTED',
        rejectionReason: input.reason,
        reviewedAt: now,
        reviewedByUserId: adminUserId,
        updatedAt: now,
      },
    });
    if (result.count !== 1) {
      throw apiError(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'Business cannot be rejected from its current status.',
      );
    }
    return this.get(businessId);
  }

  private async countStaffWithHours(businessIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const id of businessIds) map.set(id, 0);
    if (businessIds.length === 0) return map;

    const grouped = await this.prisma.staffMember.groupBy({
      by: ['businessId'],
      where: {
        businessId: { in: businessIds },
        deletedAt: null,
        workingHours: { some: {} },
      },
      _count: { _all: true },
    });
    for (const row of grouped) {
      map.set(row.businessId, row._count._all);
    }
    return map;
  }

  private toListItem(
    row: {
      id: string;
      name: string;
      slug: string;
      status: BusinessStatus;
      city: AdminBusinessListItem['city'];
      categoryId: string;
      rejectionReason: string | null;
      createdAt: Date;
      updatedAt: Date;
      approvedAt: Date | null;
      reviewedAt: Date | null;
      category: {
        translations: Array<{ name: string }>;
        slug: string;
      };
      memberships: Array<{
        user: { email: string; emailVerifiedAt: Date | null; deletedAt: Date | null };
      }>;
      _count: { staffMembers: number; services: number };
    },
    staffWithWorkingHoursCount: number,
  ): AdminBusinessListItem {
    const owner = row.memberships[0]?.user;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      city: row.city,
      categoryId: row.categoryId,
      categoryName: row.category.translations[0]?.name ?? row.category.slug,
      ownerEmail: owner && !owner.deletedAt ? owner.email : null,
      ownerEmailVerified: owner && !owner.deletedAt ? owner.emailVerifiedAt !== null : null,
      staffCount: row._count.staffMembers,
      servicesCount: row._count.services,
      staffWithWorkingHoursCount,
      rejectionReason: row.rejectionReason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      approvedAt: row.approvedAt?.toISOString() ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    };
  }
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(raw: string): CursorPayload {
  try {
    const json: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    const parsed = adminListCursorSchema.safeParse(json);
    if (!parsed.success) throw new Error('invalid');
    return parsed.data;
  } catch {
    throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid cursor.');
  }
}
