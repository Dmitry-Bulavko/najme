/**
 * Tests the real `dev-args.mjs` helpers used by `dev.mjs` (#152).
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

import { buildNodeServerArgs, resolveRootEnvPath } from './dev-args.mjs';

describe('API dev-args (#152)', () => {
  it('resolves rootEnvPath to the monorepo root (pnpm-workspace.yaml sibling)', () => {
    const rootEnvPath = resolveRootEnvPath();
    const rootDir = dirname(rootEnvPath);
    assert.equal(existsSync(join(rootDir, 'pnpm-workspace.yaml')), true);
    assert.match(rootEnvPath.replace(/\\/g, '/'), /\/\.env$/);
  });

  it('omits --env-file-if-exists when the target path is absent', () => {
    const fakeMissing = resolveRootEnvPath().replace(/\.env$/, '.env.does-not-exist-152');
    assert.equal(existsSync(fakeMissing), false);
    const args = buildNodeServerArgs(fakeMissing);
    assert.deepEqual(args, ['--watch', '--watch-path=dist', 'dist/main.js']);
  });

  it('includes an absolute --env-file-if-exists when the path exists', () => {
    const workspaceYaml = join(dirname(resolveRootEnvPath()), 'pnpm-workspace.yaml');
    assert.equal(existsSync(workspaceYaml), true);
    // Existing file exercises the flag shape without requiring a root .env in the workspace.
    const args = buildNodeServerArgs(workspaceYaml);
    assert.deepEqual(args, [
      '--watch',
      '--watch-path=dist',
      `--env-file-if-exists=${workspaceYaml}`,
      'dist/main.js',
    ]);
  });
});
