// Controllo dei CSS dell'app (CONTESTO_SVILUPPO.md, sezioni 6 e 9). Uso:  node tools/check-css.mjs  (o npm run check)
// - Ogni selettore compare UNA volta sola per contesto (fuori da @media, o dentro la stessa @media) in tutti i file di
//   css/ del layout (refactoring fase 3, v230): una modifica va nella regola che c'è già, nel suo file.
// - L'elenco STYLES di index.html e gli @import di style.css (file di compatibilità) hanno gli stessi file nello stesso
//   ordine, e ogni file elencato esiste.
// - Negli url() dei file di css/ i percorsi delle immagini partono da ../ (sono relativi al file CSS).
// Esce con codice 1 se trova qualcosa.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

// Elenco STYLES di index.html e @import di style.css
const index = readFileSync(join(ROOT, 'index.html'), 'utf8');
const m = /var STYLES = \[([\s\S]*?)\];/.exec(index);
if (!m) { console.error('index.html: elenco STYLES non trovato'); process.exit(2); }
const styles = [...m[1].matchAll(/'([^']+\.css)'/g)].map(x => x[1]);
const imports = [...readFileSync(join(ROOT, 'style.css'), 'utf8').matchAll(/@import url\('([^']+)'\)/g)].map(x => x[1]);
const layout = styles.filter(f => !['css/design-tokens.css', 'css/components.css'].includes(f));
if (JSON.stringify(layout) !== JSON.stringify(imports)) problems.push(`style.css importa ${JSON.stringify(imports)}, ma STYLES (senza token e componenti) è ${JSON.stringify(layout)}`);
styles.forEach(f => { if (!existsSync(join(ROOT, f))) problems.push(`${f} elencato in STYLES non esiste`); });

// Parser minimo: commenti, stringhe, @media / @supports annidati, @keyframes e altre at-rule a blocco
function rules(text) {
  const out = [];
  let i = 0;
  const n = text.length;
  function skip() {
    for (;;) {
      if (text.startsWith('/*', i)) { const e = text.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; }
      else if (i < n && /\s/.test(text[i])) i++;
      else return;
    }
  }
  function until(stops) {
    let s = ''; let depth = 0;
    while (i < n) {
      const ch = text[i];
      if (text.startsWith('/*', i)) { const e = text.indexOf('*/', i + 2); i = e + 2; continue; }
      if (ch === '"' || ch === "'") { let j = i + 1; while (j < n && text[j] !== ch) { if (text[j] === '\\') j++; j++; } s += text.slice(i, j + 1); i = j + 1; continue; }
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (depth === 0 && stops.includes(ch)) break;
      s += ch; i++;
    }
    return s;
  }
  function block(ctx) {
    while (i < n) {
      skip();
      if (i >= n) return;
      if (text[i] === '}') { i++; return; }
      const line = text.slice(0, i).split('\n').length;
      const prelude = until(['{', ';', '}']).trim().replace(/\s+/g, ' ');
      if (text[i] === ';') { i++; continue; }
      if (text[i] === '}') continue;
      i++;
      if (/^@(media|supports)/.test(prelude)) block(ctx.concat(prelude));
      else if (prelude.startsWith('@')) { let d = 1; while (i < n && d) { if (text[i] === '{') d++; else if (text[i] === '}') d--; i++; } out.push({ at: prelude, ctx, line }); }
      else { until(['}']); i++; out.push({ prelude, ctx, line }); }
    }
  }
  block([]);
  return out;
}
function splitSelectors(prelude) {
  const parts = []; let s = ''; let d = 0;
  for (const ch of prelude) {
    if (ch === '(' || ch === '[') d++;
    if (ch === ')' || ch === ']') d--;
    if (ch === ',' && d === 0) { parts.push(s); s = ''; continue; }
    s += ch;
  }
  parts.push(s);
  return parts.map(x => x.replace(/\s+/g, '')).filter(Boolean);
}

const seen = new Map();
const keyframes = new Map();
let total = 0;
layout.forEach(f => {
  if (!existsSync(join(ROOT, f))) return;
  const text = readFileSync(join(ROOT, f), 'utf8');
  (text.match(/url\((['"]?)(?!\.\.\/|data:|https?:|#)[^)'"]+/g) || []).forEach(u => problems.push(`${f}: url() senza ../ (${u.slice(0, 60)})`));
  rules(text).forEach(r => {
    const ctx = r.ctx.join(' && ');
    if (r.at) {
      if (r.at.startsWith('@keyframes')) {
        const k = ctx + ' ' + r.at;
        if (keyframes.has(k)) problems.push(`${r.at} due volte: ${keyframes.get(k)} e ${f}:${r.line}`);
        keyframes.set(k, `${f}:${r.line}`);
      }
      return;
    }
    splitSelectors(r.prelude).forEach(sel => {
      total++;
      const k = ctx + ' ¦ ' + sel;
      if (seen.has(k)) problems.push(`selettore ripetuto${ctx ? ' (in ' + ctx + ')' : ''}: ${sel} in ${seen.get(k)} e ${f}:${r.line}`);
      else seen.set(k, `${f}:${r.line}`);
    });
  });
});

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\nCSS: ${problems.length} problemi`);
  process.exit(1);
}
console.log(`CSS: ${layout.length} file, ${total} selettori, ognuno una volta sola per contesto; STYLES e style.css allineati`);
