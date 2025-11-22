const CACHE_NAME = 'mnemoniqr-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/MQR_logo.png',
  '/assets/favicon.ico',
  '/assets/favicon.svg',
  '/assets/apple-touch-icon.png',
  '/assets/web-app-manifest-192x192.png',
  '/assets/web-app-manifest-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
