import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type {
  CreateServiceRequest,
  Service,
  ServiceCustomFieldResponse,
  UpdateServiceRequest,
} from '@najme/contracts';
import { Prisma, type Prisma as PrismaNs } from '../../generated/prisma/index.js';
import { Clock } from '../common/clock.js';
import { apiError } from '../common/errors/api-error.js';
import { newId } from '../common/id.js';
import { PrismaService } from '../prisma/prisma.service.js';

const serviceInclude = {
  assignments: { select: { staffMemberId: true } },
  customFields: { orderBy: { sortOrder: 'asc' as const } },
} as const;

type ServiceRow = PrismaNs.ServiceGetPayload<{ include: typeof serviceInclude }>;

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async list(businessId: string): Promise<Service[]> {
    const rows = await this.prisma.service.findMany({
      where: { businessId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: serviceInclude,
    });
    return rows.map((row) => this.toService(row));
  }

  async get(businessId: string, serviceId: string): Promise<Service> {
    return this.toService(await this.requireService(businessId, serviceId));
  }

  async create(businessId: string, input: CreateServiceRequest): Promise<Service> {
    const staffMemberIds = input.staffMemberIds ?? [];
    await this.assertStaffInBusiness(businessId, staffMemberIds);
    const now = this.clock.now();
    const serviceId = newId();

    await this.prisma.$transaction(async (tx) => {
      await tx.service.create({
        data: {
          id: serviceId,
          businessId,
          name: input.name,
          description: input.description ?? null,
          durationMinutes: input.durationMinutes,
          bufferBeforeMinutes: input.bufferBeforeMinutes ?? 0,
          bufferAfterMinutes: input.bufferAfterMinutes ?? 0,
          priceAmount: input.price.amount,
          priceCurrency: input.price.currency,
          minBookingNoticeMinutes: input.minBookingNoticeMinutes ?? null,
          bookingHorizonDays: input.bookingHorizonDays ?? null,
          active: input.active ?? true,
          createdAt: now,
          updatedAt: now,
        },
      });
      if (staffMemberIds.length > 0) {
        await tx.serviceStaffAssignment.createMany({
          data: staffMemberIds.map((staffMemberId) => ({
            id: newId(),
            serviceId,
            staffMemberId,
          })),
        });
      }
      await this.replaceCustomFields(tx, serviceId, input.customFields ?? [], now);
    });

    return this.get(businessId, serviceId);
  }

  async update(
    businessId: string,
    serviceId: string,
    input: UpdateServiceRequest,
  ): Promise<Service> {
    await this.requireService(businessId, serviceId);
    if (input.staffMemberIds) {
      await this.assertStaffInBusiness(businessId, input.staffMemberIds);
    }
    const now = this.clock.now();

    await this.prisma.$transaction(async (tx) => {
      const data: PrismaNs.ServiceUpdateInput = { updatedAt: now };
      if (input.name !== undefined) data.name = input.name;
      if (input.description !== undefined) data.description = input.description;
      if (input.durationMinutes !== undefined) data.durationMinutes = input.durationMinutes;
      if (input.bufferBeforeMinutes !== undefined) {
        data.bufferBeforeMinutes = input.bufferBeforeMinutes;
      }
      if (input.bufferAfterMinutes !== undefined) {
        data.bufferAfterMinutes = input.bufferAfterMinutes;
      }
      if (input.price !== undefined) {
        data.priceAmount = input.price.amount;
        data.priceCurrency = input.price.currency;
      }
      if (input.minBookingNoticeMinutes !== undefined) {
        data.minBookingNoticeMinutes = input.minBookingNoticeMinutes;
      }
      if (input.bookingHorizonDays !== undefined) {
        data.bookingHorizonDays = input.bookingHorizonDays;
      }
      if (input.active !== undefined) data.active = input.active;

      await tx.service.update({ where: { id: serviceId }, data });

      if (input.staffMemberIds) {
        await tx.serviceStaffAssignment.deleteMany({ where: { serviceId } });
        if (input.staffMemberIds.length > 0) {
          await tx.serviceStaffAssignment.createMany({
            data: input.staffMemberIds.map((staffMemberId) => ({
              id: newId(),
              serviceId,
              staffMemberId,
            })),
          });
        }
      }

      if (input.customFields) {
        await this.replaceCustomFields(tx, serviceId, input.customFields, now);
      }
    });

    return this.get(businessId, serviceId);
  }

  async softDelete(businessId: string, serviceId: string): Promise<void> {
    await this.requireService(businessId, serviceId);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.serviceStaffAssignment.deleteMany({ where: { serviceId } });
      const result = await tx.service.updateMany({
        where: { id: serviceId, businessId, deletedAt: null },
        data: { deletedAt: now, updatedAt: now },
      });
      if (result.count === 0) {
        throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Service not found.');
      }
    });
  }

  private async assertStaffInBusiness(businessId: string, staffMemberIds: string[]): Promise<void> {
    if (staffMemberIds.length === 0) {
      return;
    }
    const unique = [...new Set(staffMemberIds)];
    const found = await this.prisma.staffMember.findMany({
      where: { businessId, deletedAt: null, id: { in: unique } },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new HttpException(
        {
          code: 'VALIDATION_FAILED',
          message: 'One or more staff members are invalid for this business.',
          details: { staffMemberIds: unique.filter((id) => !found.some((row) => row.id === id)) },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async replaceCustomFields(
    tx: PrismaNs.TransactionClient,
    serviceId: string,
    fields: NonNullable<CreateServiceRequest['customFields']>,
    now: Date,
  ): Promise<void> {
    const existing = await tx.serviceCustomFieldDefinition.findMany({
      where: { serviceId },
      select: { id: true, key: true },
    });
    const byKey = new Map(existing.map((row) => [row.key, row.id]));
    const keepKeys = new Set(fields.map((f) => f.key));

    for (const field of fields) {
      const options: PrismaNs.InputJsonValue | typeof Prisma.JsonNull =
        field.type === 'SELECT' ? (field.options ?? []) : Prisma.JsonNull;
      const sortOrder = field.sortOrder ?? 0;
      const existingId = byKey.get(field.key);
      if (existingId) {
        await tx.serviceCustomFieldDefinition.update({
          where: { id: existingId },
          data: {
            label: field.label,
            type: field.type,
            required: field.required,
            options,
            sortOrder,
            updatedAt: now,
          },
        });
      } else {
        await tx.serviceCustomFieldDefinition.create({
          data: {
            id: newId(),
            serviceId,
            key: field.key,
            label: field.label,
            type: field.type,
            required: field.required,
            options,
            sortOrder,
            createdAt: now,
            updatedAt: now,
          },
        });
      }
    }

    const toDelete = existing.filter((row) => !keepKeys.has(row.key)).map((row) => row.id);
    if (toDelete.length > 0) {
      await tx.serviceCustomFieldDefinition.deleteMany({ where: { id: { in: toDelete } } });
    }
  }

  private async requireService(businessId: string, serviceId: string): Promise<ServiceRow> {
    const row = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId, deletedAt: null },
      include: serviceInclude,
    });
    if (!row) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Service not found.');
    }
    return row;
  }

  private toService(row: ServiceRow): Service {
    const customFields: ServiceCustomFieldResponse[] = row.customFields.map((field) => ({
      id: field.id,
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      options: Array.isArray(field.options)
        ? field.options.filter((o): o is string => typeof o === 'string')
        : null,
      sortOrder: field.sortOrder,
    }));

    return {
      id: row.id,
      businessId: row.businessId,
      name: row.name,
      description: row.description,
      durationMinutes: row.durationMinutes,
      bufferBeforeMinutes: row.bufferBeforeMinutes,
      bufferAfterMinutes: row.bufferAfterMinutes,
      price: { amount: row.priceAmount, currency: row.priceCurrency as 'EUR' },
      minBookingNoticeMinutes: row.minBookingNoticeMinutes,
      bookingHorizonDays: row.bookingHorizonDays,
      active: row.active,
      staffMemberIds: row.assignments.map((a) => a.staffMemberId),
      customFields,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
