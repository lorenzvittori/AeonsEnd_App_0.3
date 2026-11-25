// tools/confronto/server.mjs: server statico minimo per le build da confrontare (strumento di confronto, vedi
// tools/confronto/README.md). Serve una cartella `dist` sotto il percorso della base di Vite (vite.config.ts),
// ognuna su una porta sua: così ogni build ha il suo localStorage. Non fa parte dell'app e non entra nella build.
// Dipende da: Node. Usato da: confronta.mjs.

import { createServer } from 'node:http';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

// La base si legge da vite.config.ts (unico posto in cui è scritta)
const BASE = /base:\s*'([^']+)'/.exec(readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8'))?.[1];
if (!BASE) throw new Error('base non trovata in vite.config.ts');
const TIPI = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

// Serve `radice` su una porta libera; restituisce { porta, url, chiudi }
export function servi(cartella) {
  const radice = resolve(cartella);
  const server = createServer((req, res) => {
    let percorso = decodeURIComponent((req.url || '/').split('?')[0]);
    if (percorso === '/') { res.writeHead(302, { Location: BASE }); res.end(); return; }
    if (!percorso.startsWith(BASE)) { res.writeHead(404); res.end('fuori dalla base'); return; }
    percorso = percorso.slice(BASE.length) || 'index.html';
    let file = normalize(join(radice, percorso));
    if (!file.startsWith(radice + sep) && file !== radice) { res.writeHead(403); res.end(); return; }
    try {
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
      statSync(file);
    } catch {
      res.writeHead(404); res.end('non trovato'); return;
    }
    res.writeHead(200, { 'Content-Type': TIPI[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  return new Promise(ok => {
    server.listen(0, '127.0.0.1', () => {
      const porta = server.address().port;
      ok({ porta, url: `http://127.0.0.1:${porta}${BASE}`, chiudi: () => new Promise(r => server.close(() => r())) });
    });
  });
}
