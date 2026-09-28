import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { HealthService } from './health.service.js';
import type { Env } from '../config/env.schema.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('HealthService', () => {
  function buildService(isHealthy: boolean, env: Partial<Env> = {}): HealthService {
    const prisma = { isHealthy: vi.fn().mockResolvedValue(isHealthy) } as unknown as PrismaService;
    return new HealthService(prisma, env as Env);
  }

  it('reports db: ok and the GIT_SHA version when the database is reachable', async () => {
    const service = buildService(true, { GIT_SHA: 'abc1234' });

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      db: 'ok',
      version: 'abc1234',
    });
  });

  it('falls back to version "dev" when GIT_SHA is not set', async () => {
    const service = buildService(true, { GIT_SHA: undefined });

    await expect(service.check()).resolves.toMatchObject({ version: 'dev' });
  });

  it('reports db: error when the database is unreachable', async () => {
    const service = buildService(false);

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      db: 'error',
      version: 'dev',
    });
  });
});
