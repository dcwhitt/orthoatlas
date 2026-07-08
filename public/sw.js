// Intentionally empty. Older OrthoAtlas builds cached aggressively during development.
// This service worker does not cache assets.
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
