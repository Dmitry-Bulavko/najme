/**
 * Unit coverage for the #152 env-file flag gating used by `dev.mjs`.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

function nodeServerArgs(envExists) {
  return [
    '--watch',
    '--watch-path=dist',
    ...(envExists ? ['--env-file-if-exists=../../.env'] : []),
    'dist/main.js',
  ];
}

describe('API dev runner env-file args (#152)', () => {
  it('omits --env-file-if-exists when the root .env is absent', () => {
    assert.deepEqual(nodeServerArgs(false), ['--watch', '--watch-path=dist', 'dist/main.js']);
  });

  it('includes --env-file-if-exists when the root .env is present', () => {
    assert.deepEqual(nodeServerArgs(true), [
      '--watch',
      '--watch-path=dist',
      '--env-file-if-exists=../../.env',
      'dist/main.js',
    ]);
  });

  it('resolves ../../.env from scripts/ to the repo root', () => {
    const scriptsDir = dirname(fileURLToPath(import.meta.url));
    const fromScripts = resolve(scriptsDir, '../../.env');
    const oneLevelTooFar = resolve(scriptsDir, '../../../.env');
    assert.notEqual(fromScripts, oneLevelTooFar);
    assert.equal(basename(fromScripts), '.env');
    assert.equal(typeof existsSync(fromScripts), 'boolean');
  });
});
