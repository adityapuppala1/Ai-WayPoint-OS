'use client';

import { useEffect } from 'react';

/** Registers the offline service worker in production builds only. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(() => navigator.serviceWorker.ready)
      // Keep a fresh copy of the public help numbers for the offline page.
      .then(() => fetch('/api/support', { credentials: 'same-origin' }))
      .catch(() => {
        // Offline support is an enhancement; the app works without it.
      });
  }, []);
  return null;
}
