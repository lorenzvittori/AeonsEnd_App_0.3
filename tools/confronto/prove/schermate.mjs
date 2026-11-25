// tools/confronto/prove/schermate.mjs: prova "schermate" (strumento di confronto, tools/confronto/README.md). Percorre il giro
// di dati/schermate.mjs nelle due build, per ogni giro (telefono, desktop, telefono in orizzontale, riduzione del movimento):
// a ogni schermata confronta getComputedStyle (anche ::before/::after), posizione, testo e attributi di tutti gli elementi
// visibili; dopo le schermate con `forza` anche i pulsanti con :hover/:active/:focus forzati.
// Dipende da: browser.mjs, differenze.mjs, dati/schermate.mjs. Usato da: confronta.mjs.

import { coppia, misuraCoppia } from '../browser.mjs';
import { diffErrori, diffMisure } from '../differenze.mjs';
import { GIRI, GIRO } from '../dati/schermate.mjs';
import { SEME } from '../dati/scenari.mjs';

export default {
  nome: 'schermate',
  async esegui(ctx) {
    let misure = 0;
    let forzate = 0;
    const giri = [];
    for (const giro of GIRI) {
      const { a, b, chiudi } = await coppia(ctx.browser, ctx.builds, { vista: giro.vista, ridotto: giro.ridotto });
      let n = 0;
      try {
        for (const [k, voce] of GIRO.entries()) {
          const misurare = giro.tutte || (voce.anche || []).includes(giro.anche);
          const nome = `${voce.id} · ${giro.id}`;
          let ok = true;
          await Promise.all([a, b].map(async pg => {
            try {
              await pg.c('seme', SEME + k);
              await pg.ora(0);
              await pg.passi(voce.passi);
            } catch (err) {
              ok = false;
              ctx.reg([{ prova: 'schermate', schermata: nome, elemento: '(passi)', proprieta: 'errore in ' + pg.build.nome, prima: '', dopo: String(err.message || err).split('\n')[0] }]);
            }
          }));          if (!misurare || !ok) continue;
          const m = await misuraCoppia(a, b, voce.misura || null);
          misure++; n++;
          ctx.elenco.push({ schermata: nome, vista: await a.c('vista'), elementi: Object.keys((await a.misura(null, 'hash')).voci).length });
          if (m) ctx.reg(diffMisure('schermate', nome, m.prima, m.dopo));
          for (const [sel, stati] of voce.forza || []) {
            const f = await misuraCoppia(a, b, sel, stati);
            forzate++;
            if (f) ctx.reg(diffMisure('schermate', `${nome} [${sel}:${stati.join(':')}]`, f.prima, f.dopo));
          }
        }
        ctx.reg(diffErrori('console', 'schermate: ' + giro.id, a.errori, b.errori));
      } finally { await chiudi(); }
      giri.push(`${giro.id}: ${n}`);
    }
    return `${misure} schermate misurate, ${forzate} stati forzati (${giri.join('; ')})`;
  }
};

