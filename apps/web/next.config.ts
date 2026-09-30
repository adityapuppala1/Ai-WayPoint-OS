import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Env files live at the monorepo root. process.loadEnvFile never overrides variables that
// are already set, so real environment variables (Docker, Kubernetes) always win.
const root = path.resolve(__dirname, '../..');
const mode =
  process.env.NODE_ENV === 'production'
    ? 'production'
    : process.env.NODE_ENV === 'test'
      ? 'test'
      : 'development';
for (const file of [
  `.env.${mode}.local`,
  mode === 'test' ? null : '.env.local',
  `.env.${mode}`,
  '.env',
]) {
  if (!file) continue;
  const full = path.join(root, file);
  if (existsSync(full)) process.loadEnvFile(full);
}

const withNextIntl = createNextIntlPlugin({
  requestConfig: './src/i18n/request.ts',
  experimental: { createMessagesDeclaration: '../../packages/i18n/messages/en.json' },
});

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Geolocation only for "use my location" in Surroundings; microphone for voice input.
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(self), geolocation=(self), payment=(), usb=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: root,
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  transpilePackages: [
    '@waypoint/ai',
    '@waypoint/api',
    '@waypoint/auth',
    '@waypoint/content',
    '@waypoint/core',
    '@waypoint/db',
    '@waypoint/i18n',
    '@waypoint/tokens',
    '@waypoint/ui',
  ],
  serverExternalPackages: ['@electric-sql/pglite', '@electric-sql/pglite-pgvector'],
  // Stop `next dev` writing agent instruction files into the repo.
  agentRules: false,
  experimental: {
    authInterrupts: true,
    useOffline: true,
  },
  // Headers here are fixed when the app is built. Strict-Transport-Security depends on the
  // address it is served at, which a Docker image only learns when it starts, so the proxy
  // (src/proxy.ts) sets it per request instead.
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
