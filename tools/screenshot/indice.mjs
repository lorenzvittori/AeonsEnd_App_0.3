// tools/screenshot/indice.mjs: scrive indice.html nella cartella degli screenshot (tools/screenshot/README.md): tutte le immagini in griglia,
// il nome sotto ciascuna, per guardarle di colpo nel browser. Dipende da: Node. Usato da: screenshot.mjs.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function scriviIndice(cartella, risultati, arg) {
  const lingua = arg.lingua === 'en' ? 'inglese' : 'italiano';
  const schede = risultati.map(r => `<figure${r.ok ? '' : ' class="guasta"'}>
  <a href="${esc(r.file)}"><img src="${esc(r.file)}" width="360" height="720" loading="lazy" alt="${esc(r.titolo)}"></a>
  <figcaption><b>${esc(r.file)}</b><br>${esc(r.titolo)}${r.test ? ' · Modalità test' : ''}${r.ok ? '' : ' · DA CONTROLLARE'}</figcaption>
</figure>`).join('\n');
  writeFileSync(join(cartella, 'indice.html'), `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Screenshot 360x720 (${lingua})</title>
<style>
  body { margin: 0; padding: 16px; background: #1b1d22; color: #ddd; font: 14px/1.4 system-ui, sans-serif; }
  h1 { font-size: 18px; margin: 0 0 4px; } p { margin: 0 0 16px; color: #999; }
  main { display: grid; grid-template-columns: repeat(auto-fill, 360px); gap: 20px; }
  figure { margin: 0; } img { display: block; width: 360px; height: 720px; border: 1px solid #444; background: #000; }
  figcaption { margin-top: 6px; font-size: 12px; word-break: break-all; } figure.guasta img { border-color: #e55; }
</style></head><body>
<h1>Screenshot dell'app, 360×720 (${lingua})</h1>
<p>${risultati.length} immagini da ${360 * arg.scala}×${720 * arg.scala} pixel: ognuna è un frame 360×720 in Figma. Un clic apre l'immagine intera.</p>
<main>
${schede}
</main></body></html>
`);
}
