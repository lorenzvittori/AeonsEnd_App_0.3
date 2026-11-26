// tools/confronto/prove/misure.mjs: prova "misure" (strumento di confronto, tools/confronto/README.md). Non confronta due
// build: apre la versione attuale e controlla che ogni variabile di src/ui/schermate/partita-misure.css faccia quello che il
// suo commento dice. A 375×812, 390×844 e 1280×800, nel turno giocatori e nel turno nemesi: aumenta la variabile di 10px e
// misura (getBoundingClientRect) lo spazio tra le due cose del suo commento (dati/misure.mjs): deve crescere di 10px.
// Controlli fissi: la distanza tra il fondo della carta grande e la cima della zona 6 è --interattivi-distanza; la carta
// grande ha la stessa misura e posizione nei due turni; i due pesi dell'avanzo dividono lo spazio come dicono.
// Le variabili che non si provano così sono elencate (con il motivo) nell'esito: ctx.elenco.
// Dipende da: browser.mjs, dati/misure.mjs (anche LEGGI e IMPOSTA, che usa pure la pagina scheletri/). Usato da: confronta.mjs.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { apri } from '../browser.mjs';
import { CASI, IMPOSTA, LEGGI, MOMENTI, NON_PROVABILI, VISTE_PROVA } from '../dati/misure.mjs';

const DELTA = 10;
const TOLLERANZA = 0.6;

// Nella pagina: il valore attuale di una variabile (numero e unità)
const VALORE = ({ nome }) => {
  const t = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  const m = t.match(/^(-?\d*\.?\d+)([a-z%]*)$/);
  return m ? { numero: parseFloat(m[1]), unita: m[2] } : { testo: t };
};

// Nella pagina: la misura della carta grande, della zona 5 e della zona 6, e gli spazi dell'avanzo
const CARTA = () => {
  const visibile = e => e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
  const trova = sel => [...document.querySelectorAll(sel)].find(visibile) || null;
  const r = e => { const q = e.getBoundingClientRect(); return { top: q.top, bottom: q.bottom, width: q.width, height: q.height }; };
  const px = nome => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(nome));
  const carta = trova('.queue-slot .ae-card-art, .ae-focus-stage');
  const stato = trova('.queue-slot .ae-status-badge, .ae-focus-status');
  const z5 = trova('[data-zona="carte-grandi"]');
  const z6 = trova('[data-zona="interattivi"]');
  return {
    carta: r(carta), stato: r(stato), z5: r(z5), z6: r(z6),
    distanza: z6.getBoundingClientRect().top - carta.getBoundingClientRect().bottom,
    avanzoSopra: stato.getBoundingClientRect().top - (z5.getBoundingClientRect().top + px('--carte-grandi-spazio-sopra')),
    avanzoSotto: z6.getBoundingClientRect().top - carta.getBoundingClientRect().bottom - px('--interattivi-distanza'),
    colonna: document.getElementById('app').getBoundingClientRect().width,
    turno: document.getElementById('app').dataset.turno
  };
};

const arrotonda = n => Math.round(n * 100) / 100;

// Lo spazio di ogni caso (LEGGI sta in dati/misure.mjs, con i bordi: qui serve solo la misura)
const leggi = async (pg, casi) => (await pg.page.evaluate(LEGGI, { casi })).map(d => d && d.misura);

export default {
  nome: 'misure',
  async esegui(ctx) {
    const build = ctx.builds[ctx.builds.length - 1];
    let provati = 0;
    let assenti = 0;
    const segnala = (schermata, elemento, proprieta, prima, dopo) =>
      ctx.reg([{ prova: 'misure', schermata, elemento, proprieta, prima: String(prima), dopo: String(dopo) }]);
    const carte = {};

    // Ogni variabile del file ha un caso o un motivo per cui non si prova, e ogni caso ha la sua variabile
    const nelFile = [...readFileSync(join(import.meta.dirname, '..', '..', '..', 'src', 'ui', 'schermate', 'partita-misure.css'), 'utf8')
      .matchAll(/^\s*(--[\w-]+)\s*:/gm)].map(m => m[1]);
    const note = new Set([...CASI.map(c => c.v), ...NON_PROVABILI.map(n => n.v)]);
    nelFile.filter(v => !note.has(v)).forEach(v => segnala('(file delle misure)', v, 'caso', 'un caso in dati/misure.mjs o un motivo in NON_PROVABILI', 'nessuno'));
    [...note].filter(v => !nelFile.includes(v)).forEach(v => segnala('(dati/misure.mjs)', v, 'variabile', 'nel file delle misure', 'non c\'è'));

    for (const vista of VISTE_PROVA) {
      for (const momento of MOMENTI) {
        const nome = `${vista} · ${momento.id}`;
        const pg = await apri(ctx.browser, build, { vista: vista === 'tel390' ? 'tel390' : vista });
        try {
          await pg.passi(momento.passi);
          const turno = await pg.page.evaluate(() => document.getElementById('app').dataset.turno);
          if (!momento.atteso || (momento.atteso === 'nemesi' ? !['nemesi', 'pesca'].includes(turno) : turno !== momento.atteso)) {
            segnala(nome, '(momento)', 'data-turno', momento.atteso, turno);
            continue;
          }
          const applicabili = CASI.filter(c => !c.turni || c.turni.includes(momento.id));
          const base = await leggi(pg, applicabili);
          for (const [k, c] of applicabili.entries()) {
            if (base[k] === null) { assenti++; ctx.elenco.push({ schermata: nome, variabile: c.v, esito: 'elemento assente in questo momento' }); continue; }
            const attuale = await pg.page.evaluate(VALORE, { nome: c.v });
            if (attuale.numero === undefined) { segnala(nome, c.v, 'valore', 'numero', attuale.testo); continue; }
            const prima = Object.fromEntries(Object.entries(c.prima || {}).map(([n, v]) => [n, v]));
            const tutte = Object.keys(prima).concat(c.v);
            // Misura con le variabili di `prima`, poi con la variabile aumentata di 10
            if (Object.keys(prima).length) await pg.page.evaluate(IMPOSTA, { valori: prima });
            const [m0] = await leggi(pg, [c]);
            await pg.page.evaluate(IMPOSTA, { valori: { [c.v]: (attuale.numero + DELTA) + attuale.unita } });
            const [m1] = await leggi(pg, [c]);
            await pg.page.evaluate(IMPOSTA, { valori: Object.fromEntries(tutte.map(n => [n, null])) });
            provati++;
            const atteso = DELTA * (c.fattore || 1);
            if (m0 === null || m1 === null || Math.abs((m1 - m0) - atteso) > TOLLERANZA) {
              segnala(nome, `${c.v}  (${c.a[0]} ${c.a[1]} → ${c.b[0]} ${c.b[1]})`, `+${DELTA}px sulla variabile`,
                `${m0}px`, `${m1}px (cambia di ${m1 === null || m0 === null ? '?' : arrotonda(m1 - m0)}px, doveva ${atteso}px)`);
            }
          }
          // Controllo fisso: la carta grande a --interattivi-distanza dalla zona 6 (senza avanzo sotto)
          await pg.page.evaluate(IMPOSTA, { valori: { '--carte-grandi-avanzo-sotto': '0' } });
          const c0 = await pg.page.evaluate(CARTA);
          const dist = await pg.page.evaluate(VALORE, { nome: '--interattivi-distanza' });
          if (Math.abs(c0.distanza - dist.numero) > 0.5) {
            segnala(nome, 'carta grande → zona 6', 'distanza', `${dist.numero}px (--interattivi-distanza)`, `${arrotonda(c0.distanza)}px`);
          }
          carte[nome] = c0;
          provati++;
          // Controllo fisso: i pesi dell'avanzo. Si toglie larghezza alla carta, così l'altezza che avanza c'è
          const margine = { '--carte-grandi-margine-lato': '70px' };
          const pesi = [[1, 0], [1, 1], [3, 1], [0, 1]];
          for (const [sopra, sotto] of pesi) {
            await pg.page.evaluate(IMPOSTA, { valori: { ...margine, '--carte-grandi-avanzo-sopra': String(sopra), '--carte-grandi-avanzo-sotto': String(sotto) } });
            const c = await pg.page.evaluate(CARTA);
            const totale = c.avanzoSopra + c.avanzoSotto;
            const attesoSopra = totale * sopra / (sopra + sotto);
            provati++;
            if (totale < 5 && vista === 'desk') {
              // Su tablet e desktop la colonna si adatta alla carta: la larghezza non limita mai, non c'è altezza che avanza
              ctx.elenco.push({ schermata: nome, variabile: 'pesi dell\'avanzo', esito: 'non provato su desktop: la colonna si adatta alla carta, nessun avanzo' });
            } else if (totale < 5) segnala(nome, `pesi ${sopra}/${sotto}`, 'avanzo', 'almeno 5px', arrotonda(totale) + 'px');
            else if (Math.abs(c.avanzoSopra - attesoSopra) > 1) {
              segnala(nome, `pesi ${sopra}/${sotto}`, 'avanzo sopra', `${arrotonda(attesoSopra)}px su ${arrotonda(totale)}px`, `${arrotonda(c.avanzoSopra)}px`);
            }
          }
          await pg.page.evaluate(IMPOSTA, { valori: { '--carte-grandi-margine-lato': null, '--carte-grandi-avanzo-sopra': null, '--carte-grandi-avanzo-sotto': null } });
        } finally { await pg.chiudi(); }
      }
      // Controllo fisso: la carta grande uguale nei due turni (misura e posizione verticale)
      const a = carte[`${vista} · giocatori`];
      const b = carte[`${vista} · nemesi`];
      if (a && b) {
        for (const chiave of ['carta', 'stato', 'z5', 'z6']) {
          for (const lato of ['top', 'bottom', 'width', 'height']) {
            if (Math.abs(a[chiave][lato] - b[chiave][lato]) > 0.5) {
              segnala(`${vista} · giocatori contro nemesi`, chiave, lato, arrotonda(a[chiave][lato]), arrotonda(b[chiave][lato]));
            }
          }
        }
        if (Math.abs(a.colonna - b.colonna) > 0.5) segnala(`${vista} · giocatori contro nemesi`, 'colonna', 'larghezza', arrotonda(a.colonna), arrotonda(b.colonna));
        provati++;
      }
    }
    NON_PROVABILI.forEach(n => ctx.elenco.push({ schermata: '(tutte)', variabile: n.v, esito: 'non provabile: ' + n.motivo }));
    ctx.misureCarta = carte;
    return `${provati} controlli (${CASI.length} variabili × ${VISTE_PROVA.length} formati × 2 turni, più i controlli fissi), ${assenti} saltati per elemento assente, ${NON_PROVABILI.length} variabili non provabili`;
  }
};
