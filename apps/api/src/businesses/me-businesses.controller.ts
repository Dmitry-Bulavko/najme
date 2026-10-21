import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MyBusinessesResponse } from '@najme/contracts';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { BusinessesService } from './businesses.service.js';

@ApiTags('me')
@Controller('me')
export class MeBusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Get('businesses')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List businesses the caller belongs to.' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<MyBusinessesResponse> {
    return this.businesses.listMine(user.id);
  }
}
