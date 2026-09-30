import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  attachUploadRequestSchema,
  createUploadRequestSchema,
  type AttachBusinessImageResponse,
  type AttachStaffPhotoResponse,
  type AttachUploadRequest,
  type CreateUploadRequest,
  type CreateUploadResponse,
} from '@najme/contracts';
import { RequireJsonGuard } from '../auth/require-json.guard.js';
import { BusinessAccessGuard } from '../businesses/business-access.guard.js';
import type { BusinessMembership } from '../businesses/business-access.types.js';
import { BusinessRoles } from '../businesses/business-roles.decorator.js';
import { CurrentMembership } from '../businesses/current-membership.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { UploadsService } from './uploads.service.js';

@ApiTags('uploads')
@Controller('businesses/:businessId')
@UseGuards(BusinessAccessGuard)
@BusinessRoles('OWNER', 'ADMIN')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('uploads')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RequireJsonGuard)
  @ApiOperation({ summary: 'Create a presigned POST for a business or staff photo upload.' })
  createUpload(
    @CurrentMembership() membership: BusinessMembership,
    @Body(new ZodValidationPipe(createUploadRequestSchema)) body: CreateUploadRequest,
  ): Promise<CreateUploadResponse> {
    return this.uploads.createPresignedUpload(membership.businessId, body);
  }

  @Put('logo')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RequireJsonGuard)
  @ApiOperation({ summary: 'Attach a previously uploaded logo object.' })
  attachLogo(
    @CurrentMembership() membership: BusinessMembership,
    @Body(new ZodValidationPipe(attachUploadRequestSchema)) body: AttachUploadRequest,
  ): Promise<AttachBusinessImageResponse> {
    return this.uploads.attachLogo(membership.businessId, body);
  }

  @Delete('logo')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove the business logo.' })
  async clearLogo(@CurrentMembership() membership: BusinessMembership): Promise<void> {
    await this.uploads.clearLogo(membership.businessId);
  }

  @Put('cover')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RequireJsonGuard)
  @ApiOperation({ summary: 'Attach a previously uploaded cover object.' })
  attachCover(
    @CurrentMembership() membership: BusinessMembership,
    @Body(new ZodValidationPipe(attachUploadRequestSchema)) body: AttachUploadRequest,
  ): Promise<AttachBusinessImageResponse> {
    return this.uploads.attachCover(membership.businessId, body);
  }

  @Delete('cover')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove the business cover.' })
  async clearCover(@CurrentMembership() membership: BusinessMembership): Promise<void> {
    await this.uploads.clearCover(membership.businessId);
  }

  @Put('staff/:staffId/photo')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RequireJsonGuard)
  @ApiOperation({ summary: 'Attach a previously uploaded staff photo.' })
  attachStaffPhoto(
    @CurrentMembership() membership: BusinessMembership,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body(new ZodValidationPipe(attachUploadRequestSchema)) body: AttachUploadRequest,
  ): Promise<AttachStaffPhotoResponse> {
    return this.uploads.attachStaffPhoto(membership.businessId, staffId, body);
  }

  @Delete('staff/:staffId/photo')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a staff photo.' })
  async clearStaffPhoto(
    @CurrentMembership() membership: BusinessMembership,
    @Param('staffId', ParseUUIDPipe) staffId: string,
  ): Promise<void> {
    await this.uploads.clearStaffPhoto(membership.businessId, staffId);
  }
}
