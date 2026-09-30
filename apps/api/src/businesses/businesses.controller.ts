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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  createBusinessRequestSchema,
  updateBusinessRequestSchema,
  type Business,
  type CreateBusinessRequest,
  type UpdateBusinessRequest,
} from '@najme/contracts';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { RequireJsonGuard } from '../auth/require-json.guard.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { BusinessAccessGuard } from './business-access.guard.js';
import { BusinessRoles } from './business-roles.decorator.js';
import { CurrentMembership } from './current-membership.decorator.js';
import type { BusinessMembership } from './business-access.types.js';
import { BusinessesService } from './businesses.service.js';

const HOUR_MS = 60 * 60 * 1000;
const CREATE_BUSINESS_LIMIT = { default: { limit: 5, ttl: HOUR_MS } };

@ApiTags('businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerGuard, RequireJsonGuard)
  @Throttle(CREATE_BUSINESS_LIMIT)
  @ApiOperation({ summary: 'Create a business; caller becomes OWNER.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBusinessRequestSchema)) body: CreateBusinessRequest,
  ): Promise<Business> {
    return this.businesses.create(user.id, body);
  }

  @Get(':businessId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BusinessAccessGuard)
  @BusinessRoles()
  @ApiOperation({ summary: 'Get a business the caller belongs to.' })
  get(
    @Param('businessId', ParseUUIDPipe) _businessId: string,
    @CurrentMembership() membership: BusinessMembership,
  ): Promise<Business> {
    return this.businesses.getForMember(membership);
  }

  @Patch(':businessId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BusinessAccessGuard, RequireJsonGuard)
  @BusinessRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update business profile, booking policy or slug.' })
  update(
    @Param('businessId', ParseUUIDPipe) _businessId: string,
    @CurrentMembership() membership: BusinessMembership,
    @Body(new ZodValidationPipe(updateBusinessRequestSchema)) body: UpdateBusinessRequest,
  ): Promise<Business> {
    return this.businesses.update(membership, body);
  }

  @Delete(':businessId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(BusinessAccessGuard)
  @BusinessRoles('OWNER')
  @ApiOperation({ summary: 'Soft-delete a business (OWNER only).' })
  async remove(
    @Param('businessId', ParseUUIDPipe) _businessId: string,
    @CurrentMembership() membership: BusinessMembership,
  ): Promise<void> {
    await this.businesses.softDelete(membership);
  }
}
