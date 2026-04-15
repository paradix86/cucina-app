/**
 * sw.js — Service Worker: cache-first per tutti gli asset statici
 */

const CACHE_NAME = 'cucina-v31';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/i18n.js',
  './js/data.js',
  './js/storage.js',
  './js/toast.js',
  './js/timer.js',
  './js/import.js',
  './js/import-adapters.js',
  './js/import-web.js',
  './js/ui.js',
  './js/app.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
];

/* ---- Install: pre-cache tutti gli asset ---- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* ---- Activate: rimuovi cache vecchie ---- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

function updateCache(request, response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return response;
  const clone = response.clone();
  caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
  return response;
}

/* ---- Fetch: navigazioni network-first, asset statici cache-first ---- */
self.addEventListener('fetch', event => {
  // Solo GET; ignora richieste API Anthropic (sempre live)
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('api.anthropic.com')) return;

  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then(response => updateCache(event.request, response))
        .catch(async () => {
          const cachedPage = await caches.match(event.request);
          if (cachedPage) return cachedPage;
          return caches.match('./index.html');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        return updateCache(event.request, response);
      });
    })
  );
});
