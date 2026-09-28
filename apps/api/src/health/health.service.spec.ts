import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthService } from './health.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('HealthService', () => {
  const originalGitSha = process.env['GIT_SHA'];

  afterEach(() => {
    if (originalGitSha === undefined) {
      delete process.env['GIT_SHA'];
    } else {
      process.env['GIT_SHA'] = originalGitSha;
    }
  });

  function buildService(isHealthy: boolean): HealthService {
    const prisma = { isHealthy: vi.fn().mockResolvedValue(isHealthy) } as unknown as PrismaService;
    return new HealthService(prisma);
  }

  it('reports db: ok and the GIT_SHA version when the database is reachable', async () => {
    process.env['GIT_SHA'] = 'abc1234';
    const service = buildService(true);

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      db: 'ok',
      version: 'abc1234',
    });
  });

  it('falls back to version "dev" when GIT_SHA is not set', async () => {
    delete process.env['GIT_SHA'];
    const service = buildService(true);

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
