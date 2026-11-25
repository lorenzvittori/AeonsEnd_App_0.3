// tools/confronto/prove/salvataggi.mjs: prova "salvataggi" (strumento di confronto, CONTESTO_SVILUPPO.md sezione 9). Ogni file di
// tools/confronto/salvataggi/*.json (un salvataggio del browser: quello di main v228 dei test e quelli scritti dal sito
// pubblicato) viene messo nel localStorage di una pagina nuova, ripreso con "Riprendi partita" e giocato per qualche passo,
// nelle due build; si confrontano lo stato e la vista dopo la ripresa e dopo ogni passo.
// Dipende da: browser.mjs, differenze.mjs, prove/scenari.mjs, dati/scenari.mjs. Usato da: confronta.mjs.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { coppia } from '../browser.mjs';
import { diffErrori, diffJson, eStato, nuove } from '../differenze.mjs';
import { PASSI_SALVATAGGIO, SEME } from '../dati/scenari.mjs';
import { giocaInsieme } from './scenari.mjs';

const CARTELLA = join(import.meta.dirname, '..', 'salvataggi');

export default {
  nome: 'salvataggi',
  async esegui(ctx) {
    const file = readdirSync(CARTELLA).filter(f => f.endsWith('.json')).sort();
    let passi = 0;
    for (const f of file) {
      const testo = readFileSync(join(CARTELLA, f), 'utf8');
      const { a, b, chiudi } = await coppia(ctx.browser, ctx.builds, { vista: 'tel', salvataggio: testo });
      try {
        for (const pg of [a, b]) {
          await pg.c('seme', SEME);
          await pg.ora(0);
          // La partita salvata può avere una nemesi di una wave non spuntata: la finestra "manca nella collezione" si conferma
          await pg.clic('button:has-text("Riprendi partita")');
          await pg.assesta(1500);
          const continua = pg.page.locator('button:has-text("Continua")');
          if (await continua.count() && await continua.first().isVisible()) { await continua.first().click({ force: true }); await pg.assesta(1500); }
        }
        for (const pg of [a, b]) {
          if (await pg.js('return !app.startLayer.hidden')) throw new Error(`ripresa non riuscita in ${pg.build.nome}`);
        }
        const d0 = diffJson('salvataggi', `${f}: ripresa`, await a.c('registro'), await b.c('registro'));
        const visti = new Set();
        ctx.reg(nuove(visti, d0));
        if (!d0.some(eStato)) passi += await giocaInsieme(ctx, a, b, 'salvataggi', f, PASSI_SALVATAGGIO, visti);
        ctx.reg(diffErrori('console', 'salvataggi: ' + f, a.errori, b.errori));
      } catch (err) {
        ctx.reg([{ prova: 'salvataggi', schermata: f, elemento: '(prova)', proprieta: 'errore', prima: '', dopo: String(err.message || err).split('\n')[0] }]);
      } finally { await chiudi(); }
    }
    return `${file.length} salvataggi, ${passi} passi`;
  }
};
