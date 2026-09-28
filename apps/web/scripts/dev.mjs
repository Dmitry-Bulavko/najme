// Dev-only launcher: loads the repo-root `.env` (Next only reads apps/web/.env*) and starts
// `next dev` on WEB_PORT. Real environment variables win over the file. Not used by build/start.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';
import { URL } from 'node:url';

try {
  process.loadEnvFile(new URL('../../../.env', import.meta.url));
} catch (error) {
  if (error?.code !== 'ENOENT') {
    throw error;
  }
}

const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
const port = process.env.WEB_PORT || '3001';
const child = spawn(process.execPath, [nextBin, 'dev', '--turbopack', '-p', port], {
  stdio: 'inherit',
  env: process.env,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
