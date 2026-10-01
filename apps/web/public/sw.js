/* Waypoint service worker.
 * - Navigations: network only; when offline, /offline.html is shown instead.
 * - /api/support (public help numbers): network first with a saved copy, which
 *   /offline.html reads so help numbers still show without a connection.
 * - The offline page and the few files it needs are saved when the worker is installed.
 * Nothing else is touched. Built assets (/_next/static) are left to the browser: their names
 * change with their content, so its own cache already keeps them, and a second copy here was
 * never cleared out and failed loudly in Firefox when a request was cancelled.
 * Pages are never saved. The one copy kept for offline use — help numbers for the person's
 * country — is deleted when they sign out (the page sends "forget"), so the next person to
 * use the device never sees it.
 * Every answer given here settles: a worker that lets a request fail with an error of its own
 * shows up as a broken page. When there is neither a network nor a saved copy, the answer is
 * the plain "no connection" the browser would have given by itself. */
const VERSION = 'wp-v5';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE = ['/offline.html', '/icons/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // Caches from earlier versions go, including the old copies of built assets.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .catch(() => {})
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  // Only this site's own pages may ask: a message from anywhere else is ignored.
  if (event.origin !== self.location.origin) return;
  if (event.data === 'forget') event.waitUntil(caches.delete(PAGES).catch(() => {}));
});

/** The saved copy of `key`, or the browser's own "no connection". Never rejects. */
const saved = (key) =>
  caches
    .match(key, { ignoreVary: true })
    .then((hit) => hit || Response.error())
    .catch(() => Response.error());

/** Keeps a copy of a good answer. A full or forbidden cache is not the request's problem. */
const keep = (cacheName, req, res) =>
  caches
    .open(cacheName)
    .then((c) => c.put(req, res))
    .catch(() => {});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/api/support') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Copy before handing the response over: afterwards its body is already in use.
          if (res.ok) {
            const kept = keep(PAGES, req, res.clone());
            // The worker stays awake until the copy is written. If the browser won't promise
            // that, the answer is still the answer.
            try {
              event.waitUntil(kept);
            } catch {}
          }
          return res;
        })
        .catch(() => saved(req)),
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => saved('/offline.html')));
    return;
  }

  // The files the offline page was saved with: from the network, or the saved copy without one.
  if (PRECACHE.includes(url.pathname)) event.respondWith(fetch(req).catch(() => saved(req)));
});
