/**
 * sw.js — Service Worker: cache-first per tutti gli asset statici
 */

const CACHE_NAME = 'cucina-v3';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/i18n.js',
  './js/data.js',
  './js/storage.js',
  './js/timer.js',
  './js/import.js',
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

/* ---- Fetch: cache-first, poi rete ---- */
self.addEventListener('fetch', event => {
  // Solo GET; ignora richieste API Anthropic (sempre live)
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('api.anthropic.com')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cache solo risposte OK same-origin
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
