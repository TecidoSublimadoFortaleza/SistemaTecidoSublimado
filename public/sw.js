// Minimal service worker to satisfy PWA installation criteria across all Chromium browsers
const CACHE_NAME = 'subligestao-pwa-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let browser handle normal network requests with network-first fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
