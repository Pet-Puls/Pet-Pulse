const cacheName = 'petpulse-offline-v1';
const offlineUrl = new URL('offline.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.add(offlineUrl)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('petpulse-offline-') && key !== cacheName)
        .map(key => caches.delete(key)),
    )),
  );
});

self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(async () => {
    const response = await (await caches.open(cacheName)).match(offlineUrl);
    if (!response) throw new Error('Offline page is unavailable');
    return response;
  }));
});
