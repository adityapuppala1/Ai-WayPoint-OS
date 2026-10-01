'use client';

import { useEffect } from 'react';

/** Registers the offline service worker in production builds only. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const workers = navigator.serviceWorker;
    // Keep a fresh copy of the public help numbers for the offline page: the worker saves the
    // answer as it passes. Only once the worker answers for this page, or the request would go
    // straight to the network and nothing would be saved. The answer is read to the end: left
    // unread, the request stays open for as long as the page does.
    const save = () => {
      if (!workers.controller) return;
      fetch('/api/support', { credentials: 'same-origin' })
        .then((res) => res.arrayBuffer())
        .catch(() => {
          // Offline support is an enhancement; the app works without it.
        });
    };
    // On a first visit the worker is "ready" a moment before it takes the page over, and a
    // new version of the worker starts with nothing saved: both times, this is the signal.
    workers.addEventListener('controllerchange', save);
    workers
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(() => workers.ready)
      .then(save)
      .catch(() => {
        // As above.
      });
    return () => workers.removeEventListener('controllerchange', save);
  }, []);
  return null;
}
