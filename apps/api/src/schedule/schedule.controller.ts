import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createTimeOffRequestSchema,
  listTimeOffQuerySchema,
  putWorkingHoursRequestSchema,
  type CreateTimeOffRequest,
  type ListTimeOffQuery,
  type PutWorkingHoursRequest,
  type TimeOff,
  type TimeOffListResponse,
  type WorkingHoursResponse,
} from '@najme/contracts';
import { RequireJsonGuard } from '../auth/require-json.guard.js';
import { BusinessAccessGuard } from '../businesses/business-access.guard.js';
import type { BusinessMembership } from '../businesses/business-access.types.js';
import { BusinessRoles } from '../businesses/business-roles.decorator.js';
import { CurrentMembership } from '../businesses/current-membership.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ScheduleService } from './schedule.service.js';

@ApiTags('schedule')
@Controller('businesses/:businessId/staff/:staffId')
@UseGuards(BusinessAccessGuard)
@BusinessRoles('OWNER', 'ADMIN', 'STAFF')
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  private async authorize(membership: BusinessMembership, staffId: string): Promise<void> {
    await this.schedule.requireStaffInBusiness(membership.businessId, staffId);
    const linked = await this.schedule.getLinkedStaffMemberId(membership.id);
    this.schedule.assertStaffAccess(membership.role, linked, staffId);
  }

  @Get('working-hours')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get weekly working hours for a staff member.' })
  async getWorkingHours(
    @CurrentMembership() membership: BusinessMembership,
    @Param('staffId', ParseUUIDPipe) staffId: string,
  ): Promise<WorkingHoursResponse> {
    await this.authorize(membership, staffId);
    return this.schedule.getWorkingHours(staffId);
  }

  @Put('working-hours')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RequireJsonGuard)
  @ApiOperation({ summary: 'Replace weekly working hours for a staff member.' })
  async putWorkingHours(
    @CurrentMembership() membership: BusinessMembership,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body(new ZodValidationPipe(putWorkingHoursRequestSchema)) body: PutWorkingHoursRequest,
  ): Promise<WorkingHoursResponse> {
    await this.authorize(membership, staffId);
    return this.schedule.putWorkingHours(staffId, body);
  }

  @Get('time-off')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List time off for a staff member.' })
  async listTimeOff(
    @CurrentMembership() membership: BusinessMembership,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Query(new ZodValidationPipe(listTimeOffQuerySchema)) query: ListTimeOffQuery,
  ): Promise<TimeOffListResponse> {
    await this.authorize(membership, staffId);
    return this.schedule.listTimeOff(staffId, query);
  }

  @Post('time-off')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RequireJsonGuard)
  @ApiOperation({ summary: 'Create time off (business-local wall clock → UTC).' })
  async createTimeOff(
    @CurrentMembership() membership: BusinessMembership,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body(new ZodValidationPipe(createTimeOffRequestSchema)) body: CreateTimeOffRequest,
  ): Promise<TimeOff> {
    await this.authorize(membership, staffId);
    return this.schedule.createTimeOff(staffId, body);
  }

  @Delete('time-off/:timeOffId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a time-off entry.' })
  async deleteTimeOff(
    @CurrentMembership() membership: BusinessMembership,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('timeOffId', ParseUUIDPipe) timeOffId: string,
  ): Promise<void> {
    await this.authorize(membership, staffId);
    await this.schedule.deleteTimeOff(staffId, timeOffId);
  }
}
