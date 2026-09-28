import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 config: the CLI (migrate/generate) reads the datasource URL from here instead of the
// schema file. `dotenv/config` loads `.env` for local CLI usage; in CI/production the env var is
// already set by the process environment.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
