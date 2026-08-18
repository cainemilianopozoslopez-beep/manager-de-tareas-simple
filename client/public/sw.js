// Minimal, dependency-free service worker for Gmail Task Manager.
// Goal: load the app shell instantly / offline, WITHOUT caching API responses
// (Firestore/Auth live on a different origin) and without serving stale code
// when online. The app is intentionally NOT installable as a PWA (no manifest
// link in index.html) — this worker only exists for fast/offline loading.
//
// Strategy:
//   - navigations  -> network-first, fall back to the cached shell when offline
//   - same-origin GET assets -> stale-while-revalidate (instant from cache, refresh in bg)
//   - anything cross-origin (the API) or non-GET -> left untouched (goes straight to network)

// Bump this on any deploy that changes what/how the SW caches, so `activate`
// actually purges the old cache instead of reusing the same name forever.
const CACHE = 'gtm-shell-v2';
const SHELL = ['/', '/index.html', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only ever touch our own origin; API calls (localhost:5000) pass straight through.
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put('/', res.clone())).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
