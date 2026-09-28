// Dev-only launcher. NestJS DI needs `emitDecoratorMetadata`, which esbuild-based runners (tsx) do
// not emit, so we compile with tsc in watch mode and restart node when `dist/` changes. The
// repo-root `.env` is loaded by Node itself; real environment variables win over the file.
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');
const tscArgs = [tsc, '-p', 'tsconfig.build.json'];

const initial = spawnSync(process.execPath, tscArgs, { stdio: 'inherit' });
if (initial.status !== 0) {
  process.exit(initial.status ?? 1);
}

const children = [
  spawn(process.execPath, [...tscArgs, '--watch', '--preserveWatchOutput'], { stdio: 'inherit' }),
  spawn(
    process.execPath,
    ['--watch', '--watch-path=dist', '--env-file-if-exists=../../.env', 'dist/main.js'],
    { stdio: 'inherit' },
  ),
];

function shutdown(signal) {
  for (const child of children) {
    child.kill(signal);
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(signal));
}
for (const child of children) {
  child.on('exit', (code) => {
    shutdown('SIGTERM');
    process.exit(code ?? 1);
  });
}
