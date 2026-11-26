// scheletri/scheletri.ts: la pagina scheletri/ (pagina di sviluppo, non una schermata dell'app: seconda pagina di Vite, vite.config.ts).
// Ha la struttura di src/ui/schermate/partita-misure.css: un blocco per zona (nell'ordine del file) con il disegno del commento e,
// per ogni variabile, il nome, il commento, il valore nel file, la misura vera presa dall'app e la differenza. A fianco il disegno
// in scala dello schermo con le 7 zone; una riga toccata (o sfiorata) evidenzia nel disegno la cosa o lo spazio misurato, e il
// contrario. Due turni (giocatori / nemesi) e i formati 18:9-20:9, tutti a 360 px di larghezza.
// La misura dal vivo: l'app vera in un iframe nascosto (app.noSave = true: la partita salvata non cambia), portata nei momenti
// della prova "misure" di tools/confronto (MOMENTI) e misurata con le sue coppie "tra X e Y" (CASI, LEGGI): pagina e prova non
// possono dire cose diverse. Le variabili e i commenti vengono dal file CSS, letto dal lettore del pannello Regolazioni.
// Dipende da: src/ui/finestre/test-regolazioni-lettura.ts, tools/confronto/dati/misure.mjs, scheletri.css. Usato da: index.html.

import './scheletri.css';
import { DISEGNI, MISURE } from '../src/ui/finestre/test-regolazioni-lettura.ts';
import type { Misura } from '../src/ui/finestre/test-regolazioni-lettura.ts';
import { CASI, IMPOSTA, LEGGI, MOMENTI, NON_PROVABILI } from '../tools/confronto/dati/misure.mjs';
import type { Bordi, Caso, Lettura } from '../tools/confronto/dati/misure.mjs';

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
let sopra: string | null = null;      // la variabile sfiorata dal puntatore
let scelta: string | null = null;     // la variabile toccata (resta)

// --- Dati del file -------------------------------------------------------------------------------------------------
const numeroZona = (titolo: string): number => { const m = titolo.match(/^(\d)\s/); return m ? Number(m[1]) : 0; };
const misureDelFile = new Map<string, Misura>(MISURE.flatMap(g => g.voci.map(v => [v.nome, v] as const)));
const motivoNonMisurabile = new Map(NON_PROVABILI.map(n => [n.v, n.motivo] as const));

// --- Misura dal vivo -----------------------------------------------------------------------------------------------
interface Misurazione {
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
  frame.className = 'misuratore';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.height = FORMATI[0].h + 'px';
  frame.src = import.meta.env.BASE_URL + 'index.html?scheletro=1';
  document.body.appendChild(frame);
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
  return { letture, zone, turnoVero };
}

// Le richieste una dopo l'altra (l'iframe è uno solo)
let coda: Promise<void> = Promise.resolve();
function richiediMisura(): void {
  const chiave = `${formato}|${turno}`;
  if (risultati.has(chiave)) { stato = 'pronta'; ridisegna(); return; }
  stato = 'in-corso';
  const f = FORMATI.find(x => x.nome === formato) ?? FORMATI[0];
  const t = turno;
  ridisegna();
  coda = coda.then(async () => {
    if (risultati.has(chiave)) { if (chiave === `${formato}|${turno}`) { stato = 'pronta'; ridisegna(); } return; }
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

// Il disegno dello schermo: le 7 zone e, per ogni variabile misurata, la cosa o lo spazio (invisibile finché non si sceglie la riga)
function disegnaSchermo(ris: Misurazione | undefined, altezza: number): void {
  const k = MM_PER_PX * PX_PER_MM * scala;
  const px = (n: number) => `${arrotonda(n * k, 2)}px`;
  const schermo = document.createElement('div');
  schermo.className = 'schermo';
  schermo.style.width = px(LARGHEZZA_PX);
  schermo.style.height = px(altezza);
  schermo.setAttribute('role', 'img');
  schermo.setAttribute('aria-label', `Schermo ${formato}, ${LARGHEZZA_PX} per ${altezza} px, con le 7 zone`);
  const nomiZone = MISURE.filter(g => numeroZona(g.titolo)).map(g => g.titolo.replace(/^\d\s/, ''));
  ris?.zone.forEach((z, i) => {
    if (!z) return;
    const d = document.createElement('div');
    d.className = 'dz';
    d.dataset.z = String(i + 1);
    d.style.top = px(Math.max(0, z.top));
    d.style.height = px(Math.max(0, Math.min(altezza, z.bottom) - Math.max(0, z.top)));
    d.style.width = px(LARGHEZZA_PX);
    const vuota = i === 5 && ris.turnoVero !== 'giocatori';
    d.innerHTML = `<span class="zn">${i + 1}</span><span class="zt">${esc(nomiZone[i] ?? '')}${vuota ? ' · vuota nel turno nemesi' : ''}</span>`;
    schermo.appendChild(d);
  });
  // Cose e spazi: i più grandi sotto, i più piccoli sopra (si sfiorano meglio)
  const pezzi: { v: string; area: number; nodo: HTMLElement }[] = [];
  CASI.filter(c => !c.turni || c.turni.includes(turno)).forEach(c => {
    const l = ris?.letture.get(c);
    if (!l) return;
    const rett = rettangoloCaso(c, l);
    if (!rett) return;
    const caso = document.createElement('div');
    caso.className = 'caso';
    caso.dataset.var = c.v;
    for (const b of [l.a, l.b]) {
      const ab = document.createElement('div');
      ab.className = 'ab';
      Object.assign(ab.style, { left: px(b.left), top: px(b.top), width: px(b.right - b.left), height: px(b.bottom - b.top) });
      caso.appendChild(ab);
    }
    const ev = document.createElement('div');
    ev.className = 'ev';
    const sottile = Math.max(rett.w * k, 0) < 4 || Math.max(rett.h * k, 0) < 4;
    Object.assign(ev.style, {
      left: px(rett.x - (rett.w * k < 4 ? 2 / k : 0)), top: px(rett.y - (rett.h * k < 4 ? 2 / k : 0)),
      width: sottile && rett.w * k < 4 ? '4px' : px(rett.w), height: sottile && rett.h * k < 4 ? '4px' : px(rett.h)
    });
    ev.title = `${c.v}: ${inUnita(l.misura)} ${unita}`;
    caso.appendChild(ev);
    pezzi.push({ v: c.v, area: rett.w * rett.h, nodo: caso });
  });
  pezzi.sort((a, b) => b.area - a.area).forEach(p => schermo.appendChild(p.nodo));
  if (!ris) {
    const v = document.createElement('div');
    v.className = 'vuoto';
    v.style.top = '0';
    v.style.width = px(LARGHEZZA_PX);
    v.style.height = px(altezza);
    v.textContent = 'misura in corso…';
    schermo.appendChild(v);
  }
  posto.replaceChildren(schermo);
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

// --- Evidenziazione (riga ↔ disegno) -------------------------------------------------------------------------------
let zonaSopra: string | null = null;
function evidenzia(): void {
  const attiva = sopra ?? scelta;
  document.querySelectorAll<HTMLElement>('[data-var]').forEach(e => {
    e.classList.toggle('is-on', e.dataset.var === attiva);
    e.classList.toggle('is-scelta', e.dataset.var === scelta && e.tagName === 'TR');
  });
  document.querySelectorAll<HTMLElement>('[data-z]').forEach(e => e.classList.toggle('is-on', e.dataset.z === zonaSopra));
}
const dellaRiga = (e: EventTarget | null) => (e as HTMLElement | null)?.closest<HTMLElement>('[data-var]')?.dataset.var ?? null;
const dellaZona = (e: EventTarget | null) => (e as HTMLElement | null)?.closest<HTMLElement>('[data-z]')?.dataset.z ?? null;
for (const radiceEventi of [radice, posto]) {
  radiceEventi.addEventListener('mouseover', e => { sopra = dellaRiga(e.target); zonaSopra = sopra ? null : dellaZona(e.target); evidenzia(); });
  radiceEventi.addEventListener('mouseleave', () => { sopra = null; zonaSopra = null; evidenzia(); });
  radiceEventi.addEventListener('click', e => {
    const v = dellaRiga(e.target);
    if (!v) return;
    scelta = scelta === v ? null : v;
    sopra = null;
    evidenzia();
    // Dal disegno alla riga: la riga scelta si porta in vista
    if (radiceEventi === posto && scelta) radice.querySelector(`tr[data-var="${scelta}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

ridisegna();
richiediMisura();
