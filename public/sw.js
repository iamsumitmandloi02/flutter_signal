const CACHE='flutter-signal-v1';
const ASSETS=['/flutter_signal/','/flutter_signal/index.html','/flutter_signal/src/main.js','/flutter_signal/src/spa.js','/flutter_signal/src/styles.css','/flutter_signal/src/content/questionBank.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
