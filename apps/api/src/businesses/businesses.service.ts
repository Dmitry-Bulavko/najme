import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  Business,
  CreateBusinessRequest,
  MembershipRole,
  MyBusiness,
  UpdateBusinessRequest,
} from '@najme/contracts';
import type { Prisma } from '../../generated/prisma/index.js';
import { Clock } from '../common/clock.js';
import { apiError } from '../common/errors/api-error.js';
import { newId } from '../common/id.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { BusinessMembership } from './business-access.types.js';
import {
  ensureValidBusinessSlug,
  isValidBusinessSlug,
  nextSlugCandidate,
  slugifyBusinessName,
} from './slug.js';

const BUSINESS_TIMEZONE = 'Europe/Podgorica' as const;

const businessSelect = {
  id: true,
  name: true,
  slug: true,
  categoryId: true,
  description: true,
  timezone: true,
  city: true,
  address: true,
  contactPhone: true,
  contactEmail: true,
  logoKey: true,
  coverKey: true,
  confirmationMode: true,
  cancellationWindowMinutes: true,
  minBookingNoticeMinutes: true,
  bookingHorizonDays: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const satisfies Prisma.BusinessSelect;

type BusinessRow = Prisma.BusinessGetPayload<{ select: typeof businessSelect }>;

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async create(userId: string, input: CreateBusinessRequest): Promise<Business> {
    const category = await this.prisma.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true },
    });
    if (!category) {
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Unknown category.');
    }

    const owner = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { displayName: true, email: true },
    });

    const base = ensureValidBusinessSlug(slugifyBusinessName(input.name));
    const businessId = newId();
    const membershipId = newId();
    const now = this.clock.now();

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const slug = nextSlugCandidate(base, attempt);
      try {
        const row = await this.prisma.$transaction(async (tx) => {
          const created = await tx.business.create({
            data: {
              id: businessId,
              name: input.name,
              slug,
              categoryId: input.categoryId,
              description: input.description ?? null,
              timezone: BUSINESS_TIMEZONE,
              city: input.city,
              address: input.address ?? null,
              contactPhone: input.contactPhone ?? null,
              contactEmail: input.contactEmail ?? null,
              createdAt: now,
              updatedAt: now,
            },
            select: businessSelect,
          });

          let staffMemberId: string | null = null;
          if (input.ownerIsStaff) {
            staffMemberId = newId();
            const displayName = owner.displayName?.trim() || owner.email.split('@')[0] || 'Owner';
            await tx.staffMember.create({
              data: {
                id: staffMemberId,
                businessId,
                displayName,
                createdAt: now,
                updatedAt: now,
              },
            });
          }

          await tx.membership.create({
            data: {
              id: membershipId,
              userId,
              businessId,
              role: 'OWNER',
              staffMemberId,
              createdAt: now,
              updatedAt: now,
            },
          });
          return created;
        });
        return this.toBusiness(row, 'OWNER');
      } catch (err) {
        if (this.isUniqueViolation(err, 'businesses_slug_key')) {
          continue;
        }
        throw err;
      }
    }

    throw apiError(HttpStatus.CONFLICT, 'SLUG_TAKEN', 'Could not allocate a unique slug.');
  }

  async listMine(userId: string): Promise<MyBusiness[]> {
    const rows = await this.prisma.membership.findMany({
      where: { userId, business: { deletedAt: null } },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        staffMemberId: true,
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            logoKey: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      businessId: row.business.id,
      name: row.business.name,
      slug: row.business.slug,
      status: row.business.status,
      role: row.role,
      staffMemberId: row.staffMemberId,
      logoUrl: null,
    }));
  }

  async getForMember(membership: BusinessMembership): Promise<Business> {
    const row = await this.requireBusiness(membership.businessId);
    return this.toBusiness(row, membership.role);
  }

  async update(membership: BusinessMembership, input: UpdateBusinessRequest): Promise<Business> {
    const existing = await this.requireBusiness(membership.businessId);

    if (input.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: input.categoryId },
        select: { id: true },
      });
      if (!category) {
        throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Unknown category.');
      }
    }

    if (input.slug !== undefined) {
      if (existing.status === 'APPROVED') {
        throw apiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'SLUG_LOCKED',
          'Slug cannot be changed after approval.',
        );
      }
      if (!isValidBusinessSlug(input.slug)) {
        throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid slug.');
      }
      if (input.slug !== existing.slug) {
        const taken = await this.prisma.business.findUnique({
          where: { slug: input.slug },
          select: { id: true },
        });
        if (taken) {
          throw apiError(HttpStatus.CONFLICT, 'SLUG_TAKEN', 'Slug is already taken.');
        }
      }
    }

    const data: Prisma.BusinessUpdateInput = {
      updatedAt: this.clock.now(),
    };
    if (input.name !== undefined) data.name = input.name;
    if (input.categoryId !== undefined) {
      data.category = { connect: { id: input.categoryId } };
    }
    if (input.city !== undefined) data.city = input.city;
    if (input.description !== undefined) data.description = input.description;
    if (input.address !== undefined) data.address = input.address;
    if (input.contactPhone !== undefined) data.contactPhone = input.contactPhone;
    if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail;
    if (input.confirmationMode !== undefined) data.confirmationMode = input.confirmationMode;
    if (input.cancellationWindowMinutes !== undefined) {
      data.cancellationWindowMinutes = input.cancellationWindowMinutes;
    }
    if (input.minBookingNoticeMinutes !== undefined) {
      data.minBookingNoticeMinutes = input.minBookingNoticeMinutes;
    }
    if (input.bookingHorizonDays !== undefined) {
      data.bookingHorizonDays = input.bookingHorizonDays;
    }
    if (input.slug !== undefined) data.slug = input.slug;

    try {
      const row = await this.prisma.business.update({
        where: { id: membership.businessId },
        data,
        select: businessSelect,
      });
      return this.toBusiness(row, membership.role);
    } catch (err) {
      if (this.isUniqueViolation(err, 'businesses_slug_key')) {
        throw apiError(HttpStatus.CONFLICT, 'SLUG_TAKEN', 'Slug is already taken.');
      }
      throw err;
    }
  }

  async softDelete(membership: BusinessMembership): Promise<void> {
    const result = await this.prisma.business.updateMany({
      where: { id: membership.businessId, deletedAt: null },
      data: { deletedAt: this.clock.now() },
    });
    if (result.count === 0) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Business not found.');
    }
  }

  private async requireBusiness(businessId: string): Promise<BusinessRow> {
    const row = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
      select: businessSelect,
    });
    if (!row) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Business not found.');
    }
    return row;
  }

  private toBusiness(row: BusinessRow, myRole: MembershipRole): Business {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      categoryId: row.categoryId,
      description: row.description,
      timezone: BUSINESS_TIMEZONE,
      city: row.city,
      address: row.address,
      contactPhone: row.contactPhone,
      contactEmail: row.contactEmail,
      logoUrl: null,
      coverUrl: null,
      confirmationMode: row.confirmationMode,
      cancellationWindowMinutes: row.cancellationWindowMinutes,
      minBookingNoticeMinutes: row.minBookingNoticeMinutes,
      bookingHorizonDays: row.bookingHorizonDays,
      status: row.status,
      myRole,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private isUniqueViolation(err: unknown, constraint: string): boolean {
    if (!err || typeof err !== 'object') {
      return false;
    }
    const prismaErr = err as {
      code?: string;
      meta?: {
        target?: string[] | string;
        driverAdapterError?: { constraint?: { fields?: string[] } };
      };
    };
    if (prismaErr.code !== 'P2002') {
      return false;
    }
    const target = prismaErr.meta?.target;
    if (typeof target === 'string') {
      return target.includes('slug') || target === constraint;
    }
    if (Array.isArray(target)) {
      return target.includes('slug');
    }
    return true;
  }
}
