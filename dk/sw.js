/** Ağ öncelikli: F5 ile güncel app.js / CSS gelir; çevrimdışı için önbellek yedek. */
const CACHE = "dk-pwa-v22";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const live = await fetch(request, { cache: "no-store" });
        if (live && live.ok && live.type === "basic") {
          const c = await caches.open(CACHE);
          await c.put(request, live.clone());
        }
        return live;
      } catch (_) {
        const cached = await caches.match(request);
        if (cached) return cached;
        return caches.match("./index.html");
      }
    })(),
  );
});
