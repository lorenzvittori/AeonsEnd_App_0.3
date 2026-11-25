// tools/confronto/differenze.mjs: confronto di due risultati di prova (stato della partita in JSON, misure degli elementi
// della pagina) e raccolta delle differenze in una forma leggibile: { prova, schermata, elemento, proprieta, prima, dopo }
// (CONTESTO_SVILUPPO.md sezione 9). "prima" è la versione di riferimento (<ref>), "dopo" quella attuale.
// Dipende da: niente. Usato da: confronta.mjs e prove/*.mjs.

// Tolti i pezzi che dipendono dalla build o dalla porta: indirizzo del server e hash di Vite nei nomi dei file importati dal CSS
const normalizza = t => String(t)
  .replace(/127\.0\.0\.1:\d+/g, 'HOST')
  .replace(/-[A-Za-z0-9_-]{8}\.(png|webp|svg|jpg|jpeg|woff2?|ttf|gif)/g, '.$1');

const corto = (v, n = 90) => { const t = String(v); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

// Appiattisce un valore JSON in { 'a.b[0].c': valore }
function appiattisci(v, prefisso = '', out = {}) {
  if (v !== null && typeof v === 'object') {
    const chiavi = Array.isArray(v) ? v.map((_, i) => i) : Object.keys(v);
    if (!chiavi.length) out[prefisso || '(radice)'] = Array.isArray(v) ? '[]' : '{}';
    for (const k of chiavi) appiattisci(v[k], prefisso ? prefisso + (Array.isArray(v) ? `[${k}]` : '.' + k) : String(k), out);
  } else out[prefisso || '(radice)'] = JSON.stringify(v);
  return out;
}

// Stato: due testi JSON (anche annidati: { stato, vista } scritto come testo). Nessuna differenza → []
export function diffJson(prova, schermata, prima, dopo) {
  if (prima === dopo) return [];
  const pa = appiattisci(JSON.parse(prima));
  const pb = appiattisci(JSON.parse(dopo));
  const out = [];
  for (const k of new Set([...Object.keys(pa), ...Object.keys(pb)])) {
    if (pa[k] !== pb[k]) out.push({ prova, schermata, elemento: 'stato', proprieta: k, prima: corto(pa[k] ?? '(assente)'), dopo: corto(pb[k] ?? '(assente)') });
  }
  return out;
}

// Misure di C.misura() delle due build. Nessuna differenza → []
export function diffMisure(prova, schermata, prima, dopo) {
  const out = [];
  const push = (elemento, proprieta, a, b) => out.push({ prova, schermata, elemento, proprieta, prima: corto(a), dopo: corto(b) });
  if (prima.assente !== dopo.assente) push('(pagina)', 'radice', prima.assente ?? 'presente', dopo.assente ?? 'presente');
  if (prima.viewport.join('x') !== dopo.viewport.join('x')) push('(pagina)', 'viewport', prima.viewport.join('x'), dopo.viewport.join('x'));
  const nomi = prima.nomi.length ? prima.nomi : dopo.nomi;
  const confrontaValori = (el, ea, eb, suffisso) => {
    if (ea === eb) return;
    const va = ea.split('\u0001');
    const vb = eb.split('\u0001');
    nomi.forEach((n, i) => { if (normalizza(va[i]) !== normalizza(vb[i])) push(el + suffisso, n, va[i], vb[i]); });
  };
  for (const k of new Set([...Object.keys(prima.voci), ...Object.keys(dopo.voci)])) {
    const a = prima.voci[k];
    const b = dopo.voci[k];
    if (!a || !b) { push((a || b).l, '(elemento)', a ? 'presente' : 'assente', b ? 'presente' : 'assente'); continue; }
    if (a.r !== b.r) {
      const ra = a.r.split(',');
      const rb = b.r.split(',');
      ['x', 'y', 'larghezza', 'altezza'].forEach((n, i) => { if (ra[i] !== rb[i]) push(a.l, 'posizione ' + n, ra[i], rb[i]); });
    }
    if (a.t !== b.t) push(a.l, 'testo', a.t, b.t);
    for (const n of new Set([...Object.keys(a.a), ...Object.keys(b.a)])) {
      if (normalizza(a.a[n] ?? '(assente)') !== normalizza(b.a[n] ?? '(assente)')) push(a.l, '@' + n, a.a[n] ?? '(assente)', b.a[n] ?? '(assente)');
    }
    confrontaValori(a.l, a.v, b.v, '');
    for (const ps of new Set([...Object.keys(a.p || {}), ...Object.keys(b.p || {})])) {
      const pa = (a.p || {})[ps];
      const pb = (b.p || {})[ps];
      if (pa === undefined || pb === undefined) push(a.l + ps, '(pseudo-elemento)', pa === undefined ? 'assente' : 'presente', pb === undefined ? 'assente' : 'presente');
      else confrontaValori(a.l, pa, pb, ps);
    }
  }
  return out;
}

// Errori dell'app: quelli solo nella versione attuale sono una differenza; quelli in entrambe sono rumore di base
export function diffErrori(prova, schermata, prima, dopo) {
  const contaPrima = new Map();
  prima.forEach(e => contaPrima.set(e, (contaPrima.get(e) || 0) + 1));
  const out = [];
  for (const e of dopo) {
    if (contaPrima.get(e)) contaPrima.set(e, contaPrima.get(e) - 1);
    else out.push({ prova, schermata, elemento: 'console', proprieta: 'errore', prima: '(assente)', dopo: corto(e, 200) });
  }
  return out;
}

// Testo (pagine di misure): righe a confronto, nello stesso ordine. Nessuna differenza → []
export function diffTesto(prova, schermata, prima, dopo) {
  if (prima === dopo) return [];
  const la = prima.split('\n');
  const lb = dopo.split('\n');
  const out = [];
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) {
      // Etichetta: la prima parola della riga (nome del box) per leggere dove sta la differenza
      const nome = String(la[i] ?? lb[i] ?? '').split(/\s{2,}|\t/)[0].slice(0, 40);
      out.push({ prova, schermata, elemento: `riga ${i + 1}: ${nome}`, proprieta: 'testo', prima: corto(la[i] ?? '(assente)'), dopo: corto(lb[i] ?? '(assente)') });
    }
  }
  return out;
}

// Le differenze della vista (momento, pulsante, fase: "vista.*") non fermano una partita: quelle dello stato sì. `visti` è
// l'insieme (uno per partita) delle differenze di vista già riportate, per non ripeterle a ogni passo
export const eStato = d => !d.proprieta.startsWith('vista.');
export function nuove(visti, differenze) {
  return differenze.filter(d => {
    if (eStato(d)) return true;
    const k = d.proprieta + '|' + d.prima + '|' + d.dopo;
    if (visti.has(k)) return false;
    visti.add(k);
    return true;
  });
}