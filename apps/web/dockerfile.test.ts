import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * NEXT_PUBLIC_* values must be present at `next build` inside the image (#145). If the Dockerfile
 * drops the ARG/ENV, production "Continue with Google" silently stays hidden.
 */
describe('web Dockerfile Google web client ID', () => {
  it('declares ARG and ENV NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID before the Next build', async () => {
    const dockerfile = await readFile(path.join(import.meta.dirname, 'Dockerfile'), 'utf8');
    const argMatch = /^(ARG\s+NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID(?:=.*)?)$/m.exec(dockerfile);
    expect(argMatch, 'missing ARG NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID').not.toBeNull();
    expect(dockerfile).toMatch(/^ENV\s+NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=/m);

    const argIdx = dockerfile.indexOf('ARG NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID');
    const envIdx = dockerfile.indexOf('ENV NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=');
    const buildIdx = dockerfile.indexOf('pnpm turbo run build --filter=...@najme/web');
    expect(argIdx).toBeGreaterThanOrEqual(0);
    expect(envIdx).toBeGreaterThan(argIdx);
    expect(buildIdx).toBeGreaterThan(envIdx);
  });
});
