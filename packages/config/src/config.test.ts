import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { baseConfig as eslintBaseConfig } from '../eslint/index.js';
import { baseConfig as vitestBaseConfig } from '../vitest/index.js';
import { firstOf, formatCount } from './self-check.js';

function readJson(relativePath: string): unknown {
  const path = fileURLToPath(new URL(relativePath, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('tsconfig presets', () => {
  it('base.json is strict with modern, index-safe defaults', () => {
    const base = readJson('../tsconfig/base.json') as { compilerOptions: Record<string, unknown> };

    expect(base.compilerOptions.strict).toBe(true);
    expect(base.compilerOptions.noUncheckedIndexedAccess).toBe(true);
    expect(base.compilerOptions.isolatedModules).toBe(true);
    expect(base.compilerOptions.verbatimModuleSyntax).toBe(true);
  });

  it('node.json and react.json extend base.json', () => {
    const node = readJson('../tsconfig/node.json') as { extends: string };
    const react = readJson('../tsconfig/react.json') as { extends: string };

    expect(node.extends).toBe('./base.json');
    expect(react.extends).toBe('./base.json');
  });
});

describe('eslint base config', () => {
  it('is a non-empty flat config array', () => {
    expect(Array.isArray(eslintBaseConfig)).toBe(true);
    expect(eslintBaseConfig.length).toBeGreaterThan(0);
  });

  it('enforces no-explicit-any as an error', () => {
    const withRule = eslintBaseConfig.find(
      (entry) => entry.rules?.['@typescript-eslint/no-explicit-any'] !== undefined,
    );

    expect(withRule?.rules?.['@typescript-eslint/no-explicit-any']).toBe('error');
  });

  it('ignores the temporary config bundles tsup and Vite write during parallel builds', () => {
    const ignores = eslintBaseConfig.flatMap((entry) => entry.ignores ?? []);

    expect(ignores).toContain('**/*.bundled_*.{js,mjs,cjs}');
    expect(ignores).toContain('**/*.timestamp-*.{js,mjs,cjs}');
  });
});

describe('vitest base config', () => {
  it('runs in the node environment with deterministic mocks', () => {
    expect(vitestBaseConfig.test?.environment).toBe('node');
    expect(vitestBaseConfig.test?.clearMocks).toBe(true);
    expect(vitestBaseConfig.test?.restoreMocks).toBe(true);
  });
});

describe('self-check helpers', () => {
  it('firstOf returns undefined for an empty array', () => {
    expect(firstOf([])).toBeUndefined();
    expect(firstOf([1, 2, 3])).toBe(1);
  });

  it('formatCount pluralises by default', () => {
    expect(formatCount(1, 'item')).toBe('1 item');
    expect(formatCount(2, 'item')).toBe('2 items');
  });
});
