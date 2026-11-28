// ui/schermate/mazzo-turni-bozza.ts: la bozza della schermata del mazzo dei turni (copia del mazzo, operazioni, scrittura
// subito nella partita senza undo), le carte dei turni disegnate (faccia e nome), la copia della barra dei turni con la
// bozza e il tipo dello stato della finestra aperta (Finestra). File di supporto di mazzo-turni.ts.
// Livello 5 (ui/schermate/). Dipende da: regole/mazzo-turni.ts, stato/partita.ts (applicaBozzaTurni, conMazzoTurni),
// ui/ base (testi, pagina, dom, ridisegno), ui/componenti/barra-turni.ts. Usato da: mazzo-turni.ts e gli altri suoi file
// di supporto.
import * as Turni from '../../regole/mazzo-turni.ts';
import { applicaBozzaTurni, conMazzoTurni, isPairCard, pairOptions, partita,
  turnCardPlayer } from '../../stato/partita.ts';
import type { BozzaTurni, CartaTurno, MazzoTurni } from '../../tipi/partita.ts';
import type { Fotografia } from '../../tipi/salvataggio.ts';
import { renderTurnTrack, turnTrack } from '../componenti/barra-turni.ts';
import { el } from '../dom.ts';
import { ui } from '../pagina.ts';
import { richiediRidisegno } from '../ridisegno.ts';
import { T } from '../testi.ts';

export interface Selezione {
  source: 'deck' | 'pile';
  index: number;
}

// Dove si lascia una carta: in cima, in fondo, in fondo agli scarti, o in una posizione del mazzo
export type Destinazione = { type: 'top' | 'bottom' | 'pile' } | { type: 'pos'; index: number };

// Dito o mouse premuto su una carta, prima che parta il trascinamento
export interface Pressione {
  card: HTMLElement;             // la carta
  source: Selezione['source'];   // mazzo o scarti
  index: number;                 // posizione
  x: number;                     // punto di partenza
  y: number;
  id: number;                    // puntatore
}

// Trascinamento in corso: la copia della carta segue il dito
export interface Trascinamento {
  source: Selezione['source'];   // mazzo o scarti
  index: number;                 // posizione della carta presa
  ghost: HTMLElement;            // copia che segue il dito
  dx: number;                    // dove sta la copia rispetto al dito
  dy: number;
  w: number;                     // misura della carta
  h: number;
  target: Destinazione | null;   // dove cadrebbe lasciandola ora
}

// La finestra aperta: la bozza, lo stato del tocco e del trascinamento, gli elementi e i gestori. Una sola alla volta;
// la creano openTurnScreen (mazzo-turni.ts) e la usano il disegno (mazzo-turni-disegno.ts) e il trascinamento
// (mazzo-turni-trascina.ts)
export interface Finestra {
  d: BozzaTurni;                 // bozza (d.old: carte già note all'apertura, scurite, si spostano solo dalla cima)
  initial: BozzaTurni;           // bozza all'apertura ("Ripristina tutto")
  savedKey: string;              // ultima bozza scritta nel mazzo dei turni
  before: Fotografia;            // partita all'apertura: alla chiusura, se il mazzo dei turni è cambiato, l'unico passo
                                 // di undo della visita
  committed: boolean;            // passo di undo già aggiunto
  fresh: (order: MazzoTurni | BozzaTurni) => BozzaTurni; // bozza nuova con d.old
  dirty: () => boolean;          // la bozza è diversa da quella dell'apertura
  allKnown: () => boolean;       // tutte le carte del mazzo sono scoperte
  sel: Selezione | null;         // carta selezionata senza trascinamento
  press: Pressione | null;       // dito premuto su una carta
  drag: Trascinamento | null;    // trascinamento in corso
  shuffling: boolean;            // animazione della mescola in corso
  closing: boolean;              // il foglio si sta chiudendo
  suppressClick: boolean;        // il click che segue il rilascio non seleziona la carta
  close: () => void;             // chiude la finestra (openModal)
  pesca?: { busy: boolean; fine: () => void; lascia?: () => void }; // modalità pesca del turno (mazzo-turni-pesca.ts): occupata
                                 // finché la sequenza non è finita; fine, alla chiusura, dice cosa fare dopo la pesca;
                                 // lascia (solo mentre si attende la scelta del giocatore) chiude la sequenza
  fanEls: HTMLElement[];         // carte del mazzo disegnate
  pileEls: HTMLElement[];        // carte degli scarti disegnate
  rowGeo: { centers: number[]; split: number; n: number } | null; // ultima disposizione: centri delle carte del mazzo,
                                 // centro del segmento verticale (coordinate della riga)
  headsGrowTimer: ReturnType<typeof setTimeout> | undefined; // il carattere dei titoli sale dopo lo spostamento
  headsGrowing: boolean;
  lastHeadsCx: number;
  dialog: HTMLDivElement;        // la finestra
  sheet: HTMLDivElement;         // foglio che scende da sotto la barra dei turni
  copyShell: HTMLDivElement;     // copia della testata e della barra dei turni
  trackHolder: HTMLDivElement;   // copia della barra dei turni con la bozza
  copyMenu: HTMLElement | null;  // pulsante Menu nella copia della testata
  row: HTMLDivElement;           // riga: scarti, segmento verticale, mazzo
  pileArea: HTMLDivElement;
  pileRow: HTMLDivElement;
  divider: HTMLSpanElement;      // segmento verticale (con la cuspide)
  deckArea: HTMLDivElement;
  shuffleBtn: HTMLButtonElement; // Mescola
  heads: HTMLDivElement;         // riga dei titoli
  pileHead: HTMLHeadingElement;  // "Scarti"
  deckHead: HTMLHeadingElement;  // "Mazzo turno"
  headLines: HTMLSpanElement[];  // tratti di linea della riga dei titoli
  cusp: HTMLSpanElement;
  board: HTMLDivElement;
  lane: HTMLDivElement;          // corsia del mazzo
  zoneTop: HTMLButtonElement;    // posto "Cima"
  zoneBottom: HTMLButtonElement; // posto "Fondo"
  revealTop: HTMLButtonElement;  // occhio sulla carta in cima
  insertBar: HTMLSpanElement;    // guida dove cadrà la carta
  pileInsert: HTMLSpanElement;   // guida in fondo agli scarti
  pileZone: HTMLSpanElement;     // cerchio d'arrivo degli scarti
  revealAll: HTMLButtonElement;  // Rivela tutto / Copri tutto
  revealAllEye: HTMLSpanElement;
  revealRow: HTMLDivElement;
  time: HTMLDivElement;          // linea del tempo sotto le carte (solo da guardare)
  hint: HTMLParagraphElement;    // suggerimento sotto la riga
  footer: HTMLDivElement;
  resetBtn: HTMLButtonElement;   // Ripristina tutto
  h: Gestori;                    // gestori legati a questa finestra
}

// Gestori degli eventi legati alla finestra aperta (la stessa funzione serve per aggiungere e togliere l'ascoltatore)
export interface Gestori {
  onCardClick: (e: MouseEvent) => void;
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onResize: () => void;
  shut: () => void;
  runShuffle: () => void;
}

// --- Mazzo dei turni: finestra unica ---
// Si apre toccando la barra della fase. È uno strumento libero: nessun vincolo per carta, le regole delle carte che
// agiscono sul mazzo dei turni (Hissing Acid, Sunder, Thunderous Tempest, Flare, Quartz Shard, Xaxos...) le applicano i
// giocatori.
// Carta del mazzo dei turni disegnata come una piccola carta: la faccia è l'immagine della carta vera
// (Assets/ui/turn-cards/<carta>.webp, mazzo-turni.css [data-card]); sulle carte 1/2, 3/4 e Wild con il giocatore già deciso,
// un tondino con il suo numero nel suo colore (.ae-turn-card-who). i: posizione negli scarti (drawn), -1 = nel mazzo.
// order: turnOrder o la bozza della finestra
export function turnCardFace(kind: CartaTurno, i: number | undefined, tag: 'span' | 'button' = 'span',
  order: Pick<MazzoTurni, 'history' | 'waiting' | 'picks'> = partita.turnOrder): HTMLSpanElement | HTMLButtonElement {
  const who = turnCardPlayer(kind, i, order);
  const face = el(tag, 'ae-turn-card');
  face.dataset.kind = who || kind;
  face.dataset.card = kind;
  if (kind === 'wild') face.classList.add('is-wild');
  if (who && (isPairCard(kind) || kind === 'wild')) {
    const badge = el('span', 'ae-turn-card-who', who.slice(1));
    badge.dataset.kind = who;
    badge.setAttribute('aria-hidden', 'true');
    face.appendChild(badge);
  }
  face.setAttribute('aria-label', turnCardName(kind, i, order));
  return face;
}

export function turnCardName(kind: CartaTurno, i: number | undefined, order: Pick<MazzoTurni, 'history' | 'waiting' | 'picks'> = partita.turnOrder): string {
  const who = turnCardPlayer(kind, i, order);
  if (kind === 'nemesis') return T.trackNemesisName;
  if (kind === 'wild') return who ? T.trackWildOf(Number(who.slice(1))) : T.trackWildName;
  if (who) return T.trackPlayerName(Number(who.slice(1)));
  const [a, b] = pairOptions(kind);
  return T.turnPairName(Number(a.slice(1)), Number(b.slice(1)));
}

// Bozza della finestra: copia di mazzo (left, left[0] = cima), carte note (known, parallelo a left), scarti (drawn),
// giocatori delle carte 1/2 e 3/4 (picks), memoria delle coppie (pairNext), storia dei turni del giro (history) e
// attesa (waiting). Ogni modifica vale subito (applicaBozzaTurni scrive nella partita e salva, senza passo di undo); un solo
// passo di undo si aggiunge alla chiusura della finestra (aggiungiPassoUndo).
export function turnDraftFrom(order: MazzoTurni | BozzaTurni): BozzaTurni {
  return Turni.turnDraftFrom(order);
}

export function turnDraftKey(d: BozzaTurni): string {
  return Turni.turnDraftKey(d);
}

// Posizione negli scarti della carta del turno in corso (-1 = nessuna, anche se la sua carta è tornata nel mazzo)
export function turnDraftCurrent(d: BozzaTurni): number {
  return Turni.turnDraftCurrent(d);
}

// Stato di ogni carta degli scarti per la linea del tempo (giocata, in corso, saltata)
export function turnPileStates(d: BozzaTurni): Turni.StatoCartaScarti[] {
  return Turni.turnPileStates(d);
}

// Azioni sulla bozza (regole/mazzo-turni.ts); "Mescola" usa il caso di Math.random
export const turnDraftOps = {
  ...Turni.turnDraftOps,
  shuffle(d: BozzaTurni): void { Turni.turnDraftOps.shuffle(d, Math.random); }
};

// Carta del mazzo che si può spostare: nota e, se era già nota all'apertura della finestra (d.old, scurita), solo
// quando è in cima
export function turnDeckMovable(d: BozzaTurni, i: number): boolean {
  return Turni.turnDeckMovable(d, i);
}

// Scrive la bozza nel mazzo dei turni (il turno in corso continua sempre). Senza passo di undo: il passo di undo è uno
// solo per tutta la visita della finestra, aggiunto alla chiusura (openTurnScreen, shut)
export function saveTurnDraft(d: BozzaTurni): void {
  applicaBozzaTurni(d);
  richiediRidisegno();
}

// Copia solo da guardare di un pezzo dell'app (testata, barra della fase): niente id, ruoli, tabindex, etichette
export function viewOnlyCopy(node: HTMLElement): HTMLElement {
  const copy = node.cloneNode(true);
  if (!(copy instanceof HTMLElement)) throw new TypeError('copia della testata non riuscita');
  [copy, ...copy.querySelectorAll('*')].forEach(n => {
    ['id', 'role', 'tabindex', 'aria-label', 'aria-controls', 'aria-expanded', 'aria-live'].forEach(a => n.removeAttribute(a));
  });
  return copy;
}

// Copia della barra della fase con la bozza della finestra (carte note, turno annullato): per un attimo turnOrder è la
// bozza (stato/partita.ts, conMazzoTurni), si disegna la barra e la si copia, poi si rimette tutto. ui.trackPreview
// evita scelta 1/2 o 3/4 e riquadro.
export function trackPreviewCopy(d: BozzaTurni): HTMLElement {
  const real = partita.turnOrder;
  ui.trackPreview = true;
  try {
    return conMazzoTurni(Object.assign({}, real, { left: d.left, known: d.known, drawn: d.drawn, picks: d.picks, pairNext: d.pairNext,
      history: d.history, waiting: d.waiting }), () => {
      renderTurnTrack();
      return viewOnlyCopy(turnTrack);
    });
  } finally {
    renderTurnTrack();
    ui.trackPreview = false;
  }
}

// La carta parte appena il dito si sposta di TURN_DRAG_PX (niente "tieni premuto"); un tocco senza spostamento resta un
// tocco (seleziona la carta)
export const TURN_DRAG_PX = 6;

// Simbolo dell'insieme vuoto (∅: cerchio con una barra obliqua che esce dal cerchio), nei posti vuoti di scarti e
// mazzo dei turni; disegnato in SVG, colore del testo
export function emptySetIcon(): HTMLSpanElement {
  const s = el('span', 'ae-turn-empty-icon');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M5 19 L19 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  return s;
}
