// Grimoire service worker.
//
// Exists only so browsers treat the web app as installable (required for the
// Android Share menu target declared in manifest.webmanifest). It deliberately
// caches nothing and passes every request straight to the network, so it can
// never serve stale UI or stale API data.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // No respondWith(): the browser handles the request normally.
});
