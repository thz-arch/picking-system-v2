// Service Worker for Binho Picking
// Increment version to force update
const VERSION = '20250119-1';
const CACHE_NAME = `binho-picking-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/config.js',
  './js/utils.js',
  './js/api.js',
  './js/app.js',
  './binho-logo.png',
  './binho.ico',
  './mixkit-short-electric-fence-buzz-2966.wav',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached asset or fetch from network
        return response || fetch(event.request);
      })
  );
});
