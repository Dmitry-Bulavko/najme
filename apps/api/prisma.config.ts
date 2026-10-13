import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7 config: the CLI (migrate/generate) reads the datasource URL from here instead of the
// schema file. For local CLI usage `.env` is loaded from `apps/api/` and then the repo root (the
// CLI runs with cwd `apps/api`); dotenv never overrides variables that are already set, so real
// environment variables win, then `apps/api/.env`, then the root `.env`. Missing files are ignored.
// In CI/production the env var is already set by the process environment.
config({ path: ['.env', '../../.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Dev/CI demo data only (#88). `tsx` is a devDependency of @najme/api.
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
