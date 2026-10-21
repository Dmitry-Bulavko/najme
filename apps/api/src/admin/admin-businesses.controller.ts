import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  adminBusinessListQuerySchema,
  rejectBusinessRequestSchema,
  type AdminBusinessDetail,
  type AdminBusinessListQuery,
  type AdminBusinessListResponse,
  type RejectBusinessRequest,
} from '@najme/contracts';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { RequireJsonGuard } from '../auth/require-json.guard.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { AdminBusinessesService } from './admin-businesses.service.js';
import { PlatformAdminGuard } from './platform-admin.guard.js';

@ApiTags('admin')
@Controller('admin/businesses')
@UseGuards(PlatformAdminGuard)
export class AdminBusinessesController {
  constructor(private readonly admin: AdminBusinessesService) {}

  @Get()
  @ApiOperation({ summary: 'List businesses for platform-admin moderation.' })
  list(
    @Query(new ZodValidationPipe(adminBusinessListQuerySchema)) query: AdminBusinessListQuery,
  ): Promise<AdminBusinessListResponse> {
    return this.admin.list(query);
  }

  @Get(':businessId')
  @ApiOperation({ summary: 'Get one business for platform-admin moderation.' })
  get(@Param('businessId', ParseUUIDPipe) businessId: string): Promise<AdminBusinessDetail> {
    return this.admin.get(businessId);
  }

  @Post(':businessId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending or rejected business.' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ): Promise<AdminBusinessDetail> {
    return this.admin.approve(businessId, user.id);
  }

  @Post(':businessId/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RequireJsonGuard)
  @ApiOperation({ summary: 'Reject a pending business with a reason.' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body(new ZodValidationPipe(rejectBusinessRequestSchema)) body: RejectBusinessRequest,
  ): Promise<AdminBusinessDetail> {
    return this.admin.reject(businessId, user.id, body);
  }
}
