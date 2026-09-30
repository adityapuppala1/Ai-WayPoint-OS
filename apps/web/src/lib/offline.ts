/**
 * The offline page keeps one copy of the help numbers for the person's country. When they sign
 * out or delete their account, it goes too: whoever uses the device next must not see where
 * the last person was. Both the service worker and the page's own caches are told, so it works
 * even while the worker is updating.
 */
export async function forgetOfflineCopy(): Promise<void> {
  try {
    navigator.serviceWorker?.controller?.postMessage('forget');
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.endsWith('-pages')).map((n) => caches.delete(n)));
    }
  } catch {
    // Private windows and old browsers may refuse: there is no offline copy there anyway.
  }
}
