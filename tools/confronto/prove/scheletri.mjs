// tools/confronto/prove/scheletri.mjs: prova "scheletri" (strumento di confronto, tools/confronto/README.md). Apre la pagina
// scheletri/ della versione attuale (la seconda pagina di Vite: src/ui/schermate/partita-misure.css zona per zona, con la misura
// vera presa dall'app in un iframe) e, per ogni formato (18:9, 19:9, 19.5:9, 20:9) e turno (giocatori, nemesi), controlla che:
// ogni variabile del file ci sia (una riga), tutte abbiano una misura o un motivo, ogni differenza sia 0 o spiegata (diffSpiegata
// o nonUguale in dati/misure.mjs), e l'app nell'iframe non dia errori. Se anche la versione di confronto ha la pagina nuova,
// confronta il testo della pagina (le due versioni devono dire le stesse misure). Non confronta con la pagina vecchia
// (public/scheletri/, tolta): lo strumento dice "pagina nuova" e basta.
// Dipende da: browser.mjs, differenze.mjs. Usato da: confronta.mjs.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { apri } from '../browser.mjs';
import { diffTesto } from '../differenze.mjs';

const FORMATI = ['18:9', '19:9', '19.5:9', '20:9'];
const TURNI = [['giocatori', 'Turno giocatori'], ['nemesi', 'Turno nemesi']];
const pausa = ms => new Promise(r => setTimeout(r, ms));

// Si aspetta (in tempo vero, facendo avanzare l'orologio finto) che la misura sia finita
async function pronta(pg) {
  for (let i = 0; i < 600; i++) {
    if (await pg.page.evaluate(() => document.body.dataset.misura === 'pronta' || document.body.dataset.misura === 'errore')) return;
    await pg.page.clock.runFor(500);
    await pausa(40);
  }
  throw new Error('la pagina scheletri/ non ha finito di misurare');
}

async function scegli(pg, formato, turno) {
  // Prima si mette "in corso" (il click cambia il dato subito), poi si aspetta la fine
  await pg.page.getByRole('button', { name: formato, exact: true }).click({ force: true });
  await pg.page.getByRole('button', { name: turno, exact: true }).click({ force: true });
  await pronta(pg);
  await pg.assesta(200);
}

// Le righe della pagina: variabile, esito, differenza (numero) e se è spiegata
const RIGHE = () => [...document.querySelectorAll('tr[data-var]')].map(r => ({
  v: r.dataset.var, esito: r.dataset.esito, diff: r.dataset.diff === undefined ? null : Number(r.dataset.diff), spiegata: r.dataset.spiegata === '1'
}));

// Gli oggetti che il disegno deve avere (scheletri/oggetti.ts, id): in tutti i momenti, e solo nel turno giocatori / solo nel nemesi
const OGGETTI_ATTESI = ['testata', 'nome-nemesi', 'riga-turno', 'mazzo', 'scarti', 'menu', 'barra-turni', 'casella', 'scritta-turno', 'carta-piccola', 'stato-piccola',
  'vita-gravehold', 'vita-nemesi', 'scritta-gravehold', 'scritta-nemesis', 'riga-stato', 'goccia', 'numero', 'carta-grande', 'carta-vicina', 'principale'];
const OGGETTI_TURNO = { giocatori: ['comandi', 'comando'], nemesi: [] };

export default {
  nome: 'scheletri',
  async esegui(ctx) {
    const opz = { vista: 'desk', percorso: 'scheletri/', pronta: `!!document.querySelector('.stato.is-live, .stato.is-error')`, avanza: 500 };
    const [a, b] = await Promise.all(ctx.builds.map(bd => apri(ctx.browser, bd, opz)));
    let n = 0;
    let righe = 0;
    const segnala = (schermata, elemento, proprieta, prima, dopo) =>
      ctx.reg([{ prova: 'scheletri', schermata, elemento, proprieta, prima: String(prima), dopo: String(dopo) }]);
    try {
      const nelFile = [...readFileSync(join(import.meta.dirname, '..', '..', '..', 'src', 'ui', 'schermate', 'partita-misure.css'), 'utf8')
        .matchAll(/^\s*(--[\w-]+)\s*:/gm)].map(m => m[1]);
      // Il confronto ha un senso solo se anche la versione di confronto ha la pagina nuova (ha la colonna #zone)
      const [nuovaA, nuovaB] = [await a.page.evaluate(() => !!document.getElementById('zone')), await b.page.evaluate(() => !!document.getElementById('zone'))];
      if (!nuovaB) { ctx.elenco.push({ schermata: 'scheletri', variabile: '(pagina)', esito: 'la pagina scheletri/ non esiste nella pagina attuale' }); return 'pagina attuale non trovata'; }
      for (const f of FORMATI) {
        for (const [t, nomeTurno] of TURNI) {
          const nome = `${f} · ${t}`;
          await scegli(b, f, nomeTurno);
          const dopo = await b.page.evaluate(RIGHE);
          n++;
          if (await b.page.evaluate(() => document.body.dataset.misura) === 'errore') {
            segnala(nome, '(misura dal vivo)', 'stato', 'pronta', await b.page.evaluate(() => document.getElementById('stato').textContent));
            continue;
          }
          const presenti = await b.page.evaluate(() => [...document.querySelectorAll('[data-og]')].map(e => e.dataset.og.replace(/-\d+$/, '')));
          [...OGGETTI_ATTESI, ...OGGETTI_TURNO[t]].filter(o => !presenti.includes(o)).forEach(o => segnala(nome, o, 'oggetto del disegno', 'presente', 'manca'));
          const nomi = dopo.map(r => r.v);
          nelFile.filter(v => !nomi.includes(v)).forEach(v => segnala(nome, v, 'riga', 'una riga', 'manca'));
          nomi.filter((v, i) => nomi.indexOf(v) !== i).forEach(v => segnala(nome, v, 'riga', 'una sola', 'doppia'));
          for (const r of dopo) {
            righe++;
            if (r.esito === 'senza-caso') segnala(nome, r.v, 'misura', 'un caso in dati/misure.mjs o un motivo in NON_PROVABILI', 'nessuno');
            else if (r.esito === 'misurata' && r.diff && !r.spiegata) segnala(nome, r.v, 'differenza (px)', 0, r.diff);
            else if (r.esito === 'assente') ctx.elenco.push({ schermata: nome, variabile: r.v, esito: 'elemento assente in questo momento' });
          }
          if (nuovaA) {
            await scegli(a, f, nomeTurno);
            const testo = pg => pg.js(`return [document.getElementById('stato').textContent.replace(/ v\\d+/, ''), document.getElementById('zone').innerText].join('\\n')`);
            ctx.reg(diffTesto('scheletri', nome, await testo(a), await testo(b)));
          }
        }
      }
      // (net::ERR_FAILED: i caratteri di Google Fonts, che lo strumento blocca: l'app dentro l'iframe li chiede subito; non è un errore dell'app)
      b.errori.filter(e => !/net::ERR_FAILED/.test(e)).forEach(e => ctx.reg([{ prova: 'console', schermata: 'scheletri', elemento: '(errore)', proprieta: 'console', prima: 'nessuno', dopo: e }]));
    } finally { await a.chiudi(); await b.chiudi(); }
    return `${n} formati×turni, ${righe} righe controllate`;
  }
};
