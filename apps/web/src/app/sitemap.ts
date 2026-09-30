import type { MetadataRoute } from 'next';

// Built per request so the addresses follow WAYPOINT_URL where the app runs, not where it was built.
export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.WAYPOINT_URL ?? 'http://localhost:3000';
  return ['/welcome', '/support', '/shield', '/sign-in', '/sign-up', '/privacy', '/terms'].map(
    (path) => ({
      url: `${base}${path}`,
      changeFrequency: 'weekly',
      priority: path === '/welcome' ? 1 : 0.7,
    }),
  );
}
