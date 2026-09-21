// Service Worker for PWA. Financial/API responses must never enter Cache Storage.
const CACHE_NAME = 'financeiro-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('financeiro-') && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Let the browser handle mutations and every cross-origin request, including Supabase.
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }
  
  // Navigation is network-first, with the cached app shell only as an offline fallback.
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put('/', response.clone());
          }
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  const isStaticAsset =
    url.pathname === '/manifest.json' ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/_next/static/');

  if (!isStaticAsset) {
    return;
  }

  // Only immutable/local presentation assets use stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then(async (networkResponse) => {
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);
      return cachedResponse || fetchPromise;
    })
  );
});
