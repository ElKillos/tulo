// App del móvil (D-049): funcionar sin conexión.
// Con red, siempre lo último del servidor (y se guarda una copia); sin red, la
// copia. Nada de /api/ pasa por aquí: el puente con el PC va siempre en vivo.
//
// `__VERSION__` y `lista.json` los pone `node herramientas/movil.mjs <carpeta>`
// al preparar la carpeta para un alojamiento web: la lista son todos los
// ficheros de la app, que se guardan al instalar. Servida por el puente
// (server.mjs) no hay lista: se guarda lo que se va pidiendo.

const VERSION = '0bd47fcf1428';
const PREFIJO = 'tulo-movil-';
const CACHE = PREFIJO + VERSION;

self.addEventListener('install', (ev) => {
  ev.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      const r = await fetch('./lista.json', { cache: 'no-store' });
      if (r.ok) {
        const { ficheros } = await r.json();
        await cache.addAll(ficheros);
      }
    } catch { /* sin lista: se irá guardando lo que se pida */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    for (const nombre of await caches.keys()) {
      if (nombre.startsWith(PREFIJO) && nombre !== CACHE) await caches.delete(nombre);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return;
  ev.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const r = await fetch(req);
      if (r.ok) cache.put(req, r.clone());
      return r;
    } catch (e) {
      const guardado = (await cache.match(req, { ignoreSearch: true }))
        ?? (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
      if (guardado) return guardado;
      throw e;
    }
  })());
});
