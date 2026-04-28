const CACHE_NAME = "recordbildung-v1";
const SHARE_DB_NAME = "recordbildung-share-target";
const SHARE_DB_VERSION = 1;
const SHARE_STORE = "inbox";
const APP_SHELL = [
  "./",
  "./index.html",
  "./script.js",
  "./manifest.json",
  "./icon.svg",
];

function openShareDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARE_DB_NAME, SHARE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SHARE_STORE)) {
        db.createObjectStore(SHARE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSharedFile(file) {
  const db = await openShareDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_STORE, "readwrite");
    tx.objectStore(SHARE_STORE).put({
      id: `shared-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      blob: file,
      name: file.name || "shared-audio",
      type: file.type || "audio/webm",
      createdAt: new Date().toISOString(),
    });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function handleShareTarget(request) {
  const formData = await request.formData();
  const sharedFile = formData.get("audio");
  if (sharedFile && sharedFile.size) {
    await saveSharedFile(sharedFile);
  }
  return Response.redirect("./?shareTarget=1", 303);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname.endsWith("/share-target")) {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => caches.match("./index.html"));
    }),
  );
});
