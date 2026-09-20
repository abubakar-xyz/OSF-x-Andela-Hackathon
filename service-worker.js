const CACHE = 'nuru-civic-v1';
const ASSETS = ['/', '/index.html', '/src/styles.css', '/src/app.js', '/src/engine.js', '/src/data/countryPack.js'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((res) => res || fetch(event.request)));
});
