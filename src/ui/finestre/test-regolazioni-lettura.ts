// ui/finestre/test-regolazioni-lettura.ts: la parte PURA del pannello "Regolazioni" della Modalità test: legge i colori
// base di stili/palette.css e le misure di ui/schermate/partita-misure.css dai file CSS stessi (importati come testo con
// ?raw: è il solo modulo di src/ a poterlo fare, tools/check-moduli.mjs), così etichette e gruppi si scrivono una volta
// sola, nei commenti dei CSS. Nessun DOM, nessuno stato: si prova in tests/regolazioni.test.ts.
// Formato letto (una dichiarazione per riga, il commento a destra è l'etichetta, un commento
// "--- titolo ---" da solo su una riga apre un gruppo):
//   --- 1 testata ---
//   --testata-altezza: 58px;     (commento: altezza minima della testata)
// Dei colori si leggono le variabili --colore-* con valore #rrggbb o #rrggbbaa; delle misure quelle con un numero e
// un'unità (px, %...) o senza unità; le altre (calc()...) non si regolano.
// Livello 4 (ui/finestre/), file di supporto di test.ts. Dipende da: i due file CSS (?raw). Usato da: test-regolazioni.ts e,
// fuori dall'app, dalla pagina scheletri/ (MISURE, DISEGNI).

import paletteTesto from '../../stili/palette.css?raw';
import misureTesto from '../schermate/partita-misure.css?raw';

// File in cui vanno le variabili cambiate (per il testo che si copia)
export const FILE_PALETTE = 'src/stili/palette.css';
export const FILE_MISURE = 'src/ui/schermate/partita-misure.css';

export interface ColoreBase {
  nome: string;          // --colore-oro
  valore: string;        // #dfae59 oppure #040508d1 (con trasparenza)
  etichetta: string;     // il commento a destra
  trasparente: boolean;  // il valore ha 8 cifre (un'opacità sua)
}

export interface Misura {
  nome: string;          // --testata-altezza
  valore: string;        // 58px
  numero: number;
  unita: string;         // px, %, o '' (numero puro)
  etichetta: string;
}

export interface Gruppo<T> {
  titolo: string;
  voci: T[];
}

const RIGA_GRUPPO = /^\s*\/\*\s*---\s*(.+?)\s*---\s*\*\/\s*$/;
const RIGA_DICHIARAZIONE = /^\s*(--[\w-]+)\s*:\s*([^;]+?)\s*;\s*(?:\/\*\s*(.*?)\s*\*\/)?\s*$/;
const COLORE = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;
const NUMERO_UNITA = /^(-?\d*\.?\d+)(px|%|em|rem|vh|vw|dvh|svh|lvh|vmin|vmax|ms|s)?$/;

// Righe di un CSS lette come gruppi di dichiarazioni (nome, valore, commento). I gruppi senza titolo (prima del primo)
// prendono il titolo vuoto.
function dichiarazioni(testo: string): Gruppo<{ nome: string; valore: string; commento: string }>[] {
  const gruppi: Gruppo<{ nome: string; valore: string; commento: string }>[] = [];
  let corrente: Gruppo<{ nome: string; valore: string; commento: string }> | null = null;
  for (const riga of testo.split(/\r?\n/)) {
    const g = riga.match(RIGA_GRUPPO);
    if (g) { corrente = { titolo: g[1], voci: [] }; gruppi.push(corrente); continue; }
    const d = riga.match(RIGA_DICHIARAZIONE);
    if (!d) continue;
    if (!corrente) { corrente = { titolo: '', voci: [] }; gruppi.push(corrente); }
    corrente.voci.push({ nome: d[1], valore: d[2], commento: d[3] ?? '' });
  }
  return gruppi;
}

// I colori base (--colore-*) di palette.css, per gruppo
export function leggiColori(testo: string): Gruppo<ColoreBase>[] {
  return dichiarazioni(testo)
    .map(g => ({
      titolo: g.titolo,
      voci: g.voci.filter(v => v.nome.startsWith('--colore-') && COLORE.test(v.valore)).map(v => ({
        nome: v.nome, valore: v.valore.toLowerCase(), etichetta: v.commento || v.nome, trasparente: v.valore.length === 9 }))
    }))
    .filter(g => g.voci.length > 0);
}

// Le misure regolabili di partita-misure.css, per gruppo (le zone 1-7 e le carte)
export function leggiMisure(testo: string): Gruppo<Misura>[] {
  return dichiarazioni(testo)
    .map(g => ({
      titolo: g.titolo,
      voci: g.voci.flatMap(v => {
        const m = v.valore.match(NUMERO_UNITA);
        return m ? [{ nome: v.nome, valore: v.valore, numero: parseFloat(m[1]), unita: m[2] ?? '', etichetta: v.commento || v.nome }] : [];
      })
    }))
    .filter(g => g.voci.length > 0);
}

// I disegni delle zone: il commento di più righe che segue "/* --- titolo --- */" (per titolo). Serve alla pagina scheletri/
// (scheletri/scheletri.ts), che mostra a ogni zona il disegno scritto nel file; il pannello non lo usa. Il testo è quello del
// commento senza "/*" e "*/", spostato a sinistra quanto basta (l'allineamento delle righe resta).
export function leggiDisegni(testo: string): Record<string, string> {
  const out: Record<string, string> = {};
  let titolo: string | null = null;
  let righe: string[] | null = null;
  const chiudi = () => {
    if (!righe || titolo === null) return;
    righe[0] = righe[0].replace('/*', '  ');
    righe[righe.length - 1] = righe[righe.length - 1].replace(/\s*\*\/\s*$/, '');
    const pieni = righe.filter(r => r.trim() !== '');
    const rientro = Math.min(...pieni.map(r => r.length - r.trimStart().length));
    out[titolo] = righe.map(r => r.slice(rientro).replace(/\s+$/, '')).join('\n').replace(/^\n+|\n+$/g, '');
    righe = null;
    titolo = null;
  };
  for (const riga of testo.split(/\r?\n/)) {
    if (righe) { righe.push(riga); if (riga.includes('*/')) chiudi(); continue; }
    const g = riga.match(RIGA_GRUPPO);
    if (g) { titolo = g[1]; continue; }
    if (titolo === null || riga.trim() === '') continue;
    if (/^\s*\/\*/.test(riga)) { righe = [riga]; if (riga.includes('*/')) chiudi(); } else titolo = null;
  }
  return out;
}

// Quello che legge il pannello: i file veri
export const COLORI: Gruppo<ColoreBase>[] = leggiColori(paletteTesto);
export const MISURE: Gruppo<Misura>[] = leggiMisure(misureTesto);
export const DISEGNI: Record<string, string> = leggiDisegni(misureTesto);

// Valori predefiniti (quelli scritti nei CSS), per nome
export function predefiniti(colori: Gruppo<ColoreBase>[], misure: Gruppo<Misura>[]): Record<string, string> {
  const out: Record<string, string> = {};
  colori.forEach(g => g.voci.forEach(v => { out[v.nome] = v.valore; }));
  misure.forEach(g => g.voci.forEach(v => { out[v.nome] = v.valore; }));
  return out;
}

// Un colore #rrggbb[aa] diviso nel colore (per input type=color) e nell'opacità da 0 a 1 (null se non ce l'ha)
export function dividiColore(valore: string): { hex: string; opacita: number | null } {
  const v = valore.toLowerCase();
  if (v.length === 9) return { hex: v.slice(0, 7), opacita: parseInt(v.slice(7, 9), 16) / 255 };
  return { hex: v.slice(0, 7), opacita: null };
}

// Il contrario: colore e opacità (null = senza trasparenza) in un valore #rrggbb o #rrggbbaa
export function componiColore(hex: string, opacita: number | null): string {
  const base = hex.toLowerCase().slice(0, 7);
  if (opacita === null) return base;
  const a = Math.round(Math.max(0, Math.min(1, opacita)) * 255);
  return base + a.toString(16).padStart(2, '0');
}

// Il valore di una misura: numero senza decimali di troppo + unità
export function componiMisura(numero: number, unita: string): string {
  return `${Math.round(numero * 1000) / 1000}${unita}`;
}

// Due valori uguali? I colori si confrontano senza badare alle maiuscole, le misure come numeri
export function valoriUguali(a: string, b: string): boolean {
  if (a.toLowerCase() === b.toLowerCase()) return true;
  const ma = a.match(NUMERO_UNITA);
  const mb = b.match(NUMERO_UNITA);
  return !!ma && !!mb && ma[2] === mb[2] && parseFloat(ma[1]) === parseFloat(mb[1]);
}

// Le regolazioni salvate (testo letto dal browser, possibilmente rovinato): restano solo i nomi che esistono e i valori
// scritti come quelli dei CSS (stesso tipo, stessa unità)
export function regolazioniValide(salvate: unknown, base: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  if (!salvate || typeof salvate !== 'object' || Array.isArray(salvate)) return out;
  for (const [nome, valore] of Object.entries(salvate)) {
    const predefinito = base[nome];
    if (predefinito === undefined || typeof valore !== 'string') continue;
    if (COLORE.test(predefinito)) {
      if (COLORE.test(valore) && valore.length === predefinito.length) out[nome] = valore.toLowerCase();
    } else {
      const m = valore.match(NUMERO_UNITA);
      const p = predefinito.match(NUMERO_UNITA);
      if (m && p && (m[2] ?? '') === (p[2] ?? '')) out[nome] = valore;
    }
  }
  return out;
}

// Il testo CSS delle sole variabili cambiate, pronto da incollare, con il file in cui va ogni gruppo (nell'ordine in cui
// stanno nei CSS)
export function testoCopia(cambiate: Record<string, string>, colori: Gruppo<ColoreBase>[], misure: Gruppo<Misura>[]): string {
  const blocchi: string[] = [];
  const dei = (gruppi: Gruppo<{ nome: string }>[], file: string, nota: string) => {
    const righe = gruppi.flatMap(g => g.voci.filter(v => v.nome in cambiate).map(v => `  ${v.nome}: ${cambiate[v.nome]};`));
    if (righe.length) blocchi.push(`/* ${file}: ${nota} */\n:root {\n${righe.join('\n')}\n}`);
  };
  dei(colori, FILE_PALETTE, 'cambia il valore delle righe con questi nomi');
  dei(misure, FILE_MISURE, 'cambia il valore delle righe con questi nomi');
  return blocchi.join('\n\n');
}
