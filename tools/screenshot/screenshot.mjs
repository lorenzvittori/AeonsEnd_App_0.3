// tools/screenshot/screenshot.mjs: gli screenshot dell'app in tutte le fasi (npm run screenshot [-- --scala 1] [--lingua en] [--solo a,b] [--tutte]).
// Riusa lo strumento di confronto (tools/confronto/): costruisce la versione attuale, la serve, la apre in Chromium senza finestra a 360x720
// (telefono, tocco, deviceScaleFactor 2) con caso e orologio fissi, e percorre i passi di dati/schermate.mjs (GIRO e FOTO_IN_PIU: le voci con
// `foto`). Ogni immagine è nello stato finale (animazioni finite, immagini caricate). Esce in screenshot/360x720/ con un indice.html.
// Come si usa e come si aggiunge uno stato: tools/screenshot/README.md. Dipende da: tools/confronto/ (browser, costruzione, server, dati).
// Non fa parte dell'app e non entra nella build.

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { avvia, apri } from '../confronto/browser.mjs';
import { costruisciAttuale, RADICE } from '../confronto/costruzione.mjs';
import { servi } from '../confronto/server.mjs';
import { FOTO_IN_PIU, GIRO, ORDINE_FOTO } from '../confronto/dati/schermate.mjs';
import { SEME } from '../confronto/dati/scenari.mjs';
import { controllaImmagine, controllaStato } from './controlli.mjs';
import { scriviIndice } from './indice.mjs';

// Cartella di uscita: l'italiano in screenshot/360x720/, l'inglese accanto in screenshot/360x720-en/ (le due versioni non si sovrascrivono)
let USCITA = join(RADICE, 'screenshot', '360x720');
// Solo per la foto: il pulsante "Regolazioni" e la scritta "TEST · ..." della Modalità test (visibility e non display: lo spazio resta)
const NASCONDI = '.ae-regolazioni-pulsante, .ae-phase-test { visibility: hidden !important; }';

function leggiArgomenti(argv) {
  const out = { scala: 2, lingua: 'it', solo: null, tutte: false, senzaBuild: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valore = () => (a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i]);
    if (a.startsWith('--scala')) out.scala = Number(valore());
    else if (a.startsWith('--lingua')) out.lingua = String(valore());
    else if (a.startsWith('--solo')) out.solo = String(valore() || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--tutte') out.tutte = true;
    else if (a === '--senza-build') out.senzaBuild = true;
    else { console.error('Argomento sconosciuto: ' + a); process.exit(2); }
  }
  if (![1, 2, 3].includes(out.scala)) { console.error('--scala: 1, 2 o 3'); process.exit(2); }
  if (!['it', 'en'].includes(out.lingua)) { console.error('--lingua: it o en'); process.exit(2); }
  return out;
}

const slug = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Le voci da fotografare, nell'ordine di ORDINE_FOTO (quelle che non ci sono, in fondo, nell'ordine del giro). Il giro intero si percorre
// comunque (ogni voce parte da dove è arrivata la precedente): `k` è il posto nel giro, per il caso fisso come nella prova schermate.
function elencoFoto(tutte) {
  const giro = [...GIRO, ...FOTO_IN_PIU].map((voce, k) => ({ voce, k }));
  const nome = ({ voce }) => voce.foto || (tutte ? 'giro-' + slug(voce.id) : null);
  const scelte = giro.filter(g => nome(g));
  const pos = g => { const i = ORDINE_FOTO.indexOf(nome(g)); return i < 0 ? ORDINE_FOTO.length + scelte.indexOf(g) : i; };
  const ordinate = [...scelte].sort((a, b) => pos(a) - pos(b));
  return { giro, nome, ordinate };
}

async function main() {
  const arg = leggiArgomenti(process.argv.slice(2));
  if (arg.lingua !== 'it') USCITA += '-' + arg.lingua;
  const { giro, nome, ordinate } = elencoFoto(arg.tutte);
  const doppi = ordinate.map(nome).filter((n, i, v) => v.indexOf(n) !== i);
  if (doppi.length) { console.error('Nomi di foto ripetuti: ' + doppi.join(', ')); return 2; }
  if (arg.solo) {
    const note = ordinate.map(nome);
    const mancano = arg.solo.filter(s => !note.some(n => n.includes(s)));
    if (mancano.length) { console.error('Foto sconosciute: ' + mancano.join(', ') + '\nDisponibili: ' + note.join(', ')); return 2; }
  }
  const numero = new Map(ordinate.map((g, i) => [g, String(i + 1).padStart(2, '0')]));
  const volute = g => !arg.solo || arg.solo.some(s => nome(g).includes(s));

  console.log('Costruisco la versione attuale…');
  const build = arg.senzaBuild ? { dist: join(RADICE, '.confronto', 'attuale', 'dist') } : costruisciAttuale();
  const server = await servi(build.dist);
  const browser = await avvia();
  const risultati = [];
  const problemi = [];
  const bloccate = new Set();
  try {
    const pg = await apri(browser, { nome: 'attuale', url: server.url }, { vista: 'tel360', scala: arg.scala, telefono: true, lingua: arg.lingua });
    pg.page.on('requestfailed', r => bloccate.add(r.url().replace(/127\.0\.0\.1:\d+/, 'HOST')));
    await pg.page.addStyleTag({ content: NASCONDI }).then(h => h.evaluate(e => { e.id = 'foto-nascondi'; }));
    const analisi = await browser.newContext();
    const paginaAnalisi = await analisi.newPage();
    mkdirSync(USCITA, { recursive: true });
    // Un giro completo ricomincia da cartella vuota (le immagini di un giro vecchio, con altri numeri, non restano); con --solo si sostituiscono solo quelle chieste
    if (!arg.solo) for (const f of readdirSync(USCITA)) if (/\.(png|html)$/.test(f)) rmSync(join(USCITA, f));

    for (const g of giro) {
      const { voce, k } = g;
      let ok = true;
      // Prima dei passi (alcuni cliccano proprio sul pulsante Regolazioni, che nascosto non si tocca): nascosti solo nelle foto della partita
      await pg.page.evaluate(([vero]) => { document.getElementById('foto-nascondi').disabled = vero; }, [!!voce.test]);
      try {
        await pg.c('seme', SEME + k);
        await pg.ora(0);
        await pg.passi(voce.passi);
      } catch (err) {
        ok = false;
        problemi.push(`${voce.id}: passi non riusciti: ${String(err.message || err).split('\n')[0]}`);
      }
      if (!ok || !nome(g) || !volute(g)) continue;
      // La Modalità test stessa si fotografa com'è; la partita no
      await pg.page.evaluate(([vero]) => { document.getElementById('foto-nascondi').disabled = vero; }, [!!voce.test]);
      if (voce.istante === 'banner') {
        // La scritta Tier dura meno di 2 secondi e finisce trasparente: si ferma a metà, il resto va alla fine
        if (!await pg.page.evaluate(() => window.__c.fermaBanner())) problemi.push(`${voce.id}: la scritta Tier non c'è`);
      } else {
        await pg.stabilizza();
        await pg.assesta(300, true);
        await pg.stabilizza();
      }
      const file = `${numero.get(g)}-${nome(g)}.png`;
      const png = await pg.page.screenshot({ path: join(USCITA, file), animations: 'allow', caret: 'hide' });
      const guasti = [...await controllaStato(pg, voce), ...await controllaImmagine(paginaAnalisi, png, arg.scala)];
      for (const m of guasti) problemi.push(`${file}: ${m}`);
      risultati.push({ file, titolo: voce.id, nome: nome(g), ok: !guasti.length, test: !!voce.test });
      console.log(`${guasti.length ? '✗' : '✓'} ${file}`);
    }
    // Una richiesta fuori dal server locale è bloccata apposta (strumento di confronto: niente rete): non è un errore dell'app, ma si dice quale
    const dentro = [...bloccate].filter(u => u.startsWith('http://HOST'));
    const errori = [...new Set(pg.errori)].filter(e => !(/^Failed to load resource/.test(e) && !dentro.length));
    if (errori.length) problemi.push('errori dell\'app: ' + errori.join(' | '));
    if (bloccate.size) console.log(`\n(richieste fuori dal server locale, bloccate come nelle altre prove: ${[...bloccate].join(', ')})`);
    await analisi.close();
    await pg.chiudi();
  } finally {
    await browser.close();
    await server.chiudi();
  }
  scriviIndice(USCITA, risultati, arg);
  const w = 360 * arg.scala;
  console.log(`\n${risultati.length} screenshot ${w}x${720 * arg.scala} (${arg.lingua === 'en' ? 'inglese' : 'italiano'}) in ${USCITA}\nIndice: ${join(USCITA, 'indice.html')}`);
  if (problemi.length) { console.log('\nPROBLEMI:'); problemi.forEach(p => console.log('  ' + p)); return 1; }
  return 0;
}

main().then(code => process.exit(code), err => { console.error(err); process.exit(2); });
