const CACHE = 'wazi-v1';
const ASSETS = ['/', '/index.html', '/src/styles.css', '/src/app.js', '/src/engine.js', '/src/data/countryPack.js'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener('activate', (event) => {
  // Reclaim storage from earlier cache versions, including the pre-rename
  // 'nuru-civic-v1' cache. Orphaned caches are dead weight on low-end devices.
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
});
self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((res) => res || fetch(event.request)));
});
