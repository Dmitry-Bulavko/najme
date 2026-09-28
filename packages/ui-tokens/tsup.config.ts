import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'neutral',
  async onSuccess() {
    // Generate dist/theme.css from the freshly built bundle, so the CSS custom properties file
    // is always derived from the same TypeScript token source of truth and can never drift from
    // it (it is not committed — see README.md). The specifier is built at runtime (not a string
    // literal) so esbuild does not try to resolve/bundle it while compiling this config file,
    // before dist/index.js exists.
    const distEntry = pathToFileURL(path.join(process.cwd(), 'dist', 'index.js')).href;
    const { generateThemeCss } = (await import(/* webpackIgnore: true */ distEntry)) as {
      generateThemeCss: () => string;
    };
    await writeFile(path.join('dist', 'theme.css'), generateThemeCss(), 'utf8');
  },
});
