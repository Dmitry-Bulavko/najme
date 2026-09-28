import { Inject, Injectable } from '@nestjs/common';
import type { HealthResponse } from '@najme/contracts';
import { ENV } from '../config/env.token.js';
import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async check(): Promise<HealthResponse> {
    const dbOk = await this.prisma.isHealthy();
    return {
      status: 'ok',
      db: dbOk ? 'ok' : 'error',
      version: this.env.GIT_SHA ?? 'dev',
    };
  }
}
