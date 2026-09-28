import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@najme/contracts';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    const dbOk = await this.prisma.isHealthy();
    return {
      status: 'ok',
      db: dbOk ? 'ok' : 'error',
      version: process.env['GIT_SHA'] ?? 'dev',
    };
  }
}
