// Service worker: l'app funziona anche senza rete (o con poca rete) dopo il primo uso.
// - Codice e dati (pagina, CSS, JS, JSON): prima la rete, così gli aggiornamenti arrivano subito; senza rete la copia
//   salvata. Dal passaggio a Vite (fase A) codice e CSS sono in app/ con un hash nel nome: ogni versione ha file
//   suoi. Quando arriva un index.html nuovo, le copie dei file di app/ che non cita più si cancellano.
// - Immagini e font: prima la copia salvata (non cambiano), altrimenti la rete, e si salvano.
// Le immagini delle carte del mazzo si scaricano all'inizio della partita (src/dati/rete.ts, prefetchDeckImages).
const CODE_CACHE = 'ae-code-v2'; // v2: fase A (Vite); la v1 aveva script.js e i CSS senza hash, si cancella
const MEDIA_CACHE = 'ae-media-v2'; // v256: carte turno rimesse com'erano prima di "nre cards" (stesso nome di file)
const SHELL = ['./', 'index.html', 'manifest.webmanifest'];

// File di app/ citati da un index.html (codice e CSS con l'hash)
function assetsOf(html) {
  return [...new Set([...html.matchAll(/app\/[A-Za-z0-9._-]+\.(?:js|css)/g)].map(m => m[0]))];
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CODE_CACHE)
    .then(async c => {
      await c.addAll(SHELL);
      // Anche il codice della versione attuale, così l'app parte senza rete già dopo la prima visita
      const page = await c.match('index.html');
      if (page) await c.addAll(assetsOf(await page.text()));
    })
    .catch(() => {})
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CODE_CACHE && k !== MEDIA_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function isMedia(url) {
  return /\.(webp|png|jpe?g|svg|woff2?|ttf)$/i.test(url.pathname) || url.hostname === 'fonts.gstatic.com';
}

async function mediaFirst(req) {
  const cache = await caches.open(MEDIA_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

// Del nostro sito si salva una copia sola per file, senza ?v=N / ?t=…: senza rete si ha l'ultima versione scaricata
function codeKey(req) {
  const url = new URL(req.url);
  return url.origin === self.location.origin ? url.origin + url.pathname : req;
}

// index.html nuovo: si cancellano le copie dei file di app/ che non cita (versioni vecchie)
async function dropOldAssets(res) {
  const keep = new Set(assetsOf(await res.text()).map(a => new URL(a, self.registration.scope).href));
  const cache = await caches.open(CODE_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.filter(k => /\/app\/[^/]+\.(js|css)$/.test(new URL(k.url).pathname) && !keep.has(k.url)).map(k => cache.delete(k)));
}

async function networkFirst(req, e) {
  const cache = await caches.open(CODE_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') {
      cache.put(codeKey(req), res.clone());
      // (solo l'index.html dell'app, non le altre pagine come scheletri/)
      const scope = new URL(self.registration.scope).pathname;
      const path = new URL(req.url).pathname;
      if (res.ok && (path === scope || path === scope + 'index.html')) e.waitUntil(dropOldAssets(res.clone()).catch(() => {}));
    }
    return res;
  } catch (err) {
    const hit = await cache.match(codeKey(req));
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && url.hostname !== 'fonts.googleapis.com' && url.hostname !== 'fonts.gstatic.com') return;
  e.respondWith(isMedia(url) ? mediaFirst(req) : networkFirst(req, e));
});
