/**
 * Prisma db seed entry (#88). Refuses NODE_ENV=production; otherwise upserts the
 * documented demo accounts and Demo Salon / Pending Studio businesses.
 *
 * Run: `pnpm --filter @najme/api db:seed`
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';

import { PrismaClient } from '../generated/prisma/client.js';
import {
  assertNotProductionEnv,
  DEV_SEED_EMAILS,
  DEV_SEED_PASSWORD,
  runDevSeed,
} from '../src/dev-seed/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');
loadEnv({ path: resolve(root, '.env'), quiet: true });

assertNotProductionEnv(process.env.NODE_ENV);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

try {
  const result = await runDevSeed(prisma);
  console.log('Dev seed complete.');
  console.log(`  admin:  ${DEV_SEED_EMAILS.admin} (${result.adminUserId})`);
  console.log(`  owner:  ${DEV_SEED_EMAILS.owner} (${result.ownerUserId})`);
  console.log(`  staff:  ${DEV_SEED_EMAILS.staff} (${result.staffUserId})`);
  console.log(`  client: ${DEV_SEED_EMAILS.client} (${result.clientUserId})`);
  console.log(`  Demo Salon:      ${result.demoBusinessId} (APPROVED)`);
  console.log(`  Pending Studio:  ${result.pendingBusinessId} (PENDING_APPROVAL)`);
  console.log(`  password for all seed users: ${DEV_SEED_PASSWORD}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
