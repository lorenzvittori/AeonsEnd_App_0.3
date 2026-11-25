// Controllo della documentazione di docs/ (npm run check, dopo check-moduli). Uso: node tools/check-docs.mjs [file.md ...]
// Perché: la documentazione non deve diventare vecchia. Tre controlli, su ogni file docs/*.md:
// 1. ogni percorso di file citato tra backtick esiste (si cerca dalla radice del repository, poi in src/ e in public/:
//    la documentazione scrive `stato/partita.ts` come i README di src/). Contano i percorsi con una barra o con
//    un'estensione di file; non contano i testi con spazi, parentesi, segnaposto (<nome>, *) né il contenuto dei blocchi di codice;
// 2. ogni link tra file ([testo](altro.md), [testo](../src/ui/README.md)) porta a un file che esiste;
// 3. ogni blocco ```mermaid si disegna senza errori: si usa Playwright (già installato, senza finestra) con mermaid come
//    dipendenza di sviluppo, in una pagina vuota.
// Cartelle e file che esistono solo dopo un comando (dist/, node_modules/, .confronto/) sono in GENERATI: si citano, ma
// non si cercano. Esce con 1 se trova problemi.
// Dipende da: playwright, mermaid. Usato da: package.json (script check).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const MERMAID = join(ROOT, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
// Dove si cerca un percorso scritto in modo breve (come nei README: `stato/partita.ts` sta in src/)
const BASI = ['', 'src/', 'public/'];
// Percorsi che esistono solo dopo un comando (build, installazione, confronto): si citano ma non si cercano
const GENERATI = ['dist', 'node_modules', '.confronto'];
const ESTENSIONI = /\.(ts|js|mjs|css|json|md|html|py|yml|webmanifest|webp|png|svg)$/;

const problemi = [];
const segnala = (file, riga, testo) => problemi.push(`${relative(ROOT, file)}:${riga}: ${testo}`);

// Il file docs/*.md da controllare (o quelli passati sulla riga di comando)
function elencoDocumenti() {
  const argomenti = process.argv.slice(2);
  if (argomenti.length) return argomenti.map(a => resolve(a));
  if (!existsSync(DOCS)) return [];
  return readdirSync(DOCS).filter(f => f.endsWith('.md')).sort().map(f => join(DOCS, f));
}

// Dal testo di un file: le righe di testo normale (con il loro numero) e i blocchi ```mermaid (con la riga di inizio)
function leggi(testo) {
  const righe = testo.split(/\r?\n/);
  const normali = [];
  const mermaid = [];
  let blocco = null;
  righe.forEach((riga, i) => {
    const recinto = /^\s*(```+|~~~+)\s*([A-Za-z0-9_-]*)/.exec(riga);
    if (blocco) {
      if (recinto && recinto[1].startsWith(blocco.recinto[0]) && recinto[1].length >= blocco.recinto.length && !recinto[2]) {
        if (blocco.lingua === 'mermaid') mermaid.push({ riga: blocco.inizio, codice: blocco.righe.join('\n') });
        blocco = null;
      } else blocco.righe.push(riga);
      return;
    }
    if (recinto) { blocco = { recinto: recinto[1], lingua: recinto[2], inizio: i + 1, righe: [] }; return; }
    normali.push({ numero: i + 1, testo: riga });
  });
  if (blocco) mermaid.push({ riga: blocco.inizio, codice: null, aperto: true });
  return { normali, mermaid };
}

// Un testo tra backtick è un percorso di file da cercare?
function ePercorso(t) {
  if (/\s|[()<>*{}$|=,;:?"']/.test(t)) return false;
  // Un indirizzo del sito (`/AeonsEnd_App_0.2/`) non è un file del repository
  if (t.length < 4 || t.startsWith('/') || (t.startsWith('.') && !t.includes('/'))) return false;
  return t.includes('/') || ESTENSIONI.test(t);
}

function esiste(percorso) {
  const pulito = percorso.replace(/^\.?\//, '');
  const primo = pulito.split('/')[0];
  if (GENERATI.includes(primo)) return true;
  return BASI.some(base => existsSync(join(ROOT, base + pulito)));
}

function controllaPercorsi(file, normali) {
  for (const { numero, testo } of normali) {
    for (const m of testo.matchAll(/`([^`]+)`/g)) {
      const t = m[1].trim();
      if (ePercorso(t) && !esiste(t)) segnala(file, numero, `il percorso \`${t}\` non esiste`);
    }
  }
}

function controllaLink(file, normali) {
  for (const { numero, testo } of normali) {
    // Si tolgono i testi tra backtick: dentro non ci sono link veri
    const senza = testo.replace(/`[^`]*`/g, '');
    for (const m of senza.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const dove = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(dove) || dove.startsWith('#')) continue;
      const senzaAncora = dove.split('#')[0];
      if (!senzaAncora) continue;
      const bersaglio = resolve(dirname(file), decodeURIComponent(senzaAncora));
      if (!bersaglio.startsWith(ROOT + sep)) { segnala(file, numero, `il link ${dove} esce dal repository`); continue; }
      if (!existsSync(bersaglio)) segnala(file, numero, `il link ${dove} non porta a un file che esiste`);
    }
  }
}

// Disegna ogni blocco mermaid in una pagina vuota; un errore di sintassi o di disegno è un problema
async function controllaDiagrammi(blocchi) {
  if (!blocchi.length) return;
  if (!existsSync(MERMAID)) { problemi.push('manca node_modules/mermaid (npm ci): i diagrammi non si possono controllare'); return; }
  const browser = await chromium.launch();
  try {
    const pagina = await browser.newPage();
    await pagina.setContent('<!doctype html><html><body><div id="uscita"></div></body></html>');
    await pagina.addScriptTag({ path: MERMAID });
    await pagina.evaluate(() => { window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' }); });
    let n = 0;
    for (const b of blocchi) {
      if (b.aperto) { segnala(b.file, b.riga, 'blocco mermaid mai chiuso'); continue; }
      n++;
      const esito = await pagina.evaluate(async ([codice, id]) => {
        try {
          await window.mermaid.parse(codice);
          const { svg } = await window.mermaid.render(id, codice);
          return { ok: !/aria-roledescription="error"|Syntax error in text/.test(svg), nodi: (svg.match(/class="node /g) || []).length };
        } catch (err) {
          return { ok: false, errore: String(err && err.message ? err.message : err).split('\n').slice(0, 3).join(' | ') };
        }
      }, [b.codice, 'diagramma' + n]);
      if (!esito.ok) segnala(b.file, b.riga, 'il diagramma mermaid non si disegna: ' + (esito.errore || 'errore di sintassi'));
      else if (esito.nodi > 18) console.log(`  avviso: ${relative(ROOT, b.file)}:${b.riga}: il diagramma ha ${esito.nodi} riquadri (ne bastano una quindicina: meglio dividerlo)`);
    }
  } finally {
    await browser.close();
  }
}

const documenti = elencoDocumenti();
const diagrammi = [];
for (const file of documenti) {
  if (!existsSync(file)) { problemi.push(`${relative(ROOT, file)}: il file non esiste`); continue; }
  const { normali, mermaid } = leggi(readFileSync(file, 'utf8'));
  controllaPercorsi(file, normali);
  controllaLink(file, normali);
  mermaid.forEach(b => diagrammi.push({ ...b, file }));
}
await controllaDiagrammi(diagrammi);

if (problemi.length) {
  console.error('Documentazione: ' + problemi.length + ' problemi');
  problemi.forEach(p => console.error('  ' + p));
  process.exit(1);
}
console.log(`Documentazione: ${documenti.length} file, ${diagrammi.length} diagrammi, percorsi e link a posto`);
