#!/usr/bin/env node
/**
 * Grant or revoke `User.isPlatformAdmin` by email.
 * Usage: node scripts/admin-flag.mjs grant|revoke <email>
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');
loadEnv({ path: resolve(root, '.env'), quiet: true });

const [action, emailRaw] = process.argv.slice(2);
const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';

if ((action !== 'grant' && action !== 'revoke') || !email || !email.includes('@')) {
  console.error('Usage: pnpm --filter @najme/api admin:grant <email>');
  console.error('       pnpm --filter @najme/api admin:revoke <email>');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  const found = await client.query(
    `SELECT id, email, is_platform_admin FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [email],
  );
  if (found.rowCount !== 1) {
    console.error(`No user found for email: ${email}`);
    process.exit(1);
  }
  const next = action === 'grant';
  await client.query(`UPDATE users SET is_platform_admin = $1, updated_at = NOW() WHERE id = $2`, [
    next,
    found.rows[0].id,
  ]);
  console.log(
    action === 'grant'
      ? `Granted platform admin to ${email}`
      : `Revoked platform admin from ${email}`,
  );
} finally {
  await client.end();
}
