// Dev-only launcher. NestJS DI needs `emitDecoratorMetadata`, which esbuild-based runners (tsx) do
// not emit, so we compile with tsc in watch mode and restart node when `dist/` changes. The
// repo-root `.env` is loaded by Node itself when present; real environment variables win over the
// file. The `--env-file-if-exists` flag is omitted when the file is missing so Node 22 watch mode
// does not try to watch a non-existent path (#152).
//
// node starts only after the watcher's first successful compile: starting it earlier (after a
// separate one-off build) made the watcher's initial emit rewrite `dist/` and restart the freshly
// started API, which broke the CI dev smoke intermittently (#69).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';

import { buildNodeServerArgs } from './dev-args.mjs';

const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');
const compileDone = /Found (\d+) errors?\. Watching for file changes\./;

const nodeServerArgs = buildNodeServerArgs();

const children = [];

function shutdown(signal) {
  for (const child of children) {
    child.kill(signal);
  }
}
function supervise(child) {
  children.push(child);
  child.on('exit', (code) => {
    shutdown('SIGTERM');
    process.exit(code ?? 1);
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(signal));
}

const watcher = spawn(
  process.execPath,
  [tsc, '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'],
  { stdio: ['ignore', 'pipe', 'inherit'] },
);
supervise(watcher);

let serverStarted = false;
let pending = '';
watcher.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (serverStarted) return;
  pending += chunk.toString();
  const match = compileDone.exec(pending);
  if (!match) return;
  if (Number(match[1]) > 0) {
    // Same fail-fast behaviour as a one-off build: do not start on a broken first compile.
    process.stderr.write('Initial compile failed; fix the errors above and restart `pnpm dev`.\n');
    shutdown('SIGTERM');
    process.exit(1);
  }
  serverStarted = true;
  pending = '';
  supervise(spawn(process.execPath, nodeServerArgs, { stdio: 'inherit' }));
});
