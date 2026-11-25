// tools/confronto/prove/indietro.mjs: prova "indietro" (strumento di confronto, tools/confronto/README.md). Percorre il giro di
// dati/indietro.mjs (menu → Nuova partita → Crea mazzo → partita → finestre una sull'altra → Indietro fino al menu) nelle due
// build, a telefono e su desktop; a ogni ['reg', nome] confronta dove si è: schermata, finestre aperte, livelli sopra la
// pagina (collezioni, scarti, pagina iniziale), messaggio "premi di nuovo Indietro".
// Dipende da: browser.mjs, differenze.mjs, dati/indietro.mjs. Usato da: confronta.mjs.

import { coppia } from '../browser.mjs';
import { diffErrori, diffJson } from '../differenze.mjs';
import { GIRO_INDIETRO } from '../dati/indietro.mjs';

const REGISTRO = `return JSON.stringify({ schermata: app.schermataAttuale(), finestre: app.modals.length, schermiCollezione: document.querySelectorAll('.collection-screen').length,
  scarti: !app.discardLayer.hidden, paginaIniziale: !app.startLayer.hidden, annullaSospeso: !!app.undoFloat, pescaCarta: !!app.deckPopover,
  messaggio: (document.getElementById('toast-root').textContent || '').trim(), cronologia: !!(history.state && history.state.aeBackGuard) })`;

export default {
  nome: 'indietro',
  async esegui(ctx) {
    let registri = 0;
    for (const vista of ['tel', 'desk']) {
      const { a, b, chiudi } = await coppia(ctx.browser, ctx.builds, { vista });
      try {
        let cosa = 'inizio';
        let fermo = false;
        for (const p of GIRO_INDIETRO) {
          if (fermo) break;
          if (p[0] === 'reg') {
            cosa = p[1];
            const [ra, rb] = [await a.js(REGISTRO), await b.js(REGISTRO)];
            registri++;
            ctx.elenco.push({ schermata: `${p[1]} · ${vista}`, vista: JSON.parse(ra) });
            const d = diffJson('indietro', `${p[1]} · ${vista}`, ra, rb);
            if (d.length) ctx.reg(d);
            continue;
          }
          await Promise.all([a, b].map(async pg => {
            try { await pg.passo(p); } catch (err) {
              fermo = true;
              ctx.reg([{ prova: 'indietro', schermata: `dopo "${cosa}" · ${vista}`, elemento: '(passo)', proprieta: 'errore in ' + pg.build.nome, prima: '', dopo: String(err.message || err).split('\n')[0] }]);
            }
          }));
        }
        ctx.reg(diffErrori('console', 'indietro: ' + vista, a.errori, b.errori));
      } finally { await chiudi(); }
    }
    return `${registri} controlli del giro`;
  }
};

