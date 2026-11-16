self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/c/") || url.pathname.startsWith("/feed")) return;
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open("mm-shell");
      return (await cache.match(event.request)) || Response.error();
    }),
  );
});
