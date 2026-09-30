import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CreateTimeOffRequest,
  ListTimeOffQuery,
  MembershipRole,
  PutWorkingHoursRequest,
  TimeOff,
  WorkingHoursResponse,
} from '@najme/contracts';
import { hhMmEndToMinutes, minutesToHhMmEnd } from '@najme/contracts';
import { BUSINESS_TIMEZONE, localToUtc } from '../common/business-time.js';
import { Clock } from '../common/clock.js';
import { apiError } from '../common/errors/api-error.js';
import { newId } from '../common/id.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MAX_TIME_OFF_MS = 366 * 24 * 60 * 60 * 1000;

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  /**
   * OWNER/ADMIN: any staff of the business.
   * STAFF: only their linked staffMemberId (403 otherwise), including GET.
   */
  assertStaffAccess(
    role: MembershipRole,
    linkedStaffMemberId: string | null | undefined,
    staffId: string,
  ): void {
    if (role === 'OWNER' || role === 'ADMIN') {
      return;
    }
    if (role === 'STAFF' && linkedStaffMemberId === staffId) {
      return;
    }
    throw apiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Insufficient role for this staff member.');
  }

  async getLinkedStaffMemberId(membershipId: string): Promise<string | null> {
    const row = await this.prisma.membership.findUnique({
      where: { id: membershipId },
      select: { staffMemberId: true },
    });
    return row?.staffMemberId ?? null;
  }

  async requireStaffInBusiness(businessId: string, staffId: string): Promise<void> {
    const row = await this.prisma.staffMember.findFirst({
      where: { id: staffId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!row) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Staff member not found.');
    }
  }

  async getWorkingHours(staffId: string): Promise<WorkingHoursResponse> {
    const rows = await this.prisma.workingHours.findMany({
      where: { staffMemberId: staffId },
      orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
    });
    return {
      intervals: rows.map((row) => ({
        weekday: row.weekday,
        start: minutesToHhMmEnd(row.startMinute),
        end: minutesToHhMmEnd(row.endMinute),
      })),
    };
  }

  async putWorkingHours(
    staffId: string,
    input: PutWorkingHoursRequest,
  ): Promise<WorkingHoursResponse> {
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.workingHours.deleteMany({ where: { staffMemberId: staffId } });
      if (input.intervals.length === 0) {
        return;
      }
      await tx.workingHours.createMany({
        data: input.intervals.map((interval) => {
          const startMinute = hhMmEndToMinutes(interval.start);
          const endMinute = hhMmEndToMinutes(interval.end);
          if (startMinute === null || endMinute === null) {
            throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid interval.');
          }
          return {
            id: newId(),
            staffMemberId: staffId,
            weekday: interval.weekday,
            startMinute,
            endMinute,
            createdAt: now,
            updatedAt: now,
          };
        }),
      });
    });
    return this.getWorkingHours(staffId);
  }

  async listTimeOff(staffId: string, query: ListTimeOffQuery): Promise<TimeOff[]> {
    const now = this.clock.now();
    const from = query.from ? new Date(query.from) : now;
    const to = query.to ? new Date(query.to) : undefined;
    const rows = await this.prisma.timeOff.findMany({
      where: {
        staffMemberId: staffId,
        endsAt: { gt: from },
        ...(to ? { startsAt: { lt: to } } : {}),
      },
      orderBy: { startsAt: 'asc' },
    });
    return rows.map((row) => this.toTimeOff(row));
  }

  async createTimeOff(staffId: string, input: CreateTimeOffRequest): Promise<TimeOff> {
    const startsAt = localToUtc(input.start, BUSINESS_TIMEZONE);
    const endsAt = localToUtc(input.end, BUSINESS_TIMEZONE);
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'end must be after start.');
    }
    if (endsAt.getTime() - startsAt.getTime() > MAX_TIME_OFF_MS) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Time off may span at most 366 days.',
      );
    }
    const now = this.clock.now();
    const row = await this.prisma.timeOff.create({
      data: {
        id: newId(),
        staffMemberId: staffId,
        startsAt,
        endsAt,
        reason: input.reason ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.toTimeOff(row);
  }

  async deleteTimeOff(staffId: string, timeOffId: string): Promise<void> {
    const result = await this.prisma.timeOff.deleteMany({
      where: { id: timeOffId, staffMemberId: staffId },
    });
    if (result.count === 0) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Time off not found.');
    }
  }

  private toTimeOff(row: {
    id: string;
    staffMemberId: string;
    startsAt: Date;
    endsAt: Date;
    reason: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): TimeOff {
    return {
      id: row.id,
      staffMemberId: row.staffMemberId,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      reason: row.reason,
      conflictingBookings: [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
