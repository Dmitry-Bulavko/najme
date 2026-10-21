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
  updateMemberRequestSchema,
  type BusinessMember,
  type UpdateMemberRequest,
} from '@najme/contracts';
import { RequireJsonGuard } from '../auth/require-json.guard.js';
import { BusinessAccessGuard } from '../businesses/business-access.guard.js';
import type { BusinessMembership } from '../businesses/business-access.types.js';
import { BusinessRoles } from '../businesses/business-roles.decorator.js';
import { CurrentMembership } from '../businesses/current-membership.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { InvitationsService } from './invitations.service.js';

@ApiTags('members')
@Controller('businesses/:businessId')
@UseGuards(BusinessAccessGuard)
export class MembersController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get('members')
  @BusinessRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'List business members.' })
  list(@CurrentMembership() membership: BusinessMembership): Promise<BusinessMember[]> {
    return this.invitations.listMembers(membership.businessId);
  }

  @Patch('members/:membershipId')
  @BusinessRoles('OWNER', 'ADMIN')
  @UseGuards(RequireJsonGuard)
  @ApiOperation({ summary: 'Update a member role or staff link.' })
  update(
    @CurrentMembership() membership: BusinessMembership,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body(new ZodValidationPipe(updateMemberRequestSchema)) body: UpdateMemberRequest,
  ): Promise<BusinessMember> {
    return this.invitations.updateMember(
      membership.businessId,
      membershipId,
      { userId: membership.userId, role: membership.role },
      body,
    );
  }

  @Delete('members/:membershipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @BusinessRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Remove a member from the business.' })
  async remove(
    @CurrentMembership() membership: BusinessMembership,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ): Promise<void> {
    await this.invitations.removeMember(membership.businessId, membershipId, {
      userId: membership.userId,
      role: membership.role,
    });
  }

  @Post('leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @BusinessRoles('OWNER', 'ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Leave the business.' })
  async leave(@CurrentMembership() membership: BusinessMembership): Promise<void> {
    await this.invitations.leave(membership.businessId, membership.userId);
  }
}
