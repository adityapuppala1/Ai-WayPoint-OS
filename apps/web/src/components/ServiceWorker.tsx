'use client';

import { useEffect } from 'react';

/** Registers the offline service worker in production builds only. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(() => navigator.serviceWorker.ready)
      // Keep a fresh copy of the public help numbers for the offline page. The answer is read
      // to the end: left unread, the request stays open for as long as the page does.
      .then(() => fetch('/api/support', { credentials: 'same-origin' }))
      .then((res) => res.arrayBuffer())
      .catch(() => {
        // Offline support is an enhancement; the app works without it.
      });
  }, []);
  return null;
}
