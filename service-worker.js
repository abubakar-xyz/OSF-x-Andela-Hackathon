/**
 * Wazi — offline shell.  DESIGN.md §17, §28.
 *
 * The cached Country Pack is what makes "no connection" a usable state
 * rather than a dead end: cases still open, drafts still edit, PDFs still
 * export. Only "check for anything newer" needs the network, and when it
 * is missing Wazi says so instead of pretending.
 */

const CACHE = 'wazi-v3';

const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './src/styles/tokens.css', './src/styles/app.css', './src/styles/print.css',
  './assets/fonts/archivo-latin.woff2', './assets/fonts/archivo-latin-ext.woff2',
  './assets/fonts/fraunces-latin.woff2', './assets/fonts/fraunces-latin-ext.woff2',
  './src/app.js',
  './src/core/dom.js', './src/core/bus.js', './src/core/machine.js',
  './src/core/store.js', './src/core/sound.js', './src/core/net.js',
  './src/character/aperture.js',
  './src/evidence/schema.js', './src/evidence/types.js', './src/evidence/ladder.js',
  './src/evidence/pack.js', './src/evidence/pipeline.js', './src/evidence/safety.js',
  './src/tools/index.js', './src/tools/draft.js',
  './src/voice/speech.js', './src/voice/live.js',
  './src/i18n/strings.js',
  './src/components/fact.js', './src/components/stateGlyph.js', './src/components/sourceChip.js',
  './src/components/ribbon.js', './src/components/sheet.js', './src/components/twoTruths.js',
  './src/components/shareImage.js', './src/components/routeCard.js', './src/components/draftStudio.js',
  './src/components/disclosure.js', './src/components/caseReceipt.js',
  './src/components/captionRibbon.js', './src/components/clueRow.js',
  './data/packs/ke-siaya/pack.json', './data/packs/ke-siaya/sources.json',
  './data/packs/ke-siaya/entities.json', './data/packs/ke-siaya/records.json',
  './data/packs/ke-siaya/institutions.json', './data/packs/ke-siaya/routes.json',
  './data/packs/ke-siaya/procedures.json',
  './data/packs/ke-siaya/fixtures/FIXTURE_signboard.svg',
  './data/packs/ke-siaya/fixtures/FIXTURE_site_photo.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      /* One bad URL must not fail the whole install and leave the app
         with no offline shell at all. */
      .then((cache) => Promise.allSettled(ASSETS.map((a) => cache.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  /* Pack data: cache first, then revalidate in the background, so the
     freshness of what we show is a property we can state honestly. */
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
