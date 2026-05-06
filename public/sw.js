const CACHE_NAME = 'cucina-vue-v23';

// Use relative URLs so paths resolve correctly regardless of subpath deployment
// (e.g. GitHub Pages under /cucina-app/)
const STATIC_ASSETS = [
  // PRECACHE_BUNDLES_INJECTED_HERE — do not edit this marker
  './',
  './manifest.webmanifest',
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const results = await Promise.allSettled(
      STATIC_ASSETS.map(url => cache.add(url))
    );
    const failures = results
      .map((r, i) => ({ r, url: STATIC_ASSETS[i] }))
      .filter(({ r }) => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn('[sw] Precache: ' + failures.length + ' of ' + STATIC_ASSETS.length + ' assets failed');
      failures.forEach(({ r, url }) => console.warn('[sw]   FAIL', url, r.reason?.message || r.reason));
    } else {
      console.log('[sw] Precache: all ' + STATIC_ASSETS.length + ' assets cached');
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

function updateCache(request, response) {
  const url = new URL(request.url);
  if (!['http:', 'https:'].includes(url.protocol)) return response;
  if (!response || response.status !== 200) return response;
  const clone = response.clone();
  caches.open(CACHE_NAME)
    .then(cache => cache.put(request, clone))
    .catch(() => { });
  return response;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const reqUrl = new URL(event.request.url);
  if (!['http:', 'https:'].includes(reqUrl.protocol)) return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then(response => updateCache(event.request, response))
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return caches.match('./');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => updateCache(event.request, response));
    })
  );
});
