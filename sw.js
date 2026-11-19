// Service Worker oficial de KartLibre 3D para instalación PWA en Android y soporte Offline
const CACHE_NAME = "kartlibre3d-pwa-v29";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/styles.css?v=29",
  "./src/three.min.js?v=29",
  "./src/peerjs.min.js?v=29",
  "./src/kartModelData.js?v=29",
  "./src/racersData.js?v=29",
  "./src/kartFactory.js?v=29",
  "./src/trackBuilder.js?v=29",
  "./src/weatherAndAudio.js?v=29",
  "./src/networkManager.js?v=29",
  "./src/gameEngine.js?v=29",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon.png",
  "./assets/favicon.png",
  "./assets/logo-kartlibre.jpg",
  "./Pistas/Kartódromo-V1.jpeg",
  "./Pistas/Kartódromo-V2.jpeg"
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

  // 1. Para peticiones de navegación y documentos HTML: SIEMPRE Network-First
  // para que cualquier cambio o actualización se refleje de inmediato sin quedar atrapado en caché vieja
  const isHtml = event.request.mode === "navigate" ||
                 url.pathname.endsWith(".html") ||
                 url.pathname === "/" ||
                 url.pathname.endsWith("/");

  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. Para otros assets (scripts, css, texturas con ?v=XX): Caché primero con fallback a red
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      });
    })
  );
});

