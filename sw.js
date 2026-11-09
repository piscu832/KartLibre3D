// Service Worker oficial de KartLibre 3D para instalación PWA en Android y soporte Offline
const CACHE_NAME = "kartlibre3d-pwa-v13";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/styles.css?v=13",
  "./src/three.min.js?v=13",
  "./src/peerjs.min.js?v=13",
  "./src/kartModelData.js?v=13",
  "./src/racersData.js?v=13",
  "./src/kartFactory.js?v=13",
  "./src/trackBuilder.js?v=13",
  "./src/weatherAndAudio.js?v=13",
  "./src/networkManager.js?v=13",
  "./src/gameEngine.js?v=13",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon.png",
  "./assets/favicon.png",
  "./assets/logo-kartlibre.jpg",
  "./Pistas/Kartódromo-V1.jpeg"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);
      return cachedResponse || fetchPromise;
    })
  );
});

