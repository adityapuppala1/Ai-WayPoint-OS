import type { MetadataRoute } from 'next';

// Built per request so the addresses follow WAYPOINT_URL where the app runs, not where it was built.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.WAYPOINT_URL ?? 'http://localhost:3000';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/welcome', '/support', '/shield', '/privacy', '/terms'],
        disallow: ['/api/', '/settings', '/ask', '/path', '/reset-password'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
