import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const dirname = path.dirname(fileURLToPath(import.meta.url));
// Standalone output needs the workspace root so it can trace files shared across the monorepo
// (packages/*) instead of only apps/web.
const monorepoRoot = path.resolve(dirname, '../..');

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  async rewrites() {
    // Mirrors the production Caddy routing (ADR-0007: /api/* -> api, everything else -> web) so
    // local dev behaves the same way without a reverse proxy. Not used in production, where the
    // API is reached server-side via API_INTERNAL_URL/PUBLIC_URL directly.
    if (process.env.NODE_ENV === 'production') {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
