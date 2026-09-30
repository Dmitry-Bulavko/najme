import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { categoriesResponseSchema } from '@najme/contracts';
import { configureApp } from '../src/app.setup.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const SEEDED_SLUGS = [
  'transfer',
  'cleaning',
  'dentist',
  'nails',
  'hair',
  'massage',
  'beauty',
  'repair',
  'babysitting',
  'tutoring',
] as const;

// Requires a reachable Postgres at `DATABASE_URL` with migrations applied.
describe('GET /api/v1/categories (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the seeded catalogue for locale=en, sorted by sortOrder', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/categories?locale=en');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=300');

    const body = categoriesResponseSchema.parse(response.body);
    expect(body).toHaveLength(10);
    expect(body.map((c) => c.slug)).toEqual([...SEEDED_SLUGS]);
    expect(body.map((c) => c.sortOrder)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(body.every((c) => c.iconKey === null)).toBe(true);
    expect(body.find((c) => c.slug === 'hair')?.name).toBe('Hair');
  });

  it('returns translated names for locale=me', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/categories?locale=me');

    expect(response.status).toBe(200);
    const body = categoriesResponseSchema.parse(response.body);
    expect(body.find((c) => c.slug === 'hair')?.name).toBe('Frizerski');
    expect(body.find((c) => c.slug === 'cleaning')?.name).toBe('Čišćenje');
  });

  it('falls back to English when a translation is missing', async () => {
    const hair = await prisma.category.findUniqueOrThrow({ where: { slug: 'hair' } });
    const meRow = await prisma.categoryTranslation.findUniqueOrThrow({
      where: { categoryId_locale: { categoryId: hair.id, locale: 'me' } },
    });

    await prisma.categoryTranslation.delete({ where: { id: meRow.id } });
    try {
      const response = await request(app.getHttpServer()).get('/api/v1/categories?locale=me');
      expect(response.status).toBe(200);
      const body = categoriesResponseSchema.parse(response.body);
      expect(body.find((c) => c.slug === 'hair')?.name).toBe('Hair');
      expect(body.find((c) => c.slug === 'cleaning')?.name).toBe('Čišćenje');
    } finally {
      await prisma.categoryTranslation.create({
        data: {
          id: meRow.id,
          categoryId: meRow.categoryId,
          locale: meRow.locale,
          name: meRow.name,
        },
      });
    }
  });

  it('returns 400 VALIDATION_FAILED for an invalid locale', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/categories?locale=fr');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
  });

  it('returns 400 VALIDATION_FAILED when locale is missing', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/categories');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
  });
});
