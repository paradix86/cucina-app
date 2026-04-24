const CACHE_NAME = 'cucina-vue-v4';

// Use relative URLs so paths resolve correctly regardless of subpath deployment
// (e.g. GitHub Pages under /cucina-app/)
const STATIC_ASSETS = [
  './',
  './manifest.webmanifest',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
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
