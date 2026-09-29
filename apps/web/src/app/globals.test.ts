import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

import { compile } from 'tailwindcss';
import { beforeAll, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

// Maps the bare specifiers globals.css imports to files (tw-animate-css only exports a `style`
// condition, which Node's resolver does not know, so it is read from web's node_modules).
function resolveStylesheet(id: string, base: string): string {
  if (id === 'tailwindcss') return require.resolve('tailwindcss/index.css');
  if (id === 'tw-animate-css') {
    return path.resolve(
      import.meta.dirname,
      '../../node_modules/tw-animate-css/dist/tw-animate.css',
    );
  }
  if (id.startsWith('.')) return path.resolve(base, id);
  return require.resolve(id);
}

/** Compiles globals.css with Tailwind for the given class candidates, like the real build does. */
async function buildCss(candidates: string[]): Promise<string> {
  const file = path.join(import.meta.dirname, 'globals.css');
  const compiler = await compile(await readFile(file, 'utf8'), {
    base: import.meta.dirname,
    loadStylesheet: async (id, base) => {
      const resolved = resolveStylesheet(id, base);
      return {
        path: resolved,
        base: path.dirname(resolved),
        content: await readFile(resolved, 'utf8'),
      };
    },
  });
  return compiler.build(candidates);
}

function declarationValue(css: string, name: string): string | undefined {
  return new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();
}

describe('globals.css theme', () => {
  let css: string;

  beforeAll(async () => {
    css = await buildCss([
      'max-w-md',
      'max-w-xl',
      'max-w-2xl',
      'max-w-6xl',
      'sm:max-w-sm',
      'p-md',
      'gap-lg',
    ]);
  });

  it('keeps max-w-* on the container scale despite same-named spacing tokens', () => {
    expect(css).toMatch(/\.max-w-md\s*\{\s*max-width:\s*var\(--max-width-md\)/);
    expect(declarationValue(css, '--max-width-md')).toBe('28rem');
    expect(declarationValue(css, '--max-width-xl')).toBe('36rem');
    expect(declarationValue(css, '--max-width-2xl')).toBe('42rem');
    expect(declarationValue(css, '--max-width-sm')).toBe('24rem');
    expect(declarationValue(css, '--container-6xl')).toBe('72rem');
  });

  it('still resolves padding and gap from the spacing tokens', () => {
    expect(css).toMatch(/\.p-md\s*\{\s*padding:\s*var\(--spacing-md\)/);
    expect(declarationValue(css, '--spacing-md')).toBe('12px');
    expect(css).toMatch(/\.gap-lg\s*\{\s*gap:\s*var\(--spacing-lg\)/);
  });
});
