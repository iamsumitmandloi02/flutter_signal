const CACHE = 'flutter-signal-v2';
const BASE = '/flutter_signal';
const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/manifest.webmanifest`,
  `${BASE}/src/main.js`,
  `${BASE}/src/spa.js`,
  `${BASE}/src/storage.js`,
  `${BASE}/src/scheduler.js`,
  `${BASE}/src/scoring.js`,
  `${BASE}/src/pwa.js`,
  `${BASE}/src/styles.css`,
  `${BASE}/src/content/questionBank.json`,
  `${BASE}/src/content/contentHealth.json`
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
