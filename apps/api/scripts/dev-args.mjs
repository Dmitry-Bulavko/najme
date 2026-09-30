/**
 * Shared helpers for the API `dev.mjs` launcher (#152).
 * Kept importable so unit tests can assert the real path and args.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path to the repo-root `.env`.
 * `dev.mjs` lives in `apps/api/scripts/` → three levels up is the monorepo root.
 */
export function resolveRootEnvPath(fromScriptUrl = import.meta.url) {
  const scriptDir = dirname(fileURLToPath(fromScriptUrl));
  return resolve(scriptDir, '../../../.env');
}

/**
 * Node argv for the watched API process.
 * Passes `--env-file-if-exists=<absolute>` only when the root `.env` exists, so Node 22
 * watch mode never tries to watch a missing path.
 */
export function buildNodeServerArgs(rootEnvPath = resolveRootEnvPath()) {
  return [
    '--watch',
    '--watch-path=dist',
    ...(existsSync(rootEnvPath) ? [`--env-file-if-exists=${rootEnvPath}`] : []),
    'dist/main.js',
  ];
}
