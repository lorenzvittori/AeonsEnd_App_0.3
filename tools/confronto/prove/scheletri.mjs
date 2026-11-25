// tools/confronto/prove/scheletri.mjs: prova "scheletri" (strumento di confronto, CONTESTO_SVILUPPO.md sezione 9). Apre la pagina
// public/scheletri/ delle due build: la pagina misura da sola l'app vera (in un iframe) nei 4 formati dello schermo (18:9,
// 19:9, 19.5:9, 20:9) e disegna box, spazi e tabelle. Per ogni formato, in px e in mm, si confronta il testo della pagina
// (nomi, misure dei box e spazi verticali); si confronta anche il file misure.json (le misure salvate).
// Dipende da: browser.mjs, differenze.mjs. Usato da: confronta.mjs.

import { apri } from '../browser.mjs';
import { diffErrori, diffTesto } from '../differenze.mjs';

const FORMATI = ['18:9', '19:9', '19.5:9', '20:9'];
const UNITA = ['px', 'mm'];

async function leggi(pg, formato, unita) {
  await pg.page.getByRole('button', { name: formato, exact: true }).click({ force: true });
  await pg.page.getByRole('button', { name: unita, exact: true }).click({ force: true });
  await pg.assesta(200);
  return pg.js(`return [document.querySelector('.stato').textContent.trim(), document.querySelector('.formato').innerText].join('\\n')`);
}

export default {
  nome: 'scheletri',
  async esegui(ctx) {
    const opz = { vista: 'desk', percorso: 'scheletri/', pronta: `!!document.querySelector('.stato.is-live, .stato.is-error')`, avanza: 500 };
    const [a, b] = await Promise.all(ctx.builds.map(bd => apri(ctx.browser, bd, opz)));
    let n = 0;
    try {
      for (const f of FORMATI) {
        for (const u of UNITA) {
          const [ta, tb] = [await leggi(a, f, u), await leggi(b, f, u)];
          n++;
          ctx.reg(diffTesto('scheletri', `${f} in ${u}`, ta, tb));
        }
      }
      const json = pg => pg.page.evaluate(async () => (await fetch('misure.json')).text());
      const [ja, jb] = [await json(a), await json(b)];
      ctx.reg(diffTesto('scheletri', 'misure.json', ja, jb));
      ctx.reg(diffErrori('console', 'scheletri', a.errori, b.errori));
    } finally { await a.chiudi(); await b.chiudi(); }
    return `${n} formati×unità, misure.json`;
  }
};
