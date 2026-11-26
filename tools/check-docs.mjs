// Controllo della documentazione di docs/ (npm run check, dopo check-moduli). Uso: node tools/check-docs.mjs [file.md ...]
// Perché: la documentazione non deve diventare vecchia. Tre controlli, su ogni file docs/*.md:
// 1. ogni percorso di file citato tra backtick esiste (si cerca dalla radice del repository, poi in src/ e in public/:
//    la documentazione scrive `stato/partita.ts` come i README di src/). Contano i percorsi con una barra o con
//    un'estensione di file; non contano i testi con spazi, parentesi, segnaposto (<nome>, *) né il contenuto dei blocchi di codice;
// 2. ogni link tra file ([testo](altro.md), [testo](../src/ui/README.md)) porta a un file che esiste;
// 3. ogni blocco ```mermaid si disegna senza errori: si usa Playwright (già installato, senza finestra) con mermaid come
//    dipendenza di sviluppo, in una pagina vuota.
// "Esiste" vuol dire SALVATO nel repository (git ls-files), non presente sul disco: una cartella generata o esclusa da .gitignore
// (dist/, node_modules/, .confronto/, screenshot/) c'è sul PC ma non sul server di pubblicazione, e il controllo deve fallire
// qui come là. Nei documenti queste cartelle si scrivono senza backtick (sono "cartelle generate, non nel repository").
// Esce con 1 se trova problemi.
// Dipende da: git, playwright, mermaid. Usato da: package.json (script check).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const MERMAID = join(ROOT, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
// Dove si cerca un percorso scritto in modo breve (come nei README: `stato/partita.ts` sta in src/)
const BASI = ['', 'src/', 'public/'];
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
  // Un indirizzo del sito (`/AeonsEnd_App_0.3/`) non è un file del repository
  if (t.length < 4 || t.startsWith('/') || (t.startsWith('.') && !t.includes('/'))) return false;
  return t.includes('/') || ESTENSIONI.test(t);
}

// File salvati nel repository e le loro cartelle (git ls-files: solo quello che c'è anche sul server, con le maiuscole e le
// minuscole esatte, come su Linux anche se si lavora su Windows)
const SALVATI = new Set();
for (const f of execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean)) {
  const pezzi = f.split('/');
  for (let i = 1; i <= pezzi.length; i++) SALVATI.add(pezzi.slice(0, i).join('/'));
}

// Il file o la cartella è salvato nel repository
function esisteEsatto(assoluto) {
  const rel = relative(ROOT, assoluto);
  if (rel.startsWith('..')) return existsSync(assoluto);
  return SALVATI.has(rel.split(sep).filter(Boolean).join('/'));
}

function esiste(percorso) {
  const pulito = percorso.replace(/^\.?\//, '');
  return BASI.some(base => esisteEsatto(join(ROOT, base + pulito)));
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
      if (!esisteEsatto(bersaglio)) segnala(file, numero, `il link ${dove} non porta a un file che esiste`);
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
