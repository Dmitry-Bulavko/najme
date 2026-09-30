import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CreateStaffMemberRequest,
  StaffMember,
  UpdateStaffMemberRequest,
} from '@najme/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { Clock } from '../common/clock.js';
import { apiError } from '../common/errors/api-error.js';
import { newId } from '../common/id.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ObjectStorage } from '../storage/object-storage.js';

const staffSelect = {
  id: true,
  businessId: true,
  displayName: true,
  photoKey: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const satisfies Prisma.StaffMemberSelect;

type StaffRow = Prisma.StaffMemberGetPayload<{ select: typeof staffSelect }>;

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly storage: ObjectStorage,
  ) {}

  async list(businessId: string): Promise<StaffMember[]> {
    const rows = await this.prisma.staffMember.findMany({
      where: { businessId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: staffSelect,
    });
    return rows.map((row) => this.toStaff(row));
  }

  async create(businessId: string, input: CreateStaffMemberRequest): Promise<StaffMember> {
    const now = this.clock.now();
    const row = await this.prisma.staffMember.create({
      data: {
        id: newId(),
        businessId,
        displayName: input.displayName,
        active: input.active ?? true,
        createdAt: now,
        updatedAt: now,
      },
      select: staffSelect,
    });
    return this.toStaff(row);
  }

  async get(businessId: string, staffId: string): Promise<StaffMember> {
    return this.toStaff(await this.requireStaff(businessId, staffId));
  }

  async update(
    businessId: string,
    staffId: string,
    input: UpdateStaffMemberRequest,
  ): Promise<StaffMember> {
    const result = await this.prisma.staffMember.updateMany({
      where: { id: staffId, businessId, deletedAt: null },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        updatedAt: this.clock.now(),
      },
    });
    if (result.count === 0) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Staff member not found.');
    }
    return this.get(businessId, staffId);
  }

  async softDelete(businessId: string, staffId: string): Promise<void> {
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.serviceStaffAssignment.deleteMany({ where: { staffMemberId: staffId } });
      await tx.membership.updateMany({
        where: { staffMemberId: staffId },
        data: { staffMemberId: null, updatedAt: now },
      });
      // Soft-delete does not CASCADE — clear schedule config explicitly (#75).
      await tx.workingHours.deleteMany({ where: { staffMemberId: staffId } });
      await tx.timeOff.deleteMany({
        where: { staffMemberId: staffId, endsAt: { gt: now } },
      });
      const result = await tx.staffMember.updateMany({
        where: { id: staffId, businessId, deletedAt: null },
        data: { deletedAt: now, updatedAt: now },
      });
      if (result.count === 0) {
        throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Staff member not found.');
      }
    });
  }

  private async requireStaff(businessId: string, staffId: string): Promise<StaffRow> {
    const row = await this.prisma.staffMember.findFirst({
      where: { id: staffId, businessId, deletedAt: null },
      select: staffSelect,
    });
    if (!row) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Staff member not found.');
    }
    return row;
  }

  private toStaff(row: StaffRow): StaffMember {
    return {
      id: row.id,
      businessId: row.businessId,
      displayName: row.displayName,
      photoUrl: this.storage.publicUrl(row.photoKey),
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
