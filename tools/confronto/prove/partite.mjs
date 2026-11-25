// tools/confronto/prove/partite.mjs: prova "partite" (strumento di confronto, tools/confronto/README.md). Ogni partita di
// dati/partite.mjs si gioca come sequenza di azioni (le stesse del modulo della partita) nelle due build, con Undo e ripresa a
// metà; dopo ogni passo si confronta lo stato (snapshot completo, compreso l'undo) e la vista (momento, pulsante, fase).
// Dipende da: browser.mjs, differenze.mjs, dati/partite.mjs. Usato da: confronta.mjs.

import { coppia } from '../browser.mjs';
import { diffErrori, diffJson, eStato, nuove } from '../differenze.mjs';
import { PARTITE } from '../dati/partite.mjs';

// Dalla pagina Nuova partita con i clic veri, fino al turno giocatori con il mazzo fatto
export async function avviaDaInterfaccia(pg, { nemesi, giocatori, onda }) {
  await pg.js('__c.collezioneCompleta()');
  await pg.clic('.start-home-new');
  if (onda) {
    await pg.clic('.wave-dropdown-toggle');
    const opzioni = pg.page.locator('.wave-option');
    await opzioni.filter({ hasText: new RegExp('^\\s*' + onda + ' - ') }).first().click({ force: true });
    await opzioni.filter({ hasText: /^\s*I - / }).first().click({ force: true });
    await pg.page.keyboard.press('Escape');
    await pg.assesta(300);
  }
  await pg.page.locator('.nemesis-item').filter({ hasText: nemesi }).first().click({ force: true });
  await pg.assesta(300);
  await pg.page.locator('#choices-players *', { hasText: new RegExp('^\\s*' + giocatori + '\\s*$') }).first().click({ force: true });
  await pg.clic('#start-btn');
  await pg.assesta(1500);
  // Crea mazzo: il pulsante è il cursore da trascinare; qui si lancia direttamente la creazione che parte a fine trascinamento
  await pg.js('app.runDeckBuild()');
  await pg.assesta(8000);
  if (await pg.js('return app.ui.deckBuilding')) throw new Error('il mazzo non è stato creato (Crea mazzo)');
}

async function avvia(pg, p) {
  await pg.c('seme', p.seme);
  if (p.via === 'ui') await avviaDaInterfaccia(pg, p);
  else await pg.c('avviaApi', p.giocatori, p.nemesi);
  await pg.assesta(500);
}

// Un passo nella pagina: restituisce { az, reg } (nome dell'azione e registro dopo il passo)
async function esegui(pg, azione, i, seme) {
  await pg.c('seme', seme + i);
  await pg.ora(60000 + 1000 * i);
  let az = azione;
  if (azione === 'undo') await pg.c('undo');
  else if (azione === 'ripresa') {
    await pg.page.reload({ waitUntil: 'load' });
    await pg.carica();
    await pg.clic('button:has-text("Riprendi partita")');
    await pg.assesta(1500);
  } else az = await pg.c('passo', i);
  await pg.assesta(400);
  return { az, reg: await pg.c('registro') };
}

export default {
  nome: 'partite',
  async esegui(ctx) {
    let passi = 0;
    for (const p of PARTITE) {
      const { a, b, chiudi } = await coppia(ctx.browser, ctx.builds, { vista: 'tel' });
      try {
        await Promise.all([avvia(a, p), avvia(b, p)]);
        let diverge = false;
        // Lo stesso passo nelle due pagine e confronto
        const passo = async (azione, i) => {
          const ra = await esegui(a, azione, i, p.seme);
          const rb = await esegui(b, azione, i, p.seme);
          passi++;
          const d = diffJson('partite', `${p.id}: passo ${i} (${ra.az})`, ra.reg, rb.reg);
          ctx.reg(nuove(visti, d));
          if (d.some(eStato)) diverge = true;
        };
        const visti = new Set();
        const d0 = diffJson('partite', `${p.id}: inizio`, await a.c('registro'), await b.c('registro'));
        ctx.reg(nuove(visti, d0));
        if (!d0.some(eStato)) {
          let ripresaFatta = false;
          for (let i = 0; !diverge && i < p.passi + 80; i++) {
            if (await a.c('finita')) break;
            if (i >= p.passi && await a.c('inTurnoGiocatori')) break;
            await passo('passo', i);
            for (let n = 0; n < p.undo.filter(u => u === i).length && !diverge; n++) await passo('undo', i);
            if (!ripresaFatta && i >= p.ripresa && !diverge && await a.c('inTurnoGiocatori')) {
              ripresaFatta = true;
              await passo('ripresa', i);
            }
          }
        }
        ctx.reg(diffErrori('console', 'partite: ' + p.id, a.errori, b.errori));
      } catch (err) {
        ctx.reg([{ prova: 'partite', schermata: p.id, elemento: '(prova)', proprieta: 'errore', prima: '', dopo: String(err.message || err).split('\n')[0] }]);
      } finally {
        await chiudi();
      }
    }
    return `${PARTITE.length} partite, ${passi} passi`;
  }
};


