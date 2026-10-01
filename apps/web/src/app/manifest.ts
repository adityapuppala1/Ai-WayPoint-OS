import { hexRoles } from '@waypoint/tokens';
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  // The page background (the canvas token) for the splash screen and the installed app's
  // title bar: the same colour the pages give the browser's own bars (layout.tsx).
  const canvas = hexRoles('light').canvas;
  return {
    id: '/',
    name: 'Waypoint',
    short_name: 'Waypoint',
    description: "See what's coming. Know your next step. Never take it alone.",
    start_url: '/?source=pwa',
    scope: '/',
    // No `orientation`: the installed app turns with the phone, like the website (WCAG 1.3.4).
    display: 'standalone',
    background_color: canvas,
    theme_color: canvas,
    categories: ['lifestyle', 'education', 'productivity', 'health'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Check a message',
        short_name: 'Shield',
        url: '/shield',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Get help now',
        short_name: 'Help',
        url: '/support',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Ask',
        short_name: 'Ask',
        url: '/ask',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
