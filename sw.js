/* ==========================================================================
   Service worker: permite usar la app sin conexión.
   Estrategia:
   - Navegación: red primero, caché como respaldo.
   - Recursos estáticos: caché primero y actualización en segundo plano.
   ========================================================================== */

const CACHE = 'controlgastos-v2';
const ARCHIVOS = [
  './',
  './index.html',
  './css/styles.css',
  './js/formato.js',
  './js/datos.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(
        claves.filter((clave) => clave !== CACHE).map((clave) => caches.delete(clave))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const solicitud = evento.request;
  if (solicitud.method !== 'GET') return;

  const url = new URL(solicitud.url);
  if (url.origin !== self.location.origin) return;

  if (solicitud.mode === 'navigate') {
    evento.respondWith(
      fetch(solicitud)
        .then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put(solicitud, copia));
          return respuesta;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  evento.respondWith(
    caches.match(solicitud).then((cacheado) => {
      const red = fetch(solicitud)
        .then((respuesta) => {
          if (respuesta && respuesta.status === 200 && respuesta.type === 'basic') {
            const copia = respuesta.clone();
            caches.open(CACHE).then((cache) => cache.put(solicitud, copia));
          }
          return respuesta;
        })
        .catch(() => cacheado);

      return cacheado || red;
    })
  );
});
