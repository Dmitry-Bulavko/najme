import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  acceptInvitationRequestSchema,
  invitationPreviewQuerySchema,
  type AcceptInvitationRequest,
  type BusinessMember,
  type InvitationPreviewQuery,
  type InvitationPreviewResponse,
} from '@najme/contracts';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { Public } from '../auth/public.decorator.js';
import { RequireJsonGuard } from '../auth/require-json.guard.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { InvitationsService } from './invitations.service.js';

const MINUTE_MS = 60_000;
const PREVIEW_LIMIT = { default: { limit: 30, ttl: MINUTE_MS } };
const ACCEPT_LIMIT = { default: { limit: 10, ttl: MINUTE_MS } };

@ApiTags('invitations')
@Controller('invitations')
export class PublicInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get('preview')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(PREVIEW_LIMIT)
  @ApiOperation({ summary: 'Preview an invitation without revealing the full email.' })
  preview(
    @Query(new ZodValidationPipe(invitationPreviewQuerySchema)) query: InvitationPreviewQuery,
  ): Promise<InvitationPreviewResponse> {
    return this.invitations.preview(query.token);
  }

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard, RequireJsonGuard)
  @Throttle(ACCEPT_LIMIT)
  @ApiOperation({ summary: 'Accept an invitation for the signed-in user.' })
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(acceptInvitationRequestSchema)) body: AcceptInvitationRequest,
  ): Promise<BusinessMember> {
    return this.invitations.accept(user.id, body);
  }
}
