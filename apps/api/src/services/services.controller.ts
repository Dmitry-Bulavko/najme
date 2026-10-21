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
  createServiceRequestSchema,
  updateServiceRequestSchema,
  type CreateServiceRequest,
  type Service,
  type ServicesResponse,
  type UpdateServiceRequest,
} from '@najme/contracts';
import { RequireJsonGuard } from '../auth/require-json.guard.js';
import { BusinessAccessGuard } from '../businesses/business-access.guard.js';
import type { BusinessMembership } from '../businesses/business-access.types.js';
import { BusinessRoles } from '../businesses/business-roles.decorator.js';
import { CurrentMembership } from '../businesses/current-membership.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ServicesService } from './services.service.js';

@ApiTags('services')
@Controller('businesses/:businessId/services')
@UseGuards(BusinessAccessGuard)
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @BusinessRoles()
  @ApiOperation({ summary: 'List services of a business.' })
  list(@CurrentMembership() membership: BusinessMembership): Promise<ServicesResponse> {
    return this.services.list(membership.businessId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RequireJsonGuard)
  @BusinessRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a service.' })
  create(
    @CurrentMembership() membership: BusinessMembership,
    @Body(new ZodValidationPipe(createServiceRequestSchema)) body: CreateServiceRequest,
  ): Promise<Service> {
    return this.services.create(membership.businessId, body);
  }

  @Get(':serviceId')
  @HttpCode(HttpStatus.OK)
  @BusinessRoles()
  @ApiOperation({ summary: 'Get one service.' })
  get(
    @CurrentMembership() membership: BusinessMembership,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ): Promise<Service> {
    return this.services.get(membership.businessId, serviceId);
  }

  @Patch(':serviceId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RequireJsonGuard)
  @BusinessRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update a service.' })
  update(
    @CurrentMembership() membership: BusinessMembership,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body(new ZodValidationPipe(updateServiceRequestSchema)) body: UpdateServiceRequest,
  ): Promise<Service> {
    return this.services.update(membership.businessId, serviceId, body);
  }

  @Delete(':serviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @BusinessRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Soft-delete a service.' })
  async remove(
    @CurrentMembership() membership: BusinessMembership,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ): Promise<void> {
    await this.services.softDelete(membership.businessId, serviceId);
  }
}
