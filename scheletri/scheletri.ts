// scheletri/scheletri.ts: la pagina scheletri/ (pagina di sviluppo, non una schermata dell'app: seconda pagina di Vite, vite.config.ts).
// Ha la struttura di src/ui/schermate/partita-misure.css: un blocco per zona (nell'ordine del file) con il disegno del commento e,
// per ogni variabile, il nome, il commento, il valore nel file, la misura vera presa dall'app e la differenza. A fianco il disegno
// in scala dello schermo, a livelli accendibili: fasce delle 7 zone, oggetti veri (oggetti.ts, misurati dal vivo), spazi tra gli oggetti (quote);\n// dietro l'app vera alla stessa scala, con un cursore di trasparenza. Una riga o un oggetto toccato (o sfiorato) evidenzia nel disegno la cosa o lo spazio misurato, e il
// contrario. Due turni (giocatori / nemesi) e i formati 18:9-20:9, tutti a 360 px di larghezza.
// La misura dal vivo: l'app vera in un iframe nascosto (app.noSave = true: la partita salvata non cambia), portata nei momenti
// della prova "misure" di tools/confronto (MOMENTI) e misurata con le sue coppie "tra X e Y" (CASI, LEGGI): pagina e prova non
// possono dire cose diverse. Le variabili e i commenti vengono dal file CSS, letto dal lettore del pannello Regolazioni.
// Dipende da: src/ui/finestre/test-regolazioni-lettura.ts, tools/confronto/dati/misure.mjs, oggetti.ts, scheletri.css. Usato da: index.html.

import './scheletri.css';
import { DISEGNI, MISURE } from '../src/ui/finestre/test-regolazioni-lettura.ts';
import type { Misura } from '../src/ui/finestre/test-regolazioni-lettura.ts';
import { CASI, IMPOSTA, LEGGI, MOMENTI, NON_PROVABILI } from '../tools/confronto/dati/misure.mjs';
import type { Bordi, Caso, Lettura } from '../tools/confronto/dati/misure.mjs';
import { OGGETTI } from './oggetti.ts';
import type { OggettoDef } from './oggetti.ts';

type Finestra = Window & typeof globalThis;

const FORMATI = [{ nome: '18:9', h: 720 }, { nome: '19:9', h: 760 }, { nome: '19.5:9', h: 780 }, { nome: '20:9', h: 800 }];
const LARGHEZZA_PX = 360;
const LARGHEZZA_MM = 68;
const MM_PER_PX = LARGHEZZA_MM / LARGHEZZA_PX;
const PX_PER_MM = 96 / 25.4;                       // i mm di CSS
const SCALE = [1, 1.5, 2];
const TURNI: [string, string][] = [['giocatori', 'Turno giocatori'], ['nemesi', 'Turno nemesi']];
// Le 7 zone: data-zona dell'app, nell'ordine della mappa (i gruppi del file si chiamano "1 testata"... "7 pulsante principale")
const ZONE = ['testata', 'turno', 'carte-piccole', 'vite', 'carte-grandi', 'interattivi', 'principale'];
const TOLLERANZA_DIFF = 0.05;

// --- Scelte (si ricordano nel browser) ----------------------------------------------------------------------------
function leggiScelta<T extends string | number>(chiave: string, valide: T[], predefinito: T): T {
  try {
    const s = localStorage.getItem(chiave);
    const trovato = valide.find(v => String(v) === s);
    if (trovato !== undefined) return trovato;
  } catch { /* browser senza memoria: vale il predefinito */ }
  return predefinito;
}
function ricorda(chiave: string, valore: string | number): void {
  try { localStorage.setItem(chiave, String(valore)); } catch { /* niente memoria: la scelta vale solo per ora */ }
}
let formato = leggiScelta('scheletri-formato', FORMATI.map(f => f.nome), FORMATI[0].nome);
let turno = leggiScelta('scheletri-turno', TURNI.map(t => t[0]), 'giocatori');
let unita: 'px' | 'mm' = leggiScelta<'px' | 'mm'>('scheletri-unita', ['px', 'mm'], 'px');
let scala = leggiScelta('scheletri-scala', SCALE, 1);
// I livelli del disegno (si accendono e si spengono) e la trasparenza dello scheletro sull'app dietro
const livelli = {
  zone: leggiScelta('scheletri-l-zone', ['1', '0'], '1') === '1',
  oggetti: leggiScelta('scheletri-l-oggetti', ['1', '0'], '1') === '1',
  spazi: leggiScelta('scheletri-l-spazi', ['1', '0'], '0') === '1'
};
let trasparenza = 0;                  // 0 = solo scheletro, 100 = solo app (non si ricorda: si riparte da 0)
let sopraOgg: string | null = null;   // l'oggetto sfiorato dal puntatore
let sopra: string | null = null;      // la variabile sfiorata dal puntatore
let scelta: string | null = null;     // la variabile toccata (resta)

// --- Dati del file -------------------------------------------------------------------------------------------------
const numeroZona = (titolo: string): number => { const m = titolo.match(/^(\d)\s/); return m ? Number(m[1]) : 0; };
const misureDelFile = new Map<string, Misura>(MISURE.flatMap(g => g.voci.map(v => [v.nome, v] as const)));
const motivoNonMisurabile = new Map(NON_PROVABILI.map(n => [n.v, n.motivo] as const));

// --- Misura dal vivo -----------------------------------------------------------------------------------------------
interface OggettoMisurato { def: OggettoDef; nome: string; chiave: string; rett: Bordi }
interface Misurazione {
  oggetti: OggettoMisurato[];
  letture: Map<Caso, Lettura | null>;
  zone: (Bordi | null)[];
  turnoVero: string;
}
const risultati = new Map<string, Misurazione>();   // "formato|turno"
let stato: 'in-corso' | 'pronta' | 'errore' = 'in-corso';
let messaggioErrore = '';

const pausa = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
let cornice: HTMLIFrameElement | null = null;
let finestraApp: Finestra | null = null;

// Animazioni e transizioni portate alla fine, poi una breve attesa
async function assesta(win: Finestra, ms = 500): Promise<void> {
  await pausa(ms);
  for (let i = 0; i < 2; i++) {
    win.document.getAnimations().forEach(a => { try { a.finish(); } catch { a.cancel(); } });
    await pausa(80);
  }
}

// L'app in un iframe nascosto largo 360 px (come un telefono: barre di scorrimento sovrapposte, che non occupano spazio)
async function apriApp(): Promise<Finestra> {
  if (finestraApp) return finestraApp;
  const frame = document.createElement('iframe');
  frame.className = 'app-dietro';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.height = FORMATI[0].h + 'px';
  frame.src = import.meta.env.BASE_URL + 'index.html?scheletro=1';
  schermo.prepend(frame);
  await new Promise<void>((ok, no) => { frame.onload = () => ok(); frame.onerror = () => no(new Error('iframe non caricato')); });
  const win = frame.contentWindow as Finestra;
  const pronta = () => { try { return win.eval('typeof app !== "undefined" && !!app.deckSetup && app.allCards.length > 0 && typeof app.makeEntry === "function"') as boolean; } catch { return false; } };
  for (let i = 0; i < 200 && !pronta(); i++) await pausa(150);
  if (!pronta()) throw new Error("l'app non si è caricata");
  win.eval('app.noSave = true');
  const stile = win.document.createElement('style');
  stile.textContent = '*{scrollbar-width:none !important}*::-webkit-scrollbar{display:none !important}*,*::before,*::after{scroll-behavior:auto !important}';
  win.document.head.appendChild(stile);
  cornice = frame;
  finestraApp = win;
  return win;
}

// Le funzioni di dati/misure.mjs si eseguono DENTRO l'app (sono autosufficienti: passano come testo)
const nellApp = <A, R>(win: Finestra, f: (a: A) => R, arg: A): R => (win.eval('(' + f.toString() + ')') as (a: A) => R)(arg);

// Un passo dei MOMENTI della prova (solo 'scenario' e 'js': gli unici che i momenti usano)
async function passo(win: Finestra, [tipo, a]: [string, string]): Promise<void> {
  if (tipo === 'scenario') win.eval(`(() => { const r = app.startScenario(app.SCENARI.find(s => s.id === ${JSON.stringify(a)})); if (r) throw new Error('scenario: ' + r); })()`);
  else if (tipo === 'js') win.eval(`(() => { ${a} })()`);
  else throw new Error('passo sconosciuto: ' + tipo);
  win.eval('app.noSave = true');
  await assesta(win);
}

const rettangolo = (e: Element | null): Bordi | null => {
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
};

async function misura(f: { nome: string; h: number }, t: string): Promise<Misurazione> {
  const win = await apriApp();
  if (!cornice) throw new Error('iframe non pronto');
  cornice.style.height = f.h + 'px';
  await pausa(300);
  win.dispatchEvent(new win.Event('resize'));
  const momento = MOMENTI.find(m => m.id === t);
  if (!momento) throw new Error('momento sconosciuto: ' + t);
  const voltaGiusta = () => {
    const v = win.document.getElementById('app')?.dataset.turno ?? '';
    return v === momento.atteso || (momento.atteso === 'nemesi' && v === 'pesca');
  };
  // Il turno nemesi dipende dalla carta turno pescata (a caso): si ripete lo scenario finché esce
  let tentativi = 0;
  do {
    for (const p of momento.passi) await passo(win, p);
    tentativi++;
  } while (momento.atteso && !voltaGiusta() && tentativi < 60);
  if (momento.atteso && !voltaGiusta()) throw new Error(`non riesco a portare l'app nel momento "${t}"`);
  const turnoVero = win.document.getElementById('app')?.dataset.turno ?? '';
  const letture = new Map<Caso, Lettura | null>();
  const applicabili = CASI.filter(c => !c.turni || c.turni.includes(t));
  const senzaPrima = applicabili.filter(c => !c.prima);
  nellApp(win, LEGGI, { casi: senzaPrima }).forEach((l, i) => letture.set(senzaPrima[i], l));
  // I casi con `prima` (es. togliere un avanzo che altrimenti si somma): le variabili si cambiano, si misura, si rimettono
  for (const c of applicabili.filter(x => x.prima)) {
    const prima = c.prima ?? {};
    nellApp(win, IMPOSTA, { valori: prima });
    letture.set(c, nellApp(win, LEGGI, { casi: [c] })[0]);
    nellApp(win, IMPOSTA, { valori: Object.fromEntries(Object.keys(prima).map(n => [n, null])) });
  }
  const zone = ZONE.map(z => rettangolo(win.document.querySelector(`[data-zona="${z}"]`)));
  return { oggetti: misuraOggetti(win), letture, zone, turnoVero };
}

// Gli oggetti veri (oggetti.ts), misurati dal vivo: ogni elemento che si vede, tagliato ai bordi dello schermo. 'tutti': numerati;
// 'centro': quello che contiene il centro dello schermo (la carta grande); 'vicine': gli altri (il pezzo che si vede)
function misuraOggetti(win: Finestra): OggettoMisurato[] {
  const W = win.innerWidth;
  const H = win.innerHeight;
  const visibile = (e: Element) => e.getClientRects().length > 0 && win.getComputedStyle(e).display !== 'none' && win.getComputedStyle(e).visibility !== 'hidden';
  const centro = (r: Bordi) => r.left <= W / 2 && r.right >= W / 2;
  const out: OggettoMisurato[] = [];
  for (const def of OGGETTI) {
    const pezzi = [...win.document.querySelectorAll(def.sel)].filter(visibile).map(rettangolo).filter((r): r is Bordi => !!r)
      .map(r => ({ top: Math.max(0, r.top), bottom: Math.min(H, r.bottom), left: Math.max(0, r.left), right: Math.min(W, r.right) }))
      .filter(r => r.right - r.left >= 1 && r.bottom - r.top >= 1);
    const scelti = def.modo === 'centro' ? pezzi.filter(centro).slice(0, 1) : def.modo === 'vicine' ? pezzi.filter(r => !centro(r))
      : def.modo === 'tutti' ? pezzi : pezzi.slice(0, 1);
    scelti.forEach((rett, i) => out.push({ def, nome: scelti.length > 1 ? `${def.nome} ${i + 1}` : def.nome, chiave: `${def.id}-${i}`, rett }));
  }
  return out;
}

// Le richieste una dopo l'altra (l'iframe è uno solo)
let coda: Promise<void> = Promise.resolve();
function richiediMisura(): void {
  const chiave = `${formato}|${turno}`;
  // Si rimisura sempre: l'app dietro il disegno deve essere nello stato del formato e del turno scelti
  stato = 'in-corso';
  const f = FORMATI.find(x => x.nome === formato) ?? FORMATI[0];
  const t = turno;
  ridisegna();
  coda = coda.then(async () => {
    if (chiave !== `${formato}|${turno}`) return;   // nel frattempo si è scelto altro: la misura giusta è già in coda
    try {
      risultati.set(chiave, await misura(f, t));
      messaggioErrore = '';
      if (chiave === `${formato}|${turno}`) stato = 'pronta';
    } catch (err) {
      messaggioErrore = err instanceof Error ? err.message : String(err);
      if (chiave === `${formato}|${turno}`) stato = 'errore';
    }
    ridisegna();
  });
}

// --- Testo ---------------------------------------------------------------------------------------------------------
const virgola = (n: number | string) => String(n).replace('.', ',');
const arrotonda = (n: number, dec: number) => Math.round(n * 10 ** dec) / 10 ** dec;
const inUnita = (px: number) => unita === 'mm' ? virgola(arrotonda(px * MM_PER_PX, 2)) : virgola(arrotonda(px, 2));
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

// Una riga: che cosa si vede nelle colonne "misurata" e "differenza"
interface Riga {
  esito: 'misurata' | 'non-uguale' | 'non-misurabile' | 'assente' | 'altro-turno' | 'senza-caso';
  caso?: Caso;
  lettura?: Lettura;
  atteso?: number;
  diff?: number;
  testo?: string;
}
function analizza(v: Misura, ris: Misurazione | undefined): Riga {
  const casiTurno = CASI.filter(c => c.v === v.nome && (!c.turni || c.turni.includes(turno)));
  if (!casiTurno.length) {
    const motivo = motivoNonMisurabile.get(v.nome);
    if (motivo) return { esito: 'non-misurabile', testo: motivo };
    const altri = CASI.filter(c => c.v === v.nome);
    if (altri.length) return { esito: 'altro-turno', testo: `si misura solo nel turno ${altri.flatMap(c => c.turni ?? []).map(x => TURNI.find(t => t[0] === x)?.[1].replace('Turno ', '') ?? x).join(' e ')}` };
    return { esito: 'senza-caso', testo: 'nessuna misura prevista: aggiungere un caso in tools/confronto/dati/misure.mjs (o una riga in NON_PROVABILI)' };
  }
  const caso = casiTurno[0];
  if (!ris) return { esito: 'misurata', caso };
  const lettura = ris.letture.get(caso);
  if (!lettura) return { esito: 'assente', caso, testo: 'elemento assente in questo momento' };
  const atteso = v.numero + (caso.piu ?? []).reduce((s, n) => s + (misureDelFile.get(n)?.numero ?? 0), 0);
  if (caso.nonUguale) return { esito: 'non-uguale', caso, lettura, testo: caso.nonUguale };
  const diff = arrotonda(lettura.misura - atteso, 1);
  const netta = Math.abs(diff) < TOLLERANZA_DIFF ? 0 : diff;
  return { esito: 'misurata', caso, lettura, atteso, diff: netta, testo: netta && caso.diffSpiegata ? caso.diffSpiegata : undefined };
}

// --- Pagina --------------------------------------------------------------------------------------------------------
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const radice = el('zone');
const posto = el('schermo-posto');

function bottoni(id: string, voci: [string, string][], attuale: () => string, scegli: (v: string) => void): void {
  const gruppo = el(id);
  voci.forEach(([valore, testo]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.valore = valore;
    b.textContent = testo;
    b.addEventListener('click', () => { scegli(valore); aggiornaBottoni(); });
    gruppo.appendChild(b);
  });
  (gruppo as HTMLElement & { aggiorna?: () => void }).aggiorna = () =>
    gruppo.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.valore === attuale())));
}
function aggiornaBottoni(): void {
  ['scelta-formato', 'scelta-turno', 'scelta-unita', 'scelta-scala'].forEach(id => (el(id) as HTMLElement & { aggiorna?: () => void }).aggiorna?.());
}
bottoni('scelta-formato', FORMATI.map(f => [f.nome, f.nome]), () => formato, v => { formato = v; ricorda('scheletri-formato', v); richiediMisura(); });
bottoni('scelta-turno', TURNI, () => turno, v => { turno = v; ricorda('scheletri-turno', v); richiediMisura(); });
bottoni('scelta-unita', [['px', 'px'], ['mm', 'mm']], () => unita, v => { unita = v === 'mm' ? 'mm' : 'px'; ricorda('scheletri-unita', v); ridisegna(); });
bottoni('scelta-scala', SCALE.map(s => [String(s), virgola(s) + '×']), () => String(scala), v => { scala = Number(v); ricorda('scheletri-scala', v); ridisegna(); });
aggiornaBottoni();

el('intro').innerHTML =
  `Le misure di <code>src/ui/schermate/partita-misure.css</code>, zona per zona, nello stesso ordine e con gli stessi nomi e commenti del file. ` +
  `Per ogni variabile: il <b>valore nel file</b> e la <b>misura vera</b> presa adesso dall'app (a ${LARGHEZZA_PX} px di larghezza, 1 px = ${virgola(arrotonda(MM_PER_PX, 4))} mm), ` +
  `con la differenza (in rosso se non è 0). Le variabili che non si possono misurare hanno il motivo. Tocca una riga: nel disegno si evidenzia la cosa o lo spazio che misura (e il contrario). ` +
  `È una pagina di sviluppo: non fa parte dell'app.`;

function intestazione(): string {
  return `<thead><tr><th>Variabile</th><th>Che cosa</th><th>Nel file</th><th>Misurata (${unita})</th><th>Differenza (${unita})</th></tr></thead>`;
}

function htmlRiga(v: Misura, ris: Misurazione | undefined): string {
  const r = analizza(v, ris);
  const file = esc(v.valore) + (unita === 'mm' && v.unita === 'px' ? `<small>${inUnita(v.numero)} mm</small>` : '');
  const spiegata = r.esito === 'misurata' && !!r.diff && !!r.testo;
  const classi = [r.esito === 'misurata' && r.diff && !spiegata ? 'is-diff' : '', r.esito === 'non-uguale' || spiegata ? 'is-spiegata' : ''].filter(Boolean).join(' ');
  let celle: string;
  const nota = r.caso?.nota ? `<small>${esc(r.caso.nota)}</small>` : '';
  if (r.esito === 'misurata' && r.lettura && r.diff !== undefined) {
    const segno = r.diff === 0 ? '0' : (r.diff > 0 ? '+' : '') + (unita === 'mm' ? virgola(arrotonda(r.diff * MM_PER_PX, 2)) : virgola(r.diff));
    celle = `<td class="misura">${inUnita(r.lettura.misura)}${nota}</td><td class="diff">${segno}${spiegata ? `<small>${esc(r.testo ?? '')}</small>` : ''}</td>`;
  } else if (r.esito === 'non-uguale' && r.lettura) {
    celle = `<td class="misura">${inUnita(r.lettura.misura)}</td><td class="motivo">${esc(r.testo ?? '')}</td>`;
  } else if (r.esito === 'misurata') {
    celle = `<td class="misura">…</td><td class="diff"></td>`;
  } else {
    celle = `<td class="motivo" colspan="2">${r.esito === 'non-misurabile' ? 'non misurabile: ' : ''}${esc(r.testo ?? '')}</td>`;
  }
  const diff = r.esito === 'misurata' && r.diff !== undefined ? ` data-diff="${r.diff}"${spiegata ? ' data-spiegata="1"' : ''}` : '';
  return `<tr data-var="${v.nome}" data-esito="${r.esito}"${diff} class="${classi}"><td class="nome"><code>${v.nome}</code></td><td>${esc(v.etichetta)}</td><td class="valore">${file}</td>${celle}</tr>`;
}

function ridisegna(): void {
  const ris = risultati.get(`${formato}|${turno}`);
  const f = FORMATI.find(x => x.nome === formato) ?? FORMATI[0];
  document.body.dataset.misura = stato;
  const st = el('stato');
  const turnoNome = TURNI.find(t => t[0] === turno)?.[1] ?? turno;
  if (stato === 'pronta' && ris) {
    st.className = 'stato is-live';
    const diffs = [...MISURE.flatMap(g => g.voci)].filter(v => { const r = analizza(v, ris); return r.esito === 'misurata' && r.diff && !r.testo; }).length;
    st.textContent = `Misure prese adesso dall'app · ${formato} (${LARGHEZZA_PX} × ${f.h} px) · ${turnoNome}: ` +
      (diffs ? `${diffs} variabil${diffs === 1 ? 'e con differenza' : 'i con differenza'} diversa da 0.` : 'nessuna differenza.');
  } else if (stato === 'errore') {
    st.className = 'stato is-error';
    st.textContent = `Non riesco a misurare l'app dal vivo (${messaggioErrore}): vedi solo i valori del file.`;
  } else {
    st.className = 'stato';
    st.textContent = `Misuro l'app dal vivo… (${formato}, ${turnoNome}; intanto vedi i valori del file)`;
  }
  radice.innerHTML = MISURE.map(g => {
    const n = numeroZona(g.titolo);
    const disegno = DISEGNI[g.titolo];
    return `<section class="zona" data-z="${n}"><h2>${n ? `<span class="n">${n}</span>` : ''}${esc(n ? g.titolo.replace(/^\d\s/, '') : g.titolo)}</h2>` +
      (disegno ? `<pre>${esc(disegno)}</pre>` : '') +
      `<div class="tabella"><table>${intestazione()}<tbody>${g.voci.map(v => htmlRiga(v, ris)).join('')}</tbody></table></div></section>`;
  }).join('');
  disegnaSchermo(ris, f.h);
  evidenzia();
}

// --- Il disegno dello schermo --------------------------------------------------------------------------------------
// Lo schermo è uno solo, creato una volta: l'iframe dell'app sta dentro (dietro) e non si ricarica mai; a ogni ridisegno cambiano
// la misura dello schermo e gli strati sopra (zone, oggetti, quote; più, non sfumato, l'evidenziazione).
const schermo = document.createElement('div');
schermo.className = 'schermo';
schermo.setAttribute('role', 'img');
posto.replaceChildren(schermo);
let corrente: Misurazione | undefined;

const scalaPx = () => MM_PER_PX * PX_PER_MM * scala;   // pixel di CSS per ogni pixel dell'app

// Opacità dei due strati: l'app (0 = niente) e lo scheletro (1 = tutto); a 100 resta solo l'app
function applicaTrasparenza(): void {
  const app = schermo.querySelector<HTMLElement>('.app-dietro');
  if (app) app.style.opacity = String(trasparenza / 100);
  const fisso = schermo.querySelector<HTMLElement>('.fisso');
  if (fisso) fisso.style.opacity = String(1 - trasparenza / 100);
  el('trasp-valore').textContent = `${trasparenza}%`;
}

function disegnaSchermo(ris: Misurazione | undefined, altezza: number): void {
  corrente = ris;
  const k = scalaPx();
  const S = (n: number) => `${arrotonda(n * k, 2)}px`;
  schermo.style.width = S(LARGHEZZA_PX);
  schermo.style.height = S(altezza);
  schermo.setAttribute('aria-label', `Schermo ${formato}, ${LARGHEZZA_PX} per ${altezza} px, con le 7 zone e gli oggetti`);
  const app = schermo.querySelector<HTMLElement>('.app-dietro');
  if (app) { app.style.height = `${altezza}px`; app.style.transform = `scale(${arrotonda(k, 4)})`; }
  schermo.querySelectorAll('.sovra').forEach(e => e.remove());
  const sovra = document.createElement('div');
  sovra.className = 'sovra';
  const fisso = document.createElement('div');
  fisso.className = 'fisso';
  const evid = document.createElement('div');
  evid.className = 'evid';
  sovra.append(fisso, evid);
  schermo.appendChild(sovra);
  if (!ris) {
    const v = document.createElement('div');
    v.className = 'vuoto';
    v.textContent = 'misura in corso…';
    fisso.appendChild(v);
    applicaTrasparenza();
    return;
  }
  const posiziona = (d: HTMLElement, r: { left: number; top: number; width: number; height: number }) =>
    Object.assign(d.style, { left: S(r.left), top: S(r.top), width: S(r.width), height: S(r.height) });

  // Livello 1: le fasce delle 7 zone
  const nomiZone = MISURE.filter(g => numeroZona(g.titolo)).map(g => g.titolo.replace(/^\d\s/, ''));
  if (livelli.zone) {
    ris.zone.forEach((z, i) => {
      if (!z) return;
      const d = document.createElement('div');
      d.className = 'dz';
      d.dataset.z = String(i + 1);
      const alto = Math.max(0, z.top);
      posiziona(d, { left: 0, top: alto, width: LARGHEZZA_PX, height: Math.max(0, Math.min(altezza, z.bottom) - alto) });
      const vuota = i === 5 && ris.turnoVero !== 'giocatori';
      d.innerHTML = `<span class="zn">${i + 1}</span><span class="zt">${esc(nomiZone[i] ?? '')}${vuota ? ' · vuota nel turno nemesi' : ''}</span>`;
      fisso.appendChild(d);
    });
  }

  // Livello 2: gli oggetti veri (i più grandi sotto, i più piccoli sopra: si sfiorano meglio)
  if (livelli.oggetti) {
    const area = (o: OggettoMisurato) => (o.rett.right - o.rett.left) * (o.rett.bottom - o.rett.top);
    [...ris.oggetti].sort((a, b) => area(b) - area(a)).forEach(o => {
      const d = document.createElement('div');
      d.className = 'og';
      d.dataset.og = o.chiave;
      d.dataset.vars = o.def.vars.join(' ');
      d.title = o.nome;
      posiziona(d, { left: o.rett.left, top: o.rett.top, width: o.rett.right - o.rett.left, height: o.rett.bottom - o.rett.top });
      if ((o.rett.right - o.rett.left) * k >= 30 && (o.rett.bottom - o.rett.top) * k >= 10) d.textContent = o.nome;
      fisso.appendChild(d);
    });
  }

  // Livello 3: gli spazi tra gli oggetti, le coppie "tra X e Y" della prova misure, come quote con il numero
  if (livelli.spazi) {
    CASI.filter(c => (!c.turni || c.turni.includes(turno)) && c.a[0] !== c.b[0]).forEach(c => {
      const l = ris.letture.get(c);
      const r = l ? rettangoloCaso(c, l) : null;
      if (!l || !r) return;
      const verticale = c.a[1] === 'top' || c.a[1] === 'bottom';
      const lunghezza = verticale ? r.h : r.w;
      if (lunghezza < 0.5) return;
      const q = document.createElement('div');
      q.className = `qt ${verticale ? 'v' : 'h'}`;
      q.dataset.var = c.v;
      q.title = `${c.v}: ${inUnita(l.misura)} ${unita}`;
      if (verticale) Object.assign(q.style, { left: `${arrotonda((r.x + r.w / 2) * k - 4, 2)}px`, top: S(r.y), width: '8px', height: S(r.h) });
      else Object.assign(q.style, { left: S(r.x), top: `${arrotonda((r.y + r.h / 2) * k - 4, 2)}px`, width: S(r.w), height: '8px' });
      q.innerHTML = `<span class="ln"></span><span class="nm">${inUnita(Math.abs(l.misura))}</span>`;
      fisso.appendChild(q);
    });
  }

  // Strato dell'evidenziazione (non sfumato): la cosa o lo spazio di una riga scelta
  CASI.filter(c => !c.turni || c.turni.includes(turno)).forEach(c => {
    const l = ris.letture.get(c);
    const rett = l ? rettangoloCaso(c, l) : null;
    if (!l || !rett) return;
    const caso = document.createElement('div');
    caso.className = 'caso';
    caso.dataset.var = c.v;
    for (const b of [l.a, l.b]) {
      const ab = document.createElement('div');
      ab.className = 'ab';
      posiziona(ab, { left: b.left, top: b.top, width: b.right - b.left, height: b.bottom - b.top });
      caso.appendChild(ab);
    }
    const ev = document.createElement('div');
    ev.className = 'ev';
    const sottile = rett.w * k < 4 ? 'w' : rett.h * k < 4 ? 'h' : '';
    Object.assign(ev.style, {
      left: S(rett.x - (sottile === 'w' ? 2 / k : 0)), top: S(rett.y - (sottile === 'h' ? 2 / k : 0)),
      width: sottile === 'w' ? '4px' : S(rett.w), height: sottile === 'h' ? '4px' : S(rett.h)
    });
    caso.appendChild(ev);
    evid.appendChild(caso);
  });
  applicaTrasparenza();
}

// Il rettangolo da evidenziare per un caso: la cosa stessa (altezza o larghezza di una cosa sola) o lo spazio tra i due bordi
function rettangoloCaso(c: Caso, l: Lettura): { x: number; y: number; w: number; h: number } | null {
  const verticale = c.a[1] === 'top' || c.a[1] === 'bottom';
  if (c.a[0] === c.b[0]) return { x: l.a.left, y: l.a.top, w: l.a.right - l.a.left, h: l.a.bottom - l.a.top };
  const va = l.a[c.a[1]];
  const vb = l.b[c.b[1]];
  if (verticale) {
    const x1 = Math.max(l.a.left, l.b.left);
    const x2 = Math.min(l.a.right, l.b.right);
    const [x, w] = x2 > x1 ? [x1, x2 - x1] : [l.a.left, l.a.right - l.a.left];
    return { x, y: Math.min(va, vb), w, h: Math.abs(vb - va) };
  }
  const y1 = Math.max(l.a.top, l.b.top);
  const y2 = Math.min(l.a.bottom, l.b.bottom);
  const [y, h] = y2 > y1 ? [y1, y2 - y1] : [l.a.top, l.a.bottom - l.a.top];
  return { x: Math.min(va, vb), y, w: Math.abs(vb - va), h };
}

// --- Comandi dei livelli e della trasparenza -----------------------------------------------------------------------
type Livello = keyof typeof livelli;
const NOMI_LIVELLI: [Livello, string][] = [['zone', 'Fasce delle zone'], ['oggetti', 'Oggetti'], ['spazi', 'Spazi (quote)']];
NOMI_LIVELLI.forEach(([chiave, testo]) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = testo;
  b.dataset.livello = chiave;
  b.setAttribute('aria-pressed', String(livelli[chiave]));
  b.addEventListener('click', () => {
    livelli[chiave] = !livelli[chiave];
    ricorda(`scheletri-l-${chiave}`, livelli[chiave] ? '1' : '0');
    b.setAttribute('aria-pressed', String(livelli[chiave]));
    ridisegna();
  });
  el('scelta-livelli').appendChild(b);
});
el<HTMLInputElement>('trasparenza').addEventListener('input', e => {
  trasparenza = Number((e.target as HTMLInputElement).value);
  applicaTrasparenza();
});

// --- Evidenziazione (riga ↔ disegno) -------------------------------------------------------------------------------
let zonaSopra: string | null = null;
function infoOggetto(o: OggettoMisurato): string {
  const r = o.rett;
  const misure = o.def.vars.map(n => `<code>${n}</code> ${esc(misureDelFile.get(n)?.valore ?? '')}`).join(' · ');
  return `<b>${esc(o.nome)}</b> · zona ${o.def.zona} · ${inUnita(r.right - r.left)} × ${inUnita(r.bottom - r.top)} ${unita} · x ${inUnita(r.left)}, y ${inUnita(r.top)}` +
    `<br>Nel file: ${misure || 'nessuna riga'}`;
}
function evidenzia(): void {
  const ogg = sopraOgg ? corrente?.oggetti.find(o => o.chiave === sopraOgg) : undefined;
  const attive = new Set<string>();
  if (ogg) ogg.def.vars.forEach(v => attive.add(v));
  else if (sopra ?? scelta) attive.add((sopra ?? scelta) as string);
  document.querySelectorAll<HTMLElement>('[data-var]').forEach(e => {
    e.classList.toggle('is-on', attive.has(e.dataset.var ?? ''));
    e.classList.toggle('is-scelta', e.dataset.var === scelta && e.tagName === 'TR');
  });
  document.querySelectorAll<HTMLElement>('[data-og]').forEach(e => {
    const delleVar = (e.dataset.vars ?? '').split(' ');
    e.classList.toggle('is-on', e.dataset.og === sopraOgg || (!ogg && [...attive].some(v => delleVar.includes(v))));
  });
  document.querySelectorAll<HTMLElement>('[data-z]').forEach(e => e.classList.toggle('is-on', e.dataset.z === zonaSopra));
  el('info').innerHTML = ogg ? infoOggetto(ogg) : 'Passa il mouse (o tocca) un oggetto del disegno: si evidenziano la sua misura e le righe di <code>partita-misure.css</code> che lo riguardano; e viceversa da una riga.';
}
const dellaRiga = (e: EventTarget | null) => (e as HTMLElement | null)?.closest<HTMLElement>('[data-var]')?.dataset.var ?? null;
const dellaZona = (e: EventTarget | null) => (e as HTMLElement | null)?.closest<HTMLElement>('[data-z]')?.dataset.z ?? null;
const delloOggetto = (e: EventTarget | null) => (e as HTMLElement | null)?.closest<HTMLElement>('[data-og]')?.dataset.og ?? null;
for (const radiceEventi of [radice, posto]) {
  radiceEventi.addEventListener('mouseover', e => {
    sopraOgg = delloOggetto(e.target);
    sopra = sopraOgg ? null : dellaRiga(e.target);
    zonaSopra = sopraOgg || sopra ? null : dellaZona(e.target);
    evidenzia();
  });
  radiceEventi.addEventListener('mouseleave', () => { sopraOgg = null; sopra = null; zonaSopra = null; evidenzia(); });
  radiceEventi.addEventListener('click', e => {
    const o = delloOggetto(e.target);
    const v = o ? corrente?.oggetti.find(x => x.chiave === o)?.def.vars[0] ?? null : dellaRiga(e.target);
    if (!v) return;
    scelta = scelta === v ? null : v;
    sopra = null;
    sopraOgg = o;
    evidenzia();
    // Dal disegno alla riga: la riga scelta si porta in vista
    if (radiceEventi === posto && scelta) radice.querySelector(`tr[data-var="${scelta}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

ridisegna();
richiediMisura();