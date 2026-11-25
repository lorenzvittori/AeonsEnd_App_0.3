// tools/confronto/confronta.mjs: lo strumento di confronto fisso (npm run confronta -- <ref> [--solo partite,scenari,...]).
// Costruisce <ref> (tag o commit) in una worktree e la versione attuale, le serve su due porte, le apre in Chromium senza
// finestra con caso e orologio fissati, fa le prove (tools/confronto/prove/) in tutte e due e stampa una riga per prova:
// "✓ identico" oppure "✗ N differenze". I dettagli (prova, schermata, elemento, proprietà, prima/dopo) sono in
// .confronto/esito.json; in console le prime 10 per prova. Uscita 0 se tutto identico, 1 altrimenti, 2 se lo strumento non
// riesce a lavorare. Come si usa e come si aggiunge una prova: CONTESTO_SVILUPPO.md, sezione 9.
// Dipende da: costruzione.mjs, server.mjs, browser.mjs, prove/*.mjs. Usato da: npm run confronta. Non entra nella build.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { avvia } from './browser.mjs';
import { CONFRONTO, costruisciAttuale, costruisciRef } from './costruzione.mjs';
import { servi } from './server.mjs';
import partite from './prove/partite.mjs';
import scenari from './prove/scenari.mjs';
import salvataggi from './prove/salvataggi.mjs';
import schermate from './prove/schermate.mjs';
import indietro from './prove/indietro.mjs';
import scheletri from './prove/scheletri.mjs';

const PROVE = [partite, scenari, salvataggi, schermate, indietro, scheletri];
const DISPONIBILI = PROVE.map(p => p.nome);

function leggiArgomenti(argv) {
  const out = { ref: null, solo: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--solo') out.solo = String(argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (argv[i].startsWith('--solo=')) out.solo = argv[i].slice(7).split(',').map(s => s.trim()).filter(Boolean);
    else if (!out.ref) out.ref = argv[i];
  }
  return out;
}

const riga = (nome, testo) => console.log(`${nome.padEnd(11)} ${testo}`);
const secondi = ms => (ms / 1000).toFixed(1) + ' s';

async function main() {
  const { ref, solo } = leggiArgomenti(process.argv.slice(2));
  if (!ref) { console.error('Uso: npm run confronta -- <tag o commit> [--solo ' + DISPONIBILI.join(',') + ']'); return 2; }
  if (solo && solo.some(s => !DISPONIBILI.includes(s))) { console.error('Prove sconosciute: ' + solo.filter(s => !DISPONIBILI.includes(s)).join(', ') + '. Disponibili: ' + DISPONIBILI.join(', ')); return 2; }
  const inizio = Date.now();
  const scelte = PROVE.filter(p => !solo || solo.includes(p.nome));

  console.log(`Costruisco ${ref} e la versione attuale…`);
  const bRef = costruisciRef(ref);
  const bAtt = costruisciAttuale();
  console.log(`  ${ref}: ${bRef.sha.slice(0, 7)}${bRef.riusata ? ' (build riusata)' : ''}; attuale: ${bAtt.sha.slice(0, 7)}+modifiche`);
  const sRef = await servi(bRef.dist);
  const sAtt = await servi(bAtt.dist);
  const builds = [{ nome: ref, url: sRef.url }, { nome: 'attuale', url: sAtt.url }];
  const browser = await avvia();

  const esito = { ref, sha: bRef.sha, data: new Date().toISOString(), gruppi: {} };
  let tuttoIdentico = true;
  try {
    for (const prova of scelte) {
      const t0 = Date.now();
      const differenze = [];
      const ctx = {
        browser, builds, elenco: [],
        reg: ds => { differenze.push(...ds); },
        // Errori dell'app nelle due pagine: quelli solo nella versione attuale sono una differenza (gruppo "console")
        // Nota: reg() raccoglie sia quelli della prova sia quelli di console, divisi per il campo `prova`
      };
      let sommario = '';
      try { sommario = await prova.esegui(ctx) || ''; } catch (err) {
        differenze.push({ prova: prova.nome, schermata: '(prova)', elemento: 'strumento', proprieta: 'errore', prima: '', dopo: String(err.stack || err).split('\n').slice(0, 3).join(' | ') });
      }
      const proprie = differenze.filter(d => d.prova !== 'console');
      const console_ = differenze.filter(d => d.prova === 'console');
      esito.gruppi[prova.nome] = { riassunto: sommario, secondi: (Date.now() - t0) / 1000, differenze: proprie };
      if (ctx.elenco.length) esito.gruppi[prova.nome].elenco = ctx.elenco;
      esito.gruppi.console = esito.gruppi.console || { riassunto: '', differenze: [] };
      esito.gruppi.console.differenze.push(...console_);
      riga(prova.nome, proprie.length ? `✗ ${proprie.length} differenze  (${sommario}; ${secondi(Date.now() - t0)})` : `✓ identico  (${sommario}; ${secondi(Date.now() - t0)})`);
      proprie.slice(0, 10).forEach(d => console.log(`    [${d.schermata}] ${d.elemento} · ${d.proprieta}: ${d.prima} → ${d.dopo}`));
      if (proprie.length > 10) {
        const conta = new Map();
        proprie.forEach(d => conta.set(d.proprieta, (conta.get(d.proprieta) || 0) + 1));
        console.log('    più frequenti: ' + [...conta].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([p, n]) => `${p} (${n})`).join(', '));
      }
      if (proprie.length > 10) console.log(`    … altre ${proprie.length - 10} in .confronto/esito.json`);
      if (proprie.length) tuttoIdentico = false;
    }
    const c = esito.gruppi.console;
    if (c) {
      riga('console', c.differenze.length ? `✗ ${c.differenze.length} errori nuovi` : '✓ nessun errore nuovo');
      c.differenze.slice(0, 10).forEach(d => console.log(`    [${d.schermata}] ${d.dopo}`));
      if (c.differenze.length) tuttoIdentico = false;
    }
  } finally {
    await browser.close();
    await sRef.chiudi();
    await sAtt.chiudi();
  }
  esito.secondi = (Date.now() - inizio) / 1000;
  esito.identico = tuttoIdentico;
  mkdirSync(CONFRONTO, { recursive: true });
  writeFileSync(join(CONFRONTO, 'esito.json'), JSON.stringify(esito, null, 1));
  console.log(`${tuttoIdentico ? 'TUTTO IDENTICO' : 'CI SONO DIFFERENZE'} · ${secondi(Date.now() - inizio)} · dettagli: .confronto/esito.json`);
  return tuttoIdentico ? 0 : 1;
}

main().then(code => process.exit(code), err => { console.error(err); process.exit(2); });

