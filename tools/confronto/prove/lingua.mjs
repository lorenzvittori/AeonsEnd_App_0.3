// tools/confronto/prove/lingua.mjs: prova "lingua" (strumento di confronto, CONTESTO_SVILUPPO.md sezione 9). Non confronta due
// build: apre la versione attuale due volte, in italiano e in inglese (la scelta salvata), percorre le schermate di
// dati/schermate.mjs più qualche finestra in più (dati/lingua.mjs) a telefono (375x812) e a desktop (1280x800) e per ogni
// schermata segnala, in inglese:
//   - testo che esce dal suo box (scrollWidth > clientWidth) o dallo schermo, dove in italiano non esce;
//   - testo di un pulsante su più righe dove in italiano ne ha di meno;
//   - un testo vuoto dove in italiano c'è (chiave senza testo);
//   - "undefined", "NaN", "[object", "null" visibili (testi e aria-label, title, alt, placeholder).
// Gli stessi controlli, per i testi brutti, valgono anche per l'italiano. Passi come in dati/schermate.mjs.
// Dipende da: browser.mjs, dati/schermate.mjs, dati/lingua.mjs, dati/scenari.mjs. Usato da: confronta.mjs.

import { apri } from '../browser.mjs';
import { diffErrori } from '../differenze.mjs';
import { GIRO } from '../dati/schermate.mjs';
import { PIU } from '../dati/lingua.mjs';
import { SEME } from '../dati/scenari.mjs';

const ITALIANO = /[àèéìòù]|\b(carta|carte|turno|turni|nemesi|giocatore|giocatori|mazzo|partita|vita|scarti|annulla|chiudi|esci|salva|vittoria|sconfitta|pesca|impostazioni|opzioni|riprova|riprendi|nessuna|nessun|gioco)\b/i;

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
    return `${misure} schermate, italiano contro inglese`;
  }
};
