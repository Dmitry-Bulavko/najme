import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createStaffMemberRequestSchema,
  updateStaffMemberRequestSchema,
  type CreateStaffMemberRequest,
  type StaffMember,
  type StaffMembersResponse,
  type UpdateStaffMemberRequest,
} from '@najme/contracts';
import { RequireJsonGuard } from '../auth/require-json.guard.js';
import { BusinessAccessGuard } from '../businesses/business-access.guard.js';
import { BusinessRoles } from '../businesses/business-roles.decorator.js';
import type { BusinessMembership } from '../businesses/business-access.types.js';
import { CurrentMembership } from '../businesses/current-membership.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { StaffService } from './staff.service.js';

@ApiTags('staff')
@Controller('businesses/:businessId/staff')
@UseGuards(BusinessAccessGuard)
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @BusinessRoles()
  @ApiOperation({ summary: 'List staff members of a business.' })
  list(@CurrentMembership() membership: BusinessMembership): Promise<StaffMembersResponse> {
    return this.staff.list(membership.businessId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RequireJsonGuard)
  @BusinessRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a staff member.' })
  create(
    @CurrentMembership() membership: BusinessMembership,
    @Body(new ZodValidationPipe(createStaffMemberRequestSchema)) body: CreateStaffMemberRequest,
  ): Promise<StaffMember> {
    return this.staff.create(membership.businessId, body);
  }

  @Get(':staffId')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles()
  @ApiOperation({ summary: 'Get one staff member.' })
  get(
    @CurrentMembership() membership: BusinessMembership,
    @Param('staffId', ParseUUIDPipe) staffId: string,
  ): Promise<StaffMember> {
    return this.staff.get(membership.businessId, staffId);
  }

  @Patch(':staffId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RequireJsonGuard)
  @BusinessRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update a staff member.' })
  update(
    @CurrentMembership() membership: BusinessMembership,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body(new ZodValidationPipe(updateStaffMemberRequestSchema)) body: UpdateStaffMemberRequest,
  ): Promise<StaffMember> {
    return this.staff.update(membership.businessId, staffId, body);
  }

  @Delete(':staffId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @BusinessRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Soft-delete a staff member.' })
  async remove(
    @CurrentMembership() membership: BusinessMembership,
    @Param('staffId', ParseUUIDPipe) staffId: string,
  ): Promise<void> {
    await this.staff.softDelete(membership.businessId, staffId);
  }
}
