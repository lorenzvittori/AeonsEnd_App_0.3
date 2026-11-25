// tools/confronto/prove/lingua.mjs: prova "lingua" (strumento di confronto, CONTESTO_SVILUPPO.md sezione 9). Non confronta due
// build: apre la versione attuale due volte, in italiano e in inglese (la scelta salvata), percorre le schermate di
// dati/schermate.mjs più qualche finestra in più (dati/lingua.mjs) a telefono (375x812) e a desktop (1280x800), e riapre i
// salvataggi di tools/confronto/salvataggi nelle due lingue (stessa partita ripresa); per ogni schermata segnala, in inglese:
//   - testo che esce dal suo box (scrollWidth > clientWidth) o dallo schermo, dove in italiano non esce;
//   - testo di un pulsante su più righe dove in italiano ne ha di meno;
//   - un testo vuoto dove in italiano c'è (chiave senza testo);
//   - "undefined", "NaN", "[object", "null" visibili (testi e aria-label, title, alt, placeholder).
// Gli stessi controlli, per i testi brutti, valgono anche per l'italiano. Passi come in dati/schermate.mjs.
// Dipende da: browser.mjs, dati/schermate.mjs, dati/lingua.mjs, dati/scenari.mjs. Usato da: confronta.mjs.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { apri } from '../browser.mjs';
import { diffErrori } from '../differenze.mjs';
import { GIRO } from '../dati/schermate.mjs';
import { PIU } from '../dati/lingua.mjs';
import { SEME } from '../dati/scenari.mjs';

const ITALIANO = /[àèéìòù]|\b(carta|carte|turno|turni|nemesi|giocatore|giocatori|mazzo|partita|vita|scarti|annulla|chiudi|esci|salva|vittoria|sconfitta|pesca|impostazioni|opzioni|riprova|riprendi|nessuna|nessun|gioco)\b/i;

const SALVATAGGI = join(import.meta.dirname, '..', 'salvataggi');
const RIPRENDI = { it: 'Riprendi partita', en: 'Resume game' };
const CONTINUA = { it: 'Continua', en: 'Continue' };

const VISTE = [{ id: 'telefono 375x812', vista: 'tel' }, { id: 'desktop 1280x800', vista: 'desk' }];

// Le differenze tra la pagina italiana (it) e quella inglese (en) misurate con window.__c.lingua()
export function confrontaLingue(schermata, it, en) {
  const out = [];
  const segna = (chiave, v, proprieta, prima, dopo) => out.push({ prova: 'lingua', schermata, elemento: v.l, proprieta, prima, dopo });
  for (const [chiave, v] of Object.entries(en.voci)) {
    const i = it.voci[chiave];
    if (v.esce && !(i && i.esce)) segna(chiave, v, 'esce dal box', i ? (i.t || '(senza testo)') : '(non c\'è in italiano)', `${v.t}  [${v.esce}]`);
    if (v.fuori && !(i && i.fuori)) segna(chiave, v, 'fuori dallo schermo', i ? i.t : '', `${v.t}  [${v.fuori}]`);
    if (v.bottone && i && i.righe !== undefined && v.righe > i.righe) segna(chiave, v, 'pulsante su più righe', `${i.t} (${i.righe})`, `${v.t} (${v.righe})`);
    if (i && i.t && !v.t) segna(chiave, v, 'testo vuoto', i.t, '(vuoto)');
    // Testo italiano rimasto nella pagina inglese (parole comuni dell'interfaccia e lettere accentate)
    // (Eccezione: nel pannello Regolazioni della Modalità test nomi e gruppi vengono dai commenti dei CSS, in italiano)
    if (!v.l.includes('.ae-regolazioni')) for (const testo of [v.t, ...Object.values(v.a)]) if (ITALIANO.test(testo || '')) segna(chiave, v, 'testo italiano in inglese', i ? i.t : '', testo);
    if (i) for (const [n, valore] of Object.entries(i.a)) {
      if (valore && !(v.a[n] || '').trim()) segna(chiave, v, n + ' vuoto', valore, '(vuoto)');
    }
  }
  for (const [lingua, pg] of [['it', it], ['en', en]]) pg.brutti.forEach(b => out.push({ prova: 'lingua', schermata, elemento: b.split(':')[0], proprieta: `testo sbagliato (${lingua})`, prima: '', dopo: b }));
  return out;
}

export default {
  nome: 'lingua',
  async esegui(ctx) {
    const build = ctx.builds[ctx.builds.length - 1];
    let misure = 0;
    for (const { id, vista } of VISTE) {
      const [it, en] = await Promise.all([apri(ctx.browser, build, { vista, lingua: 'it' }), apri(ctx.browser, build, { vista, lingua: 'en' })]);
      try {
        const voci = [...GIRO, ...PIU];
        for (const [k, voce] of voci.entries()) {
          const nome = `${voce.id} · ${id}`;
          let ok = true;
          await Promise.all([it, en].map(async pg => {
            try {
              await pg.c('seme', SEME + k);
              await pg.ora(0);
              await pg.passi(voce.passi);
            } catch (err) {
              ok = false;
              ctx.reg([{ prova: 'lingua', schermata: nome, elemento: '(passi)', proprieta: 'errore in ' + (pg === it ? 'italiano' : 'inglese'), prima: '', dopo: String(err.message || err).split('\n')[0] }]);
            }
          }));
          if (!ok) continue;
          await Promise.all([it, en].map(pg => pg.stabilizza()));
          const [a, b] = await Promise.all([it.page.evaluate(() => window.__c.lingua()), en.page.evaluate(() => window.__c.lingua())]);
          misure++;
          ctx.reg(confrontaLingue(nome, a, b));
          ctx.elenco.push({ schermata: nome, vista: id, elementi: Object.keys(b.voci).length });
        }
        ctx.reg(diffErrori('console', 'lingua: ' + id, it.errori, en.errori));
      } finally { await it.chiudi(); await en.chiudi(); }
    }
    // I salvataggi di tools/confronto/salvataggi si riaprono nelle due lingue: stessa partita ripresa, nessun errore, e la schermata
    // della partita ripresa passa gli stessi controlli di testo
    const file = readdirSync(SALVATAGGI).filter(f => f.endsWith('.json')).sort();
    for (const f of file) {
      const testo = readFileSync(join(SALVATAGGI, f), 'utf8');
      const [it, en] = await Promise.all(['it', 'en'].map(lingua => apri(ctx.browser, build, { vista: 'tel', salvataggio: testo, lingua })));
      try {
        await Promise.all([[it, 'it'], [en, 'en']].map(async ([pg, l]) => {
          await pg.c('seme', SEME);
          await pg.ora(0);
          await pg.clic(`button:has-text(${JSON.stringify(RIPRENDI[l])})`);
          await pg.assesta(1500);
          const continua = pg.page.locator(`button:has-text(${JSON.stringify(CONTINUA[l])})`);
          if (await continua.count() && await continua.first().isVisible()) { await continua.first().click({ force: true }); await pg.assesta(1500); }
        }));
        for (const pg of [it, en]) if (await pg.js('return !app.startLayer.hidden')) throw new Error('ripresa non riuscita in ' + pg.opz.lingua);
        const [sa, sb] = await Promise.all([it, en].map(pg => pg.js('return JSON.stringify(app.snapshot())')));
        if (sa !== sb) ctx.reg([{ prova: 'lingua', schermata: 'salvataggio ' + f, elemento: 'stato ripreso', proprieta: 'diverso tra italiano e inglese', prima: sa.slice(0, 80), dopo: sb.slice(0, 80) }]);
        await Promise.all([it, en].map(pg => pg.stabilizza()));
        const [a, b] = await Promise.all([it.page.evaluate(() => window.__c.lingua()), en.page.evaluate(() => window.__c.lingua())]);
        misure++;
        ctx.reg(confrontaLingue('salvataggio ' + f + ' ripreso', a, b));
        ctx.reg(diffErrori('console', 'lingua, salvataggio: ' + f, it.errori, en.errori));
      } catch (err) {
        ctx.reg([{ prova: 'lingua', schermata: 'salvataggio ' + f, elemento: '(prova)', proprieta: 'errore', prima: '', dopo: String(err.message || err).split('\n')[0] }]);
      } finally { await it.chiudi(); await en.chiudi(); }
    }
    return `${misure} schermate (compresi ${file.length} salvataggi ripresi), italiano contro inglese`;
  }
};
