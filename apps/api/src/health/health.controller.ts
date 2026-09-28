import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { HealthResponse } from '@najme/contracts';
import { HealthService } from './health.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({ description: 'The API and its database are reachable.' })
  @ApiServiceUnavailableResponse({ description: 'The database is unreachable.' })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const result = await this.healthService.check();
    // The body always matches `HealthResponse`, on both 200 and 503, so monitoring can read `db`
    // without parsing the generic ApiError envelope (docs/conventions/api.md).
    res.status(result.db === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
