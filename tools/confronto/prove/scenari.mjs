// tools/confronto/prove/scenari.mjs: prova "scenari" (strumento di confronto, tools/confronto/README.md). Ogni scenario della
// Modalità test (app.SCENARI) parte nelle due build e si gioca per qualche azione; dopo ogni passo si confronta lo stato
// (snapshot completo) e la vista (momento, pulsante principale, fase).
// Dipende da: browser.mjs, differenze.mjs, dati/scenari.mjs. Usato da: confronta.mjs.

import { coppia } from '../browser.mjs';
import { diffErrori, diffJson, eStato, nuove } from '../differenze.mjs';
import { PASSI_SCENARIO, SEME } from '../dati/scenari.mjs';

// Gioca `passi` azioni nelle due pagine (che hanno già lo stesso stato) confrontando dopo ognuna. Restituisce i passi fatti
export async function giocaInsieme(ctx, a, b, prova, nome, passi, visti = new Set()) {
  let fatti = 0;
  for (let i = 0; i < passi; i++) {
    if (await a.c('finita')) break;
    const r = [];
    for (const pg of [a, b]) {
      await pg.c('seme', SEME + i);
      await pg.ora(60000 + 1000 * i);
      const az = await pg.c('passo', i);
      await pg.assesta(400);
      r.push({ az, reg: await pg.c('registro') });
    }
    fatti++;
    const d = diffJson(prova, `${nome}: passo ${i} (${r[0].az})`, r[0].reg, r[1].reg);
    ctx.reg(nuove(visti, d));
    if (d.some(eStato)) break;
  }
  return fatti;
}

export default {
  nome: 'scenari',
  async esegui(ctx) {
    const { a, b, chiudi } = await coppia(ctx.browser, ctx.builds, { vista: 'tel' });
    let passi = 0;
    let n = 0;
    try {
      const idsA = await a.js('return app.SCENARI.map(s => s.id)');
      const idsB = await b.js('return app.SCENARI.map(s => s.id)');
      if (idsA.join() !== idsB.join()) ctx.reg([{ prova: 'scenari', schermata: 'elenco', elemento: 'SCENARI', proprieta: 'id', prima: idsA.join(','), dopo: idsB.join(',') }]);
      for (const id of idsA.filter(i => idsB.includes(i))) {
        n++;
        try {
          for (const pg of [a, b]) {
            await pg.c('seme', SEME);
            await pg.ora(0);
            await pg.passo(['scenario', id]);
          }
          const visti = new Set();
          const d0 = diffJson('scenari', `${id}: inizio`, await a.c('registro'), await b.c('registro'));
          ctx.reg(nuove(visti, d0));
          if (d0.some(eStato)) continue;
          passi += await giocaInsieme(ctx, a, b, 'scenari', id, PASSI_SCENARIO, visti);
        } catch (err) {
          ctx.reg([{ prova: 'scenari', schermata: id, elemento: '(prova)', proprieta: 'errore', prima: '', dopo: String(err.message || err).split('\n')[0] }]);
        }
      }
      ctx.reg(diffErrori('console', 'scenari', a.errori, b.errori));
    } finally { await chiudi(); }
    return `${n} scenari, ${passi} passi`;
  }
};
