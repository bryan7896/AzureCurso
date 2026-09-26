// service-worker.js (generado por build.py — no editar a mano)
const CACHE_NAME = "ai901-trainer-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./datos/1.1-ejercicios.json",
  "./datos/1.1-informacion.json",
  "./datos/1.2-ejercicios.json",
  "./datos/1.2-informacion.json",
  "./datos/1.3-ejercicios.json",
  "./datos/1.3-informacion.json",
  "./datos/2.1-ejercicios.json",
  "./datos/2.1-informacion.json",
  "./datos/2.2-ejercicios.json",
  "./datos/2.2-informacion.json",
  "./datos/2.3-ejercicios.json",
  "./datos/2.3-informacion.json",
  "./datos/2.4-ejercicios.json",
  "./datos/2.4-informacion.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// Estrategia "network-first, cache-fallback": si hay internet, siempre trae
// la versión más nueva (útil mientras vas editando los .json de datos/) y
// la deja en caché; si no hay internet, sirve la última copia cacheada —
// así la app funciona 100% offline después del primer uso.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clonado = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonado));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
