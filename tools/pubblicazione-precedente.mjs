// Uso (nel workflow di pubblicazione, dopo npm run build):
//   node tools/pubblicazione-precedente.mjs https://lorenzvittori.github.io/AeonsEnd_App_0.3/ dist
//
// Perché: con Vite il codice e il CSS hanno un hash nel nome (app/index-AbC123.js) e ogni pubblicazione li cambia.
// GitHub Pages tiene index.html in cache circa 10 minuti: dopo una pubblicazione un telefono può avere ancora
// l'index.html vecchio, che chiede i file con l'hash vecchio. Se non ci fossero più, l'app non partirebbe.
// Qui si legge l'index.html del sito pubblicato ADESSO (la versione precedente), si scaricano i suoi file di app/ e
// si mettono in dist/app/ accanto a quelli nuovi. Si tengono i file delle ultime KEEP pubblicazioni (elenco in
// dist/app/precedenti.json), così anche due pubblicazioni di fila entro 10 minuti non rompono il sito.
// Se il sito pubblicato non si legge (prima pubblicazione, rete), non si porta niente e la pubblicazione continua.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEEP = 3;
const [site, dist] = process.argv.slice(2);
if (!site || !dist) { console.error('uso: node tools/pubblicazione-precedente.mjs <indirizzo del sito> <cartella dist>'); process.exit(2); }
const base = site.endsWith('/') ? site : site + '/';
const assetsDir = join(dist, 'app');
mkdirSync(assetsDir, { recursive: true });
const current = new Set(readdirSync(assetsDir));

async function get(url) {
  const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error(url + ': ' + res.status);
  return res;
}

let versions = [];
try {
  const html = await (await get(base + 'index.html')).text();
  // File di app/ citati dall'index.html pubblicato (src="…/app/index-xxx.js", href="…/app/index-xxx.css")
  const live = [...new Set([...html.matchAll(/app\/([A-Za-z0-9._-]+\.(?:js|css))/g)].map(m => m[1]))];
  let older = [];
  try { older = await (await get(base + 'app/precedenti.json')).json(); } catch (e) { older = []; }
  if (!Array.isArray(older)) older = [];
  versions = [live, ...older].filter(v => Array.isArray(v) && v.length).slice(0, KEEP);
} catch (err) {
  console.log('Sito pubblicato non leggibile, non porto file precedenti:', err.message);
}

let copied = 0;
for (const name of [...new Set(versions.flat())]) {
  if (current.has(name)) continue;
  try {
    const buf = Buffer.from(await (await get(base + 'app/' + name)).arrayBuffer());
    writeFileSync(join(assetsDir, name), buf);
    copied++;
  } catch (e) {
    console.log('Non trovato (si salta):', name);
  }
}
writeFileSync(join(assetsDir, 'precedenti.json'), JSON.stringify(versions));
console.log(`File delle pubblicazioni precedenti portati in ${assetsDir}: ${copied} (versioni tenute: ${versions.length})`);
if (!existsSync(join(dist, 'index.html'))) { console.error('dist/index.html mancante: prima npm run build'); process.exit(1); }
