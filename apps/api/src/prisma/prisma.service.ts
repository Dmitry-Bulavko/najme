import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

/**
 * Thin wrapper around the generated Prisma client, connected through the `pg` driver adapter
 * (required by Prisma 7 once the datasource `url` moved out of `schema.prisma`, see
 * `prisma.config.ts`). Modules access the database only through this service or module-owned
 * repositories (`docs/conventions/code-style.md`).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Cheap liveness probe used by the health endpoint. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.warn(`Database health check failed: ${(error as Error).message}`);
      return false;
    }
  }
}
