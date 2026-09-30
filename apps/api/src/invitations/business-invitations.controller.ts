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
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  createInvitationRequestSchema,
  type CreateInvitationRequest,
  type Invitation,
} from '@najme/contracts';
import { RequireJsonGuard } from '../auth/require-json.guard.js';
import { BusinessAccessGuard } from '../businesses/business-access.guard.js';
import type { BusinessMembership } from '../businesses/business-access.types.js';
import { BusinessRoles } from '../businesses/business-roles.decorator.js';
import { CurrentMembership } from '../businesses/current-membership.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { InvitationsService } from './invitations.service.js';

const MINUTE_MS = 60_000;
const RESEND_LIMIT = { default: { limit: 3, ttl: MINUTE_MS } };

@ApiTags('invitations')
@Controller('businesses/:businessId/invitations')
@UseGuards(BusinessAccessGuard)
@BusinessRoles('OWNER', 'ADMIN')
export class BusinessInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RequireJsonGuard)
  @ApiOperation({ summary: 'Invite a colleague by email link.' })
  create(
    @CurrentMembership() membership: BusinessMembership,
    @Body(new ZodValidationPipe(createInvitationRequestSchema)) body: CreateInvitationRequest,
  ): Promise<Invitation> {
    return this.invitations.create(
      membership.businessId,
      { userId: membership.userId, role: membership.role },
      body,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List invitations for the business.' })
  list(@CurrentMembership() membership: BusinessMembership): Promise<Invitation[]> {
    return this.invitations.list(membership.businessId);
  }

  @Post(':invitationId/resend')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle(RESEND_LIMIT)
  @ApiOperation({ summary: 'Rotate the invitation token and resend the email.' })
  resend(
    @CurrentMembership() membership: BusinessMembership,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<Invitation> {
    return this.invitations.resend(membership.businessId, invitationId);
  }

  @Delete(':invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a pending invitation.' })
  async revoke(
    @CurrentMembership() membership: BusinessMembership,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<void> {
    await this.invitations.revoke(membership.businessId, invitationId);
  }
}
