const CACHE = 'flutter-signal-v2';
const BASE = '/flutter_signal/';
const ASSETS = [
  `${BASE}`,
  `${BASE}index.html`,
  `${BASE}src/main.js`,
  `${BASE}src/spa.js`,
  `${BASE}src/storage.js`,
  `${BASE}src/scheduler.js`,
  `${BASE}src/scoring.js`,
  `${BASE}src/pwa.js`,
  `${BASE}src/styles.css`,
  `${BASE}src/content/questionBank.json`,
  `${BASE}src/content/contentHealth.json`,
  `${BASE}manifest.webmanifest`
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
    return response;
  })());
});
