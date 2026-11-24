// ui/schermate/mazzo-turni.ts: finestra del mazzo dei turni (scarti e mazzo dei turni in una riga, carte da spostare
// con il dito o con due tocchi, Rivela / Copri, Mescola) e scelta "Chi gioca questo turno?" delle carte 1/2 e 3/4.
// Il mazzo dei turni si cambia con stato/partita.ts: applicaBozzaTurni a ogni modifica della finestra (senza undo),
// aggiungiPassoUndo alla chiusura (un passo per visita), conMazzoTurni per disegnare l'anteprima della barra.
// Dipende da: regole/mazzo-turni.ts (bozza), stato/partita.ts, ui/ (testi, pagina, eventi), ui/componenti (componenti,
// dialoghi, testata, menu-laterale), ui/schermate (turno-nemesi, mazzo-turni-riga: conti della riga). Usato da: eventi
// (barra dei turni), turno nemesi,
// turno giocatori, componenti, testata, menu laterale (animDone).

import * as Turni from '../../regole/mazzo-turni.ts';
import { I18N_IT } from '../testi.ts';
import { aggiungiPassoUndo, applicaBozzaTurni, conMazzoTurni, currentTurnCard, isPairCard, pairOptions, turnCardPlayer, partita, snapshot } from '../../stato/partita.ts';
import { el, icon, need, query } from '../componenti/componenti.ts';
import { announce, button, dialogShell, modals, openModal } from '../componenti/dialoghi.ts';
import { fitPhaseName, render } from './turno-nemesi.ts';
import { renderTurnTrack, turnTrack, chooseTurnPlayer } from '../eventi.ts';
import { headerPiles } from '../componenti/testata.ts';
import { openSideMenu } from '../componenti/menu-laterale.ts';
import type { BozzaTurni, CartaTurno, Giocatore, MazzoTurni } from '../../tipi/partita.ts';
import { TURN_SPREAD, inCardBand, spaceItems } from './mazzo-turni-riga.ts';
import type { OggettoRiga } from './mazzo-turni-riga.ts';
import { app, byId, mainEl, nemesisBtn, reducedMotion, ui } from '../pagina.ts';

// Carta toccata o presa nella finestra: del mazzo (posizione dalla cima) o degli scarti (posizione negli scarti)
interface Selezione {
  source: 'deck' | 'pile';
  index: number;
}

// Dove si lascia una carta: in cima, in fondo, in fondo agli scarti, o in una posizione del mazzo
type Destinazione = { type: 'top' | 'bottom' | 'pile' } | { type: 'pos'; index: number };

// La finestra aperta, per le verifiche e per il ridisegno al cambio di misura
export interface FinestraTurni {
  dialog: HTMLDivElement;
  readonly draft: BozzaTurni;
  dirty: () => boolean;
  tryClose: () => void;
  onCancel: () => void;
  shuffle: () => void;
  readonly shuffling: boolean;
}

// --- Mazzo dei turni: finestra unica ---
// Si apre toccando la barra della fase. È uno strumento libero: nessun vincolo per carta, le regole delle carte che
// agiscono sul mazzo dei turni (Hissing Acid, Sunder, Thunderous Tempest, Flare, Quartz Shard, Xaxos...) le applicano i
// giocatori.
// Carta del mazzo dei turni disegnata come una piccola carta: la faccia è l'immagine della carta vera
// (Assets/ui/turn-cards/<carta>.webp, style.css [data-card]); sulle carte 1/2, 3/4 e Wild con il giocatore già deciso,
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
  if (kind === 'nemesis') return I18N_IT.trackNemesisName;
  if (kind === 'wild') return who ? I18N_IT.trackWildOf(Number(who.slice(1))) : I18N_IT.trackWildName;
  if (who) return I18N_IT.trackPlayerName(Number(who.slice(1)));
  const [a, b] = pairOptions(kind);
  return I18N_IT.turnPairName(Number(a.slice(1)), Number(b.slice(1)));
}

export function turnDeckBlocked(): boolean {
  return ui.isTransitioning || ui.deckBuilding || !!ui.trackShuffle || modals.length > 0;
}

// Bozza della finestra: copia di mazzo (left, left[0] = cima), carte note (known, parallelo a left), scarti (drawn),
// giocatori delle carte 1/2 e 3/4 (picks), memoria delle coppie (pairNext), storia dei turni del giro (history) e
// attesa (waiting). Niente act() finché non si salva.
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

// Nessuna carta degli scarti è bloccata: rimettendo nel mazzo la carta del turno in corso il turno continua
export function turnPileLocked(_d?: BozzaTurni, _i?: number): boolean {
  return false;
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
  render();
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

// Finestra aperta (per le verifiche e per il ridisegno al cambio di misura)
export let turnScreen: FinestraTurni | null = null;

// Durata della discesa del foglio della finestra
export const TURN_SHEET_MS = 320;

// Fine di un gruppo di animazioni, con un tempo massimo (se il browser non le fa girare, si va avanti lo stesso)
export function animDone(anims: readonly Animation[], ms: number): Promise<unknown> {
  return Promise.race([Promise.all(anims.map(a => a.finished.catch(() => {}))), new Promise(r => setTimeout(r, ms + 150))]);
}

// Simbolo dell'insieme vuoto (∅: cerchio con una barra obliqua che esce dal cerchio), nei posti vuoti di scarti e
// mazzo dei turni; disegnato in SVG, colore del testo
export function emptySetIcon(): HTMLSpanElement {
  const s = el('span', 'ae-turn-empty-icon');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M5 19 L19 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  return s;
}

export function openTurnScreen(): void {
  if (turnDeckBlocked()) return;
  // d.old: carte già note all'apertura (scurite, si spostano solo dalla cima); parallelo a d.left, solo nella finestra
  const fresh = (order: MazzoTurni | BozzaTurni) => { const x = turnDraftFrom(order); x.old = x.known.slice(); return x; };
  const initial = fresh(partita.turnOrder);
  let d = fresh(partita.turnOrder);
  let savedKey = turnDraftKey(d);
  // Fotografia della partita all'apertura: alla chiusura, se il mazzo dei turni è cambiato, diventa l'unico passo di
  // undo della visita (Annulla porta da dopo tutte le modifiche a prima di tutte)
  const before = snapshot();
  let committed = false;
  let sel: Selezione | null = null;   // carta selezionata senza trascinamento
  let press: { card: HTMLElement; source: Selezione['source']; index: number; x: number; y: number; id: number } | null = null; // dito o mouse premuto su una carta, prima che parta il trascinamento
  let drag: { source: Selezione['source']; index: number; ghost: HTMLElement; dx: number; dy: number; w: number; h: number; target: Destinazione | null } | null = null;  // trascinamento in corso
  let shuffling = false; // animazione della mescola in corso
  let closing = false;
  let suppressClick = false;
  let close = () => {};
  const dirty = () => turnDraftKey(d) !== turnDraftKey(initial);

  // Il titolo è "Mazzo dei turni" ("Turno N" è nella copia della testata, sopra)
  const dialog = dialogShell(I18N_IT.turnDeckTitle, '', () => tryClose());
  dialog.classList.add('ae-turn-screen');
  // Tutto tranne la copia della testata sta in un foglio che scende da sotto la barra dei turni
  const sheet = el('div', 'ae-turn-sheet');
  sheet.appendChild(need(dialog.firstChild, 'intestazione della finestra')); // titolo e X
  // Desktop: dentro la colonna centrale della partita (--ae-col)
  const col = app.style.getPropertyValue('--ae-col');
  if (col) dialog.style.setProperty('--ae-turn-col', col);
  // In cima una copia, solo da guardare, della testata (nome nemesi, Turno N, Mazzo, Scarti, Menu) e della barra della
  // fase. La testata è copiata all'apertura; la barra mostra la bozza e si rifà a ogni modifica (trackHolder)
  // (classi di #app da cui dipende lo stile della testata; non quelle di passaggio: scelta 1/2 o 3/4, scossa, scorrimento)
  const copyShell = el('div', ['ae-shell', ...['clear-header', 'is-nemesis-turn'].filter(c => app.classList.contains(c)), 'ae-turn-copy'].join(' '));
  copyShell.appendChild(viewOnlyCopy(byId('topbar', HTMLElement)));
  const trackHolder = el('div', 'ae-turn-copy-track');
  copyShell.appendChild(trackHolder);
  // Nella copia funziona solo il pulsante Menu (il menu si apre sopra la finestra); il resto è solo da guardare
  const copyMenu = query(copyShell, '.ae-menu-button', HTMLElement);
  (function inertExcept(node: Element) {
    [...node.children].forEach(c => {
      if (copyMenu && c === copyMenu) return;
      if (copyMenu && c.contains(copyMenu)) inertExcept(c);
      else { if (c instanceof HTMLElement) c.inert = true; c.setAttribute('aria-hidden', 'true'); }
    });
  })(copyShell);
  if (copyMenu) {
    copyMenu.setAttribute('aria-label', I18N_IT.menu);
    copyMenu.setAttribute('aria-haspopup', 'dialog');
    copyMenu.addEventListener('click', () => {
      if (drag || shuffling || closing) return;
      sel = null;
      draw();
      // Le voci che portano altrove (undo, scarti, vittoria, esci, ricomincia) chiudono prima la finestra; chiudendo
      // il menu si torna qui
      openSideMenu(() => shut());
    });
  }
  dialog.appendChild(copyShell);
  dialog.appendChild(sheet);

  // Scarti e mazzo sulla stessa riga, separati da un segmento verticale. Sopra, "Scarti" a sinistra e "Mazzo turno" a
  // destra (con il simbolo Mescola); si legge da sinistra a destra come la barra dei turni: nel mazzo la carta in cima
  // è la prima a sinistra. Sotto il mazzo "Rivela tutto"
  const row = el('div', 'ae-turn-row');
  const pileArea = el('div', 'ae-turn-area ae-turn-area--pile');
  const pileRow = el('div', 'ae-turn-pile-row');
  pileArea.append(pileRow);
  const divider = el('span', 'ae-turn-divider');
  divider.setAttribute('aria-hidden', 'true');
  const deckArea = el('div', 'ae-turn-area ae-turn-area--deck');
  const shuffleBtn = el('button', 'ae-icon-button ae-turn-shuffle');
  shuffleBtn.type = 'button';
  shuffleBtn.setAttribute('aria-label', I18N_IT.turnShuffleLabel);
  shuffleBtn.title = I18N_IT.turnShuffleDeck;
  shuffleBtn.appendChild(icon('shuffle'));
  shuffleBtn.addEventListener('click', runShuffle);
  // Le scritte "Scarti" e "Mazzo turno" stanno in una riga sopra le carte, ai due lati del segmento verticale
  // (--ae-split, da layoutFan), così non cambiano la larghezza delle carte né lo spazio; Mescola in fondo a destra
  const heads = el('div', 'ae-turn-heads');
  const pileHead = el('h3', 'ae-turn-subtitle ae-turn-head--pile', I18N_IT.turnPileTitle);
  const deckHead = el('h3', 'ae-turn-subtitle ae-turn-head--deck');
  // Le due parole in due elementi, così con .is-two-lines vanno una sotto l'altra; il testo letto resta lo stesso
  {
    const words = I18N_IT.turnDeckRowTitle.split(' ');
    deckHead.append(el('span', 'ae-turn-head-w', words[0]), document.createTextNode(' '), el('span', 'ae-turn-head-w', words.slice(1).join(' ')));
  }
  // Una linea sottile attraversa la riga dei titoli: [linea] SCARTI [linea] cuspide [linea] MAZZO TURNO [Mescola].
  // La cuspide (punta in giù) sta esattamente sopra il segmento verticale tra scarti e mazzo. Decorative (aria-hidden);
  // posizioni da layoutHeads
  const headLines = [0, 1, 2].map(() => {
    const line = el('span', 'ae-turn-head-line');
    line.setAttribute('aria-hidden', 'true');
    return line;
  });
  const cusp = el('span', 'ae-turn-cusp');
  cusp.setAttribute('aria-hidden', 'true');
  // La cuspide è FIGLIA del segmento verticale (.ae-turn-divider): centrata su di lui con left:50% e translateX(-50%),
  // sopra di lui con uno spazio vuoto di --ae-cusp-gap (4px) tra la punta e l'inizio del segmento. Così si muove con la
  // sua stessa transizione e si arrotonda ai pixel insieme a lui (un oggetto a parte, posizionato copiando la posizione
  // del segmento, a densità non intere può stare 1-2px a destra).
  const CUSP_W = 14;
  // Le distanze lette dalla pagina (getBoundingClientRect) si riportano in pixel CSS, quelli degli stili: con uno zoom
  // CSS della pagina sarebbero ingrandite (rapporto tra larghezza misurata e larghezza CSS della riga)
  function pageZoom() {
    const w = row.offsetWidth;
    const z = w ? row.getBoundingClientRect().width / w : 1;
    return z > 0.1 ? z : 1;
  }
  // Due archi di circonferenza identici (raggio 7): il sinistro di centro (0,7), dal punto (0,0) con tangente
  // orizzontale (raccordato alla linea) alla punta (7,7) con tangente verticale; il destro di centro (14,7), dalla punta
  // a (14,0). Mezzo pixel per lo spessore 1px. SVG 14x8 come il viewBox, mai stirato (curva liscia anche ad alta
  // densità: vector-effect). La punta sta --ae-cusp-gap (4px) sopra il segmento: la riga delle carte si sposta in
  // verticale perché il segmento cominci a 28px dall'alto dei titoli (layoutFan)
  const CUSP_H = 8;
  cusp.innerHTML = '<svg viewBox="0 0 14 8" width="14" height="8" focusable="false">' +
    '<path d="M0,0.5 A7,7 0 0 1 7,7.5 A7,7 0 0 1 14,0.5" fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>';
  divider.appendChild(cusp);
  heads.append(...headLines, pileHead, deckHead, shuffleBtn);
  const board = el('div', 'ae-turn-board');
  // Corsia del mazzo: carte in fila (posizioni assolute, così si spostano con una transizione)
  const lane = el('div', 'ae-turn-lane');
  // Carta presa o selezionata: le carte del mazzo si stringono al centro e ai due lati compaiono i posti "Cima" (a
  // sinistra) e "Fondo" (a destra)
  const zoneTop = el('button', 'ae-turn-zone ae-turn-zone--top', I18N_IT.turnTopEnd);
  const zoneBottom = el('button', 'ae-turn-zone ae-turn-zone--bottom', I18N_IT.turnBottomEnd);
  zoneBottom.type = zoneTop.type = 'button';
  zoneBottom.dataset.zone = 'bottom';
  zoneTop.dataset.zone = 'top';
  zoneBottom.setAttribute('aria-label', I18N_IT.turnZoneBottom);
  zoneTop.setAttribute('aria-label', I18N_IT.turnZoneTop);
  const zones: [HTMLButtonElement, 'top' | 'bottom'][] = [[zoneTop, 'top'], [zoneBottom, 'bottom']];
  zones.forEach(([z, type]) => z.addEventListener('click', () => {
    if (!sel || z.hidden) return;
    dropOn({ type }, sel);
  }));
  const revealTop = el('button', 'ae-turn-eye ae-turn-eye--top');
  revealTop.type = 'button';
  revealTop.setAttribute('aria-label', I18N_IT.turnRevealTopLabel);
  revealTop.appendChild(icon('eye'));
  revealTop.addEventListener('click', () => flipChange(() => turnDraftOps.revealTop(d)));
  // Le carte rivelate (o coperte) si girano: la carta com'era ruota fino a mettersi di taglio, poi come è ora ruota da
  // taglio a dritta (rotateY, 140ms + 140ms); più carte una dopo l'altra da sinistra (70ms di distanza)
  const FLIP_HALF_MS = 140;
  function flipChange(op: () => void) {
    if (drag || shuffling || closing) return;
    const before = d.known.slice();
    const oldEls = fanEls.slice();
    op();
    sel = null;
    draw();
    if (reducedMotion.matches || !lane.animate) return;
    let k = 0;
    d.known.forEach((known, i) => {
      if (known === !!before[i] || !fanEls[i] || !oldEls[i]) return;
      flipCard(fanEls[i], oldEls[i], k++ * 70);
    });
  }
  function flipCard(card: HTMLElement, oldCard: HTMLElement, delay: number) {
    // copia della carta com'era (senza ascoltatori), sopra la nuova, finché non è di taglio
    const was = oldCard.cloneNode(true);
    if (!(was instanceof HTMLElement)) return;
    was.classList.add('ae-turn-flip-old');
    was.classList.remove('is-selected', 'is-movable');
    ['data-index', 'data-source', 'aria-label', 'role', 'type'].forEach(a => was.removeAttribute(a));
    was.setAttribute('aria-hidden', 'true');
    was.tabIndex = -1;
    was.style.left = card.style.left;
    was.style.zIndex = card.style.zIndex;
    lane.appendChild(was);
    const p = 'perspective(500px) ';
    const out = was.animate([{ transform: p + 'rotateY(0deg)' }, { transform: p + 'rotateY(90deg)' }],
      { duration: FLIP_HALF_MS, delay, easing: 'ease-in', fill: 'forwards' });
    card.animate([{ transform: p + 'rotateY(-90deg)' }, { transform: p + 'rotateY(0deg)' }],
      { duration: FLIP_HALF_MS, delay: delay + FLIP_HALF_MS, easing: 'ease-out', fill: 'backwards' });
    animDone([out], delay + FLIP_HALF_MS).then(() => was.remove());
  }
  // Segmento verticale dove cadrà la carta (come tra le slide di Canva)
  const insertBar = el('span', 'ae-turn-insert');
  insertBar.setAttribute('aria-hidden', 'true');
  insertBar.hidden = true;
  // Lo stesso segmento in fondo a destra degli scarti, per la carta rivelata del mazzo portata negli scarti
  const pileInsert = el('span', 'ae-turn-insert');
  pileInsert.setAttribute('aria-hidden', 'true');
  pileInsert.hidden = true;
  pileArea.appendChild(pileInsert);
  // Cerchio del posto d'arrivo in fondo a destra degli scarti, con una carta del mazzo in mano (come Cima e Fondo)
  const pileZone = el('span', 'ae-turn-pile-zone');
  pileZone.setAttribute('aria-hidden', 'true');
  pileZone.hidden = true;
  pileArea.appendChild(pileZone);
  // Tocco sugli scarti con una carta del mazzo selezionata: la carta va in fondo agli scarti (col tocco la zona degli
  // scarti è la stessa del trascinamento: tutta l'area a sinistra del segmento)
  row.addEventListener('click', e => {
    if (sel && sel.source === 'deck' && inPileZone(e.clientX, e.clientY, lane.getBoundingClientRect())) dropOn({ type: 'pile' }, sel);
  });
  function inPileZone(x: number, y: number, laneRect: DOMRect) {
    const rr = row.getBoundingClientRect();
    // (centro del segmento nella disposizione finale, non dove si trova a metà transizione)
    const split = rowGeo ? rr.left + rowGeo.split * pageZoom() : (() => { const dv = divider.getBoundingClientRect(); return dv.left + dv.width / 2; })();
    return x >= rr.left - 24 && x < split && inCardBand(y, laneRect.top, laneRect.bottom);
  }
  const revealAll = el('button', 'ae-turn-eye ae-turn-eye--all');
  revealAll.type = 'button';
  revealAll.setAttribute('aria-label', I18N_IT.turnRevealAllLabel);
  // Solo l'occhio, senza scritta (il nome resta per i lettori di schermo); con tutto scoperto diventa l'occhio barrato
  // ("Copri tutto")
  const revealAllEye = icon('eye');
  revealAll.append(revealAllEye);
  const allKnown = () => d.left.length > 0 && d.known.every(Boolean);
  revealAll.addEventListener('click', () => {
    flipChange(() => { if (allKnown()) turnDraftOps.coverAll(d); else turnDraftOps.revealAll(d); });
  });
  // Il pulsante dell'occhio è un rettangolo lungo quanto le carte del mazzo (larghezza da layoutFan)
  const revealRow = el('div', 'ae-turn-reveal-row');
  revealRow.appendChild(revealAll);
  deckArea.append(lane, revealRow);
  row.append(pileArea, divider, deckArea);
  board.append(heads, row);
  // Mazzo vuoto: niente Cima e Fondo; con una carta degli scarti selezionata, un tocco sul mazzo la mette lì
  lane.addEventListener('click', e => {
    const target = e.target;
    if (d.left.length || !sel || sel.source !== 'pile' || (target instanceof Element && target.closest('.ae-turn-card'))) return;
    dropOn({ type: 'top' }, sel);
  });

  const hint = el('p', 'ae-turn-hint', I18N_IT.turnHint);
  hint.setAttribute('aria-live', 'polite');
  const footer = el('div', 'ae-turn-screen-footer');
  const resetBtn = button(I18N_IT.turnResetAll, 'secondary', () => {
    if (drag || shuffling) return;
    d = fresh(initial);
    d.old = need(initial.old, 'carte note all\'apertura').slice();
    sel = null;
    draw();
  });
  footer.append(resetBtn);
  sheet.append(board, hint, footer);

  let fanEls: HTMLElement[] = [];
  let pileEls: HTMLElement[] = [];
  function draw() {
    const n = d.left.length;
    fanEls = d.left.map((kind, i) => {
      const known = d.known[i];
      const card = known ? turnCardFace(kind, -1, 'button', d) : el('span', 'ae-turn-card is-back');
      if (known) {
        if (card instanceof HTMLButtonElement) card.type = 'button';
        // Nota già all'apertura = scurita (60%) e ferma, tranne in cima
        card.classList.toggle('is-old', !!(d.old && d.old[i]));
        card.classList.toggle('is-movable', turnDeckMovable(d, i));
        card.setAttribute('aria-label', I18N_IT.turnDeckCardLabel(turnCardName(kind, -1, d), i + 1, n));
      } else {
        card.setAttribute('role', 'img');
        card.setAttribute('aria-label', I18N_IT.turnDeckCardLabel(I18N_IT.turnCovered, i + 1, n));
      }
      card.dataset.source = 'deck';
      card.dataset.index = String(i);
      card.classList.toggle('is-selected', !!sel && sel.source === 'deck' && sel.index === i);
      return card;
    });
    lane.replaceChildren(...fanEls);
    // Mazzo vuoto: posto tratteggiato largo una carta con il simbolo dell'insieme vuoto ("Mazzo vuoto" resta come nome
    // per i lettori di schermo)
    if (!n) {
      const empty = el('span', 'ae-turn-fan-empty');
      empty.setAttribute('role', 'img');
      empty.setAttribute('aria-label', I18N_IT.turnDeckEmpty);
      empty.appendChild(emptySetIcon());
      lane.appendChild(empty);
    }
    revealTop.hidden = !n || d.known[0];
    insertBar.hidden = true;
    lane.append(revealTop, zoneTop, zoneBottom, insertBar);
    revealAll.disabled = !n;
    // Con una carta sola nel mazzo basta l'occhio sulla carta: niente Rivela tutto
    revealAll.hidden = n < 2;
    revealAllEye.className = 'ae-icon ae-icon--' + (allKnown() ? 'eye-off' : 'eye');
    revealAll.title = allKnown() ? I18N_IT.turnCoverAll : I18N_IT.turnRevealAll;
    revealAll.setAttribute('aria-label', allKnown() ? I18N_IT.turnCoverAllLabel : I18N_IT.turnRevealAllLabel);
    revealAll.classList.toggle('is-cover', allKnown());
    const cur = turnDraftCurrent(d);
    const faces: HTMLElement[] = [];
    const slots = d.drawn.map((kind, i) => {
      const locked = turnPileLocked(d, i);
      const face = turnCardFace(kind, i, locked ? 'span' : 'button', d);
      const name = turnCardName(kind, i, d);
      if (!locked) {
        if (face instanceof HTMLButtonElement) face.type = 'button';
        face.classList.add('is-movable');
      }
      face.setAttribute('aria-label', locked ? I18N_IT.turnLockedLabel(name) : I18N_IT.turnPileCardLabel(name, i === cur));
      face.dataset.source = 'pile';
      face.dataset.index = String(i);
      face.classList.toggle('is-selected', !!sel && sel.source === 'pile' && sel.index === i);
      const slot = el('div', 'ae-turn-pile-slot' + (i === cur ? ' is-current' : '') + (locked ? ' is-locked' : ''));
      slot.appendChild(face);
      if (i === cur) slot.appendChild(el('span', 'ae-turn-pile-note', I18N_IT.turnCurrent));
      faces.push(face);
      return slot;
    });
    // Scarti vuoti: un posto tratteggiato largo una carta, con il simbolo dell'insieme vuoto
    if (slots.length) pileRow.replaceChildren(...slots);
    else {
      const empty = el('span', 'ae-turn-pile-empty');
      empty.setAttribute('role', 'img');
      empty.setAttribute('aria-label', I18N_IT.turnPileEmpty);
      empty.appendChild(emptySetIcon());
      pileRow.replaceChildren(empty);
    }
    pileEls = faces;
    [...fanEls, ...pileEls].forEach(c => {
      if (!c.classList.contains('is-movable')) return;
      c.addEventListener('pointerdown', onPointerDown);
      c.addEventListener('click', onCardClick);
    });
    fanEls.forEach(c => { if (!c.classList.contains('is-movable')) c.addEventListener('click', onCardClick); });
    shuffleBtn.disabled = n < 2 && !d.known.some(Boolean);
    // Con meno di 2 carte nel mazzo non c'è niente da mescolare: il simbolo sparisce e lascia spazio alla scritta
    shuffleBtn.hidden = n < 2;
    heads.classList.toggle('no-shuffle', n < 2);
    resetBtn.disabled = !dirty();
    markTargets(sel);
    hint.textContent = sel ? I18N_IT.turnSelected(selName(sel)) : I18N_IT.turnHint;
    layoutFan();
    // Ogni modifica vale subito nel mazzo dei turni; la selezione da sola non cambia niente
    const key = turnDraftKey(d);
    if (key !== savedKey) { savedKey = key; saveTurnDraft(d); }
    trackHolder.replaceChildren(trackPreviewCopy(d));
  }
  function selName(s: Selezione) {
    return s.source === 'deck' ? turnCardName(d.left[s.index], -1, d) : turnCardName(d.drawn[s.index], s.index, d);
  }
  // Riga del mazzo dei turni. La riga è UNA sequenza di oggetti, da sinistra a destra:
  //   carte degli scarti (o il posto tratteggiato) → [cerchio degli scarti, con una carta del mazzo in mano] →
  //   segmento verticale → [cerchio Cima] → carte del mazzo (o il posto tratteggiato) → [cerchio Fondo] (Cima e Fondo
  //   con una carta in mano). La carta presa resta nella sequenza (segnaposto a righe).
  // Un solo calcolo (rowItems + spaceItems, mazzo-turni-riga.ts): tutte le carte larghe w, i cerchi zd, il segmento
  // 1px; la fila è compatta e centrata: lo spazio tra due oggetti è al massimo TURN_GAP_MAX, tra due carte vicine la
  // metà, misurato sui bordi VISIBILI (con una carta in mano le altre sono all'85%, scalate attorno al centro). Alcuni
  // oggetti non sono in fila ma centrati su un altro (it.on): senza scarti il cerchio degli scarti sul posto
  // tratteggiato; trascinando la prima (ultima) carta del mazzo il cerchio Cima (Fondo) sul suo segnaposto, perché è
  // già lì. w è la più grande (al massimo 64px, al minimo 30px) che lascia almeno TURN_GAP_MIN tra due oggetti in TUTTI
  // gli stati della finestra (a riposo, carta degli scarti in mano, carta del mazzo trascinata o selezionata): così le
  // carte non cambiano misura quando se ne prende una.
  const TURN_W_MAX = 64, TURN_W_MIN = 30;
  // (pallino della guida, 6px, più 2px per lato)
  const TURN_GAP_MIN = 10;
  function zoneD(w: number) { return Math.round(Math.min(14, w * 0.3)); }
  function rowWidth() { return row.clientWidth || 343; }
  // st: { holding: null | 'pile' | 'deck', selected: carta selezionata, dragDeck: carta del mazzo trascinata, dragIndex:
  // sua posizione nel mazzo }
  function rowItems(w: number, st: { holding: Selezione['source'] | null; selected?: Selezione | null; dragDeck?: boolean; dragIndex?: number | null }): OggettoRiga[] {
    const k = d.drawn.length, n = d.left.length;
    const zd = zoneD(w);
    const tight = !!st.holding;
    // carta come si vede: con una carta in mano le altre all'85% (anche il segnaposto), quella selezionata al 100%
    const sc = (source: Selezione['source'], i: number) => !tight ? 1 : (st.selected && st.selected.source === source && st.selected.index === i ? 1 : 0.85);
    const item = (kind: OggettoRiga['kind'], vis: number, i = -1, on?: OggettoRiga): OggettoRiga => ({ kind, i, vis, left: 0, right: 0, ...(on ? { on } : {}) });
    const items: OggettoRiga[] = [];
    if (k) d.drawn.forEach((x, i) => items.push(item('pile', sc('pile', i) * w, i)));
    else items.push(item('pileEmpty', w));
    // Senza scarti il cerchio degli scarti sta al centro del posto tratteggiato
    if (st.holding === 'deck') items.push(k ? item('pileZone', zd) : item('pileZone', zd, -1, items[0]));
    items.push(item('divider', 1));
    // (Cima e Fondo solo se nel mazzo c'è una carta vera oltre al segnaposto della carta trascinata)
    const mReal = n - (st.dragDeck ? 1 : 0);
    const ends = tight && mReal > 0;
    const deckIt = n ? d.left.map((x, i) => item('deck', sc('deck', i) * w, i)) : [item('deckEmpty', w)];
    // Trascinando la carta in cima (in fondo) il cerchio Cima (Fondo) sta sul suo segnaposto
    const ph = st.dragDeck && st.dragIndex !== null && st.dragIndex !== undefined ? st.dragIndex : -1;
    if (ends) items.push(ph === 0 ? item('top', zd, -1, deckIt[0]) : item('top', zd));
    items.push(...deckIt);
    if (ends) items.push(ph === n - 1 ? item('bottom', zd, -1, deckIt[n - 1]) : item('bottom', zd));
    return items;
  }
  function rowGeometry() {
    const k = d.drawn.length, n = d.left.length;
    const W = rowWidth();
    const states: { holding: Selezione['source'] | null; selected?: Selezione; dragDeck?: boolean }[] = [{ holding: null }];
    if (k) states.push({ holding: 'pile', selected: { source: 'pile', index: 0 } });
    if (n) states.push({ holding: 'deck', dragDeck: true }, { holding: 'deck', selected: { source: 'deck', index: 0 } });
    let w = TURN_W_MAX;
    while (w > TURN_W_MIN && !states.every(st => spaceItems(rowItems(w, st), W) >= TURN_GAP_MIN - 1e-6)) w -= 0.5;
    w = Math.max(TURN_W_MIN, w);
    return { k, n, w, h: w * 88 / 63, W };
  }
  // Carte del mazzo da mostrare: tutte, tranne quella del mazzo che si sta trascinando (la sua copia segue il dito e le
  // altre si stringono senza di lei)
  function shownOrder() {
    const order = d.left.map((k, i) => i);
    if (drag && drag.source === 'deck') order.splice(drag.index, 1);
    return order;
  }
  // Carte del mazzo come si VEDONO: con una carta del mazzo trascinata, al suo posto resta un segnaposto grigio chiaro
  // (la carta stessa, .is-dragging), piccolo come le altre. Le destinazioni restano quelle di shownOrder: un posto
  // della fila vista dopo il segnaposto vale uno in meno (prima o dopo il segnaposto = stesso posto)
  function displayOrder() {
    return d.left.map((k, i) => i);
  }
  function placeholderAt() {
    return drag && drag.source === 'deck' ? drag.index : -1;
  }
  // Ultima disposizione (coordinate della riga): centri delle carte del mazzo come si vedono (per il posto d'arrivo),
  // centro del segmento verticale (zona degli scarti)
  let rowGeo: { centers: number[]; split: number; n: number } | null = null;
  // order: non serve (la fila vista è sempre tutto il mazzo, col segnaposto); lifted: carta sollevata.
  // over: destinazione della carta trascinata ({ type: 'top' | 'bottom' | 'pos' | 'pile', index } nella fila VISTA) o null
  function layoutFan(order: number[] = displayOrder(), lifted = -1, over: Destinazione | null = null) {
    void order;
    const g = rowGeometry();
    const { w, h, W } = g;
    const zd = zoneD(w);
    row.style.setProperty('--ae-turn-w', w + 'px');
    row.style.setProperty('--ae-turn-h', h + 'px');
    // Il segmento verticale sporge del 10% sopra le carte; la riga delle carte scende quanto serve perché il segmento
    // cominci a 16 + 8 (cuspide) + 4 (spazio) = 28px dall'alto della riga dei titoli, alta 32px
    const cuspGap = parseFloat(getComputedStyle(divider).getPropertyValue('--ae-cusp-gap')) || 4;
    row.style.marginTop = (16 + CUSP_H + cuspGap - 32 + 0.1 * h) + 'px';
    const holding = drag ? drag.source : sel ? sel.source : null;
    const tight = !!holding;
    const st = { holding, selected: sel, dragDeck: !!drag && drag.source === 'deck', dragIndex: drag ? drag.index : null };
    const items = rowItems(w, st);
    const gap = spaceItems(items, W);
    const one = (kind: OggettoRiga['kind']) => items.find(it => it.kind === kind) || null;
    // (carta: la scatola è larga w e scalata attorno al centro; il bordo visibile è it.left)
    const boxLeft = (it: OggettoRiga) => it.left - (w - it.vis) / 2;
    const dv = need(one('divider'), 'segmento verticale');
    // Scarti: l'area finisce dove comincia il segmento (niente margini), le carte in flusso con un margine sinistro
    // ciascuna (transizione .2s come le carte del mazzo)
    pileArea.style.width = dv.left + 'px';
    divider.style.marginLeft = divider.style.marginRight = '0px';
    const laneOff = dv.left + 1;
    const pileObjs = items.filter(it => it.kind === 'pile' || it.kind === 'pileEmpty');
    const pileNodes = d.drawn.length ? pileEls.map(c => c.parentElement) : [query(pileRow, '.ae-turn-pile-empty', HTMLElement)];
    let prevRight = 0;
    pileObjs.forEach((it, j) => {
      const node = pileNodes[j];
      if (!node) return;
      const bl = it.kind === 'pile' ? boxLeft(it) : it.left;
      node.style.marginLeft = (bl - prevRight) + 'px';
      prevRight = bl + w;
    });
    // Mazzo (coordinate della corsia = riga − laneOff)
    const deckObjs = items.filter(it => it.kind === 'deck');
    const m = deckObjs.length;
    // (posto della guida nella fila vista: 0 = prima della prima carta, m = dopo l'ultima)
    const overIdx = !over ? -1 : over.type === 'top' ? 0 : over.type === 'bottom' ? m : over.type === 'pos' ? over.index : -1;
    // Guida tra due carte del mazzo: quelle due si scostano di TURN_SPREAD ciascuna (la sinistra a sinistra, la destra a
    // destra) per farle spazio; solo da vedere: posti d'arrivo e centri (rowGeo) restano quelli senza scosto
    const spreadAt = tight && over && over.type === 'pos' && overIdx > 0 && overIdx < m ? overIdx : -1;
    const shiftOf = (kk: number) => spreadAt < 0 ? 0 : kk === spreadAt - 1 ? -TURN_SPREAD : kk === spreadAt ? TURN_SPREAD : 0;
    fanEls.forEach(c => c.classList.remove('is-away'));
    deckObjs.forEach((it, kk) => {
      const card = fanEls[it.i];
      if (!card) return;
      card.style.left = (boxLeft(it) + shiftOf(kk) - laneOff) + 'px';
      card.style.zIndex = String(1 + kk);
      card.classList.toggle('is-lifted', it.i === lifted);
      if (it.i === 0) {
        revealTop.style.left = (it.left + it.vis / 2 - laneOff - 22) + 'px';
        revealTop.style.top = (h / 2 - 22) + 'px';
        revealTop.style.zIndex = String(2 + g.n);
      }
    });
    // "Rivela tutto": lungo quanto le carte del mazzo A RIPOSO e sotto di loro, fermo anche con una carta in mano
    const rest = rowItems(w, { holding: null });
    spaceItems(rest, W);
    const restDeck = rest.filter(it => it.kind === 'deck');
    const restFirst = need(restDeck.length ? restDeck[0] : rest.find(it => it.kind === 'deckEmpty'), 'posto del mazzo');
    const restLast = restDeck.length ? restDeck[restDeck.length - 1] : restFirst;
    revealAll.style.width = Math.max(44, restLast.right - restFirst.left) + 'px';
    revealAll.style.marginLeft = (restFirst.left - laneOff) + 'px';
    lane.classList.toggle('is-squeezed', tight);
    // Con una carta in mano (trascinata o selezionata) tutte le altre carte scendono all'85% (.is-holding)
    dialog.classList.toggle('is-holding', tight);
    lane.style.setProperty('--ae-lane-scale', '0.85');
    revealTop.hidden = !g.n || !!d.known[0] || tight;
    lane.style.setProperty('--ae-zone-d', zd + 'px');
    pileArea.style.setProperty('--ae-zone-d', zd + 'px');
    const top = one('top'), bottom = one('bottom');
    zoneTop.hidden = !top;
    zoneBottom.hidden = !bottom;
    if (top) Object.assign(zoneTop.style, { left: (top.left - laneOff) + 'px', width: zd + 'px' });
    if (bottom) Object.assign(zoneBottom.style, { left: (bottom.left - laneOff) + 'px', width: zd + 'px' });
    // Cerchio d'arrivo degli scarti (carta del mazzo in mano) e la sua guida
    const pz = one('pileZone');
    const toPile = !!over && over.type === 'pile';
    pileZone.hidden = !pz;
    // (cerchio sul posto vuoto degli scarti: il simbolo ∅ sotto di lui sparisce)
    pileArea.classList.toggle('has-zone', !!pz);
    pileZone.classList.toggle('is-over', toPile && !!pz);
    if (pz) Object.assign(pileZone.style, { left: pz.left + 'px', top: (h / 2 - zd / 2) + 'px' });
    pileInsert.hidden = !(toPile && pz);
    if (toPile && pz) Object.assign(pileInsert.style, { left: (pz.left + zd / 2 - 3) + 'px', width: '6px', top: '0px', height: h + 'px' });
    const mReal = g.n - (st.dragDeck ? 1 : 0);
    lane.classList.toggle('is-empty-target', tight && !mReal);
    // Titoli: la cuspide sul centro del segmento, "Scarti" a sinistra, "Mazzo turno" a destra
    const split = dv.left + 0.5;
    board.style.setProperty('--ae-split', split + 'px');
    layoutHeads(split);
    const empty = one('deckEmpty');
    if (empty) placeEmpty(empty.left - laneOff, h, w);
    rowGeo = { centers: deckObjs.map(it => it.left + it.vis / 2), split, n: m };
    // Guida (linea-pallino-linea): sul cerchio di Cima o Fondo, oppure a metà tra due carte
    zoneTop.classList.toggle('is-over', !!top && overIdx === 0);
    zoneBottom.classList.toggle('is-over', !!bottom && overIdx === m);
    insertBar.hidden = !tight || !over || toPile;
    if (!insertBar.hidden) {
      let x: number;
      if (!m) x = empty ? empty.left + w / 2 : laneOff;
      else if (overIdx <= 0) x = top ? top.left + zd / 2 : deckObjs[0].left - gap / 2;
      else if (overIdx >= m) x = bottom ? bottom.left + zd / 2 : deckObjs[m - 1].right + gap / 2;
      else x = (deckObjs[overIdx - 1].right + deckObjs[overIdx].left) / 2;
      // (alta come le carte al 100%, dall'alto al basso della carta)
      Object.assign(insertBar.style, { left: (x - laneOff - 3) + 'px', width: '6px', height: h + 'px', top: '0px' });
    }
  }
  // Riga dei titoli. cx = centro del segmento verticale (in coordinate della riga). La cuspide è centrata su cx;
  // "Scarti" sta al centro tra il bordo sinistro e la cuspide, "Mazzo turno" allineata a destra prima di Mescola (o al
  // bordo destro se Mescola non c'è); le scritte restano su una riga, almeno 4px dalla cuspide, e se non ci stanno il
  // carattere scende (fitHead, fino a 8px). I tratti di linea lasciano 6px attorno alle scritte e spariscono se sono più
  // corti di 6px
  const CUSP_HALF = CUSP_W / 2, HEAD_GAP = 4, LINE_PAD = 6, LINE_MIN = 6;
  // Il carattere di una scritta scende subito ma sale solo DOPO lo spostamento di cuspide e linee (0,2s): se salisse
  // subito, la scritta più grande toccherebbe per un attimo la cuspide che si sta ancora spostando. Poi la scritta si
  // rimette al suo posto senza transizione
  let headsGrowTimer: ReturnType<typeof setTimeout> | undefined, headsGrowing = false, lastHeadsCx = 0;
  function fitHeadNoGrow(node: HTMLElement, maxW: number, allowTwo?: boolean) {
    const prevFs = node.style.fontSize, prevLs = node.style.letterSpacing, prevTwo = node.classList.contains('is-two-lines');
    const prevW = textW(node);
    fitHead(node, maxW, allowTwo);
    if (headsGrowing || heads.classList.contains('is-settling') || reducedMotion.matches) return false;
    if (textW(node) > prevW + 0.5) {
      node.style.fontSize = prevFs;
      node.style.letterSpacing = prevLs;
      node.classList.toggle('is-two-lines', prevTwo);
      return true;
    }
    return false;
  }
  function scheduleHeadsGrow() {
    clearTimeout(headsGrowTimer);
    headsGrowTimer = setTimeout(() => {
      if (!dialog.isConnected) return;
      headsGrowing = true;
      heads.classList.add('is-settling');
      layoutHeads(lastHeadsCx);
      void heads.offsetWidth;
      heads.classList.remove('is-settling');
      headsGrowing = false;
    }, 220);
  }
  function layoutHeads(cx: number) {
    lastHeadsCx = cx;
    const W = heads.clientWidth || board.clientWidth;
    // (fino a 4px prima dell'icona di Mescola, non del suo pulsante, che è più largo)
    const iconEl = shuffleBtn.querySelector('.ae-icon');
    const hr = heads.getBoundingClientRect();
    // (senza Mescola la scritta arriva al bordo destro della riga delle carte, mai oltre)
    const right = shuffleBtn.hidden || !iconEl ? W : Math.min(W, (iconEl.getBoundingClientRect().left - hr.left) / pageZoom() - HEAD_GAP);
    // Scarti: tra 0 e la cuspide
    const leftEnd = cx - CUSP_HALF;
    let grow = fitHeadNoGrow(pileHead, Math.max(0, leftEnd - HEAD_GAP));
    const tw = textW(pileHead);
    const x0 = Math.max(0, Math.min((leftEnd - tw) / 2, leftEnd - HEAD_GAP - tw));
    pileHead.style.left = x0 + 'px';
    // Mazzo turno: tra la cuspide e Mescola, allineata a destra. Se su una riga non ci sta va su due, "Mazzo" sopra e
    // "Turno" sotto, allineate a destra; poi, se serve, il carattere scende. Il blocco di due righe è centrato sulla
    // linea dei titoli, a 16,5px dall'alto
    const rightStart = cx + CUSP_HALF;
    grow = fitHeadNoGrow(deckHead, Math.max(0, right - rightStart - HEAD_GAP), true) || grow;
    if (grow) scheduleHeadsGrow();
    deckHead.style.top = deckHead.classList.contains('is-two-lines')
      ? (16.5 - deckHead.getBoundingClientRect().height / pageZoom() / 2) + 'px' : '';
    const tw2 = textW(deckHead);
    const x2 = Math.max(rightStart + HEAD_GAP, right - tw2);
    deckHead.style.left = x2 + 'px';
    // Tratti di linea: [0 → Scarti], [Scarti → cuspide], [cuspide → Mazzo turno]
    const segs = [[0, x0 - LINE_PAD], [x0 + tw + LINE_PAD, leftEnd], [rightStart, x2 - LINE_PAD]];
    segs.forEach(([a, b], i) => {
      const line = headLines[i];
      const len = b - a;
      line.hidden = len < LINE_MIN;
      if (!line.hidden) Object.assign(line.style, { left: a + 'px', width: len + 'px' });
    });
  }
  // Larghezza esatta della scritta in pixel CSS (non scrollWidth, che arrotonda ai pixel interi)
  function textW(node: Element) { return node.getBoundingClientRect().width / pageZoom(); }
  // Scritta che non deve superare maxW: il carattere scende (fino a 8px) finché ci sta. allowTwo ("Mazzo turno"):
  // prima di rimpicciolire si prova su due righe
  function fitHead(node: HTMLElement, maxW: number, allowTwo?: boolean) {
    node.style.fontSize = '';
    node.style.letterSpacing = '';
    node.classList.remove('is-two-lines');
    if (allowTwo && textW(node) > maxW) node.classList.add('is-two-lines');
    let size = parseFloat(getComputedStyle(node).fontSize) || 12;
    for (let i = 0; i < 12 && textW(node) > maxW && size > 8; i++) {
      size = Math.max(8, size - 0.5);
      node.style.fontSize = size + 'px';
    }
    // (ultima risorsa, se a 8px non ci sta ancora: senza spazio tra le lettere)
    if (textW(node) > maxW) node.style.letterSpacing = '0';
  }
  // Posto del mazzo vuoto (tratteggiato, con il simbolo ∅): largo e alto come una carta; left = bordo sinistro del posto
  // nella corsia, dalla disposizione della riga
  function placeEmpty(left: number, h: number, w: number) {
    const e = query(lane, '.ae-turn-fan-empty', HTMLElement);
    if (!e) return;
    Object.assign(e.style, { left: left + 'px', right: 'auto', width: w + 'px', height: h + 'px', transform: 'none' });
  }
  // Posto d'inserimento (0 = in cima, n = in fondo) per la carta che sta in x sul mazzo stretto: il numero di carte il
  // cui centro (nella disposizione finale, in coordinate della riga) sta a sinistra di x; la riga non si sposta durante
  // le transizioni, la corsia sì
  function pileSlotAt(x: number) {
    const t = rowGeo;
    if (!t || !t.n) return 0;
    const rel = (x - row.getBoundingClientRect().left) / pageZoom();
    return t.centers.filter(c => c < rel).length;
  }

  // Destinazioni permesse per la carta s (solo quelle si evidenziano): carta del mazzo = la corsia del mazzo; carta
  // degli scarti = Cima, Fondo e qualunque posto tra le carte del mazzo
  function markTargets(s: Selezione | null) {
    const any = !!s;
    zoneTop.classList.toggle('is-target', any && s.source === 'pile');
    zoneBottom.classList.toggle('is-target', any && s.source === 'pile');
    lane.classList.toggle('is-target', any);
    dialog.classList.toggle('is-choosing', any);
  }
  function dropOn(target: Destinazione, s: Selezione) {
    let ok = false;
    if (s.source === 'deck' && target.type === 'pile') {
      ok = turnDraftOps.deckToPile(d, s.index);
    } else if (s.source === 'deck') {
      const to = target.type === 'pos' ? target.index : target.type === 'bottom' ? d.left.length - 1 : 0;
      ok = turnDraftOps.moveInDeck(d, s.index, to);
    } else {
      // ('pile' non è una posizione del mazzo: vale 0, la cima)
      ok = turnDraftOps.pileToDeck(d, s.index, target.type === 'pos' ? target.index : target.type === 'pile' ? 0 : target.type);
    }
    sel = null;
    draw();
    return ok;
  }
  // Carta (del mazzo o degli scarti) da un evento sulla carta stessa
  function eventCard(e: Event): { card: HTMLElement; source: Selezione['source']; index: number } | null {
    const card = e.currentTarget;
    if (!(card instanceof HTMLElement)) return null;
    return { card, source: card.dataset.source === 'pile' ? 'pile' : 'deck', index: Number(card.dataset.index) };
  }
  // Tocco / Invio: seleziona la carta; con una carta selezionata, toccare una carta del mazzo la mette lì (carta del
  // mazzo: al suo posto; carta degli scarti: nella sua posizione, le altre scendono); toccare di nuovo la stessa carta
  // toglie la selezione
  function onCardClick(e: MouseEvent) {
    if (suppressClick) { suppressClick = false; return; }
    if (shuffling || closing) return;
    const ev = eventCard(e);
    if (!ev) return;
    const { card, source, index } = ev;
    if (sel && sel.source === source && sel.index === index) { sel = null; draw(); return; }
    // (carta degli scarti selezionata: va al posto della carta toccata, che scende di uno; oppure su Cima o Fondo)
    if (sel && source === 'deck') { dropOn({ type: 'pos', index }, sel); return; }
    // (carta del mazzo selezionata, poi una carta degli scarti: va in fondo agli scarti)
    if (sel && sel.source === 'deck' && source === 'pile') { dropOn({ type: 'pile' }, sel); return; }
    if (!card.classList.contains('is-movable')) return;
    sel = { source, index };
    draw();
    const again = query(dialog, `.ae-turn-card[data-source="${source}"][data-index="${index}"]`, HTMLElement);
    if (again) again.focus({ preventScroll: true });
  }

  // Trascinamento: la carta si solleva e segue il dito appena il dito si sposta (senza tenere premuto)
  function onPointerDown(e: PointerEvent) {
    if (e.button > 0 || drag || press || shuffling || closing) return;
    const ev = eventCard(e);
    if (!ev) return;
    press = { card: ev.card, source: ev.source, index: ev.index, x: e.clientX, y: e.clientY, id: e.pointerId };
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  }
  function stopListening() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
  }
  function startDrag() {
    if (!press) return;
    const { card, source, index } = press;
    const r = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    if (!(ghost instanceof HTMLElement)) return;
    ghost.classList.add('ae-turn-ghost');
    ghost.classList.remove('is-old', 'is-away', 'is-lifted', 'is-selected');
    ghost.removeAttribute('id');
    // La copia non deve portarsi dietro il livello (z-index) scritto sulla carta del mazzo dalla fila: con quello
    // (1-6 invece di 1000) resterebbe sotto la finestra e la carta del mazzo trascinata non si vedrebbe
    ghost.style.zIndex = '';
    ghost.style.translate = '';
    ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    document.body.appendChild(ghost);
    // La carta sale sopra il dito (centrata, con il bordo inferiore 16px sopra il dito), così il dito non la copre
    drag = { source, index, ghost, dx: r.width / 2, dy: r.height + 16, w: r.width, h: r.height, target: null };
    card.classList.add('is-dragging');
    sel = null;
    markTargets({ source, index });
    dialog.classList.add('is-dragging', 'is-dragging-' + source);
    press = null;
    // Presa una carta (degli scarti o del mazzo), il mazzo si stringe e compaiono Cima e Fondo
    layoutFan();
    // Piccola vibrazione quando la carta si solleva (solo dopo un tocco vero: altrimenti il browser la blocca)
    const touched = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    if (navigator.vibrate && touched) { try { navigator.vibrate(10); } catch (err) { /* niente vibrazione */ } }
  }
  function hit(rect: DOMRect, x: number, y: number, pad = 12) {
    return x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad;
  }
  function onPointerMove(e: PointerEvent) {
    if (press && !drag) {
      // Il dito si è spostato: parte il trascinamento; finché è fermo resta un tocco
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < TURN_DRAG_PX) return;
      startDrag();
    }
    if (!drag) return;
    e.preventDefault();
    drag.ghost.style.transform = `translate(${e.clientX - drag.dx - parseFloat(drag.ghost.style.left)}px, ${e.clientY - drag.dy - parseFloat(drag.ghost.style.top)}px)`;
    // La carta si porta ovunque nello schermo; il rilascio riesce solo su una destinazione valida. Conta dove sta la
    // carta (il suo centro, sopra il dito), non il dito. Carta del mazzo e carta degli scarti si spostano allo stesso
    // modo: su Cima o Fondo (ai lati) o in mezzo alle altre carte del mazzo (strette), nel posto sotto la carta; il
    // segmento dorato dice dove
    const x = e.clientX - drag.dx + drag.w / 2;
    const y = e.clientY - drag.dy + drag.h / 2;
    const order = shownOrder();
    const ph = placeholderAt();
    let target: Destinazione | null = null;
    let shownPos = -1; // posto nella fila VISTA (con il segnaposto), per la guida e le carte che si allargano
    const laneRect = lane.getBoundingClientRect();
    // Carta del mazzo sugli scarti (zona "scarti" = tutta l'area a sinistra del centro del segmento verticale, nella
    // fascia verticale delle zone di rilascio: nessuna fascia morta tra scarti e Cima): va in fondo a destra degli
    // scarti (il turno di quella carta è perso). Tutte le zone valgono solo nella fascia delle carte più 24px sopra e
    // 32px sotto (inCardBand)
    if (drag.source === 'deck' && inPileZone(x, y, laneRect)) target = { type: 'pile' };
    else if (!inCardBand(y, laneRect.top, laneRect.bottom)) target = null;
    else if (hit(zoneTop.getBoundingClientRect(), x, y, 6) && !zoneTop.hidden) target = { type: 'top' };
    else if (hit(zoneBottom.getBoundingClientRect(), x, y, 6) && !zoneBottom.hidden) target = { type: 'bottom' };
    else if (x >= laneRect.left - 24 && x <= laneRect.right + 24) {
      if (order.length) {
        shownPos = pileSlotAt(x);
        target = { type: 'pos', index: ph >= 0 && shownPos > ph ? shownPos - 1 : shownPos };
        // La carta in cima (in fondo) presa e lasciata al suo posto = Cima (Fondo), il cerchio sul segnaposto
        const last = d.left.length - 1;
        if (ph === 0 && target.type === 'pos' && target.index === 0 && !zoneTop.hidden) { target = { type: 'top' }; shownPos = -1; }
        else if (ph === last && target.type === 'pos' && target.index === last && !zoneBottom.hidden) { target = { type: 'bottom' }; shownPos = -1; }
      } else target = { type: 'top' };
    }
    drag.target = target;
    lane.classList.toggle('is-over', !!target && target.type === 'pos');
    layoutFan(displayOrder(), -1, shownPos >= 0 ? { type: 'pos', index: shownPos } : target);
  }
  function endDrag(apply: boolean) {
    stopListening();
    if (press) press = null;
    if (!drag) return;
    const { source, index, target, ghost } = drag;
    ghost.remove();
    drag = null;
    dialog.classList.remove('is-dragging', 'is-dragging-deck', 'is-dragging-pile');
    lane.classList.remove('is-over');
    // Il click che segue il rilascio non deve selezionare la carta
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (apply && target) dropOn(target, { source, index });
    else draw(); // fuori zona: la carta torna al suo posto
  }
  function onPointerUp() { endDrag(true); }
  function onPointerCancel() { endDrag(false); }

  // Mescola con animazione: le carte si raccolgono al centro, si mischiano due volte (metà a sinistra, metà a destra) e
  // si riaprono, coperte. Durante l'animazione la finestra non si tocca
  function runShuffle() {
    if (drag || shuffling || closing) return;
    const g = rowGeometry();
    const animate = !reducedMotion.matches && !!lane.animate && fanEls.length > 1;
    if (!animate) { turnDraftOps.shuffle(d); sel = null; draw(); return; }
    shuffling = true;
    dialog.classList.add('is-shuffling');
    // Le carte sono dritte in fila; si raccolgono al centro della fila (media delle posizioni: la fila è equispaziata)
    const cx = fanEls.reduce((s, c) => s + parseFloat(c.style.left || '0'), 0) / Math.max(1, fanEls.length);
    const toCenter = (c: HTMLElement) => (cx - parseFloat(c.style.left)) + 'px';
    const gather = fanEls.map(c => c.animate([{ translate: '0 0' }, { translate: toCenter(c) + ' 0' }],
      { duration: 220, easing: 'ease-in', fill: 'forwards' }));
    animDone(gather, 220).then(() => {
      if (closing || !dialog.isConnected) { shuffling = false; return; }
      turnDraftOps.shuffle(d);
      sel = null;
      draw();
      const s = Math.max(14, g.w * 0.45);
      const riffle = fanEls.map((c, i) => {
        const dx = toCenter(c);
        const side = (i % 2 ? 1 : -1) * s;
        const off = `calc(${dx} + ${side}px) -6px`;
        return c.animate([
          { translate: dx + ' 0', offset: 0 }, { translate: off, offset: .16 }, { translate: dx + ' 0', offset: .32 },
          { translate: off, offset: .48 }, { translate: dx + ' 0', offset: .64 }, { translate: '0 0', offset: 1 }
        ], { duration: 820, easing: 'ease-in-out' });
      });
      return animDone(riffle, 820);
    }).then(() => {
      shuffling = false;
      dialog.classList.remove('is-shuffling');
    });
  }

  // Chiusura: le modifiche sono già valide (niente "Uscire senza salvare?"). Con la X o Esc il foglio risale sotto la
  // barra dei turni; dal Menu (voci che portano altrove) si chiude subito
  function shut() {
    endDrag(false);
    window.removeEventListener('resize', onResize);
    commitUndo();
    turnScreen = null;
    close();
  }
  // Un solo passo di undo per la visita: lo stato di prima, se alla fine il mazzo dei turni è diverso
  function commitUndo() {
    if (committed) return;
    committed = true;
    if (!dirty()) return;
    aggiungiPassoUndo(before);
  }
  function tryClose() {
    if (drag) { endDrag(false); return; }
    if (closing) return;
    closing = true;
    if (reducedMotion.matches || !sheet.animate) { shut(); return; }
    const a = sheet.animate([{ transform: 'none' }, { transform: 'translateY(-100%)' }],
      { duration: TURN_SHEET_MS * 0.7, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' });
    need(dialog.parentElement, 'sfondo della finestra').classList.add('is-closing');
    animDone([a], TURN_SHEET_MS * 0.7).then(shut);
  }
  // Esc / Indietro: prima si annulla il trascinamento o la selezione, poi si prova a chiudere
  function onCancel() {
    if (drag) { endDrag(false); return; }
    if (shuffling) return;
    if (sel) { sel = null; draw(); return; }
    tryClose();
  }
  // Anche il nome della nemesi nella copia della testata si adatta alla colonna (fitPhaseName)
  function onResize() { if (!drag) layoutFan(); fitPhaseName(copyShell); }

  // Tenendo premuta una carta il telefono non deve aprire il menu del browser
  dialog.addEventListener('contextmenu', e => { const t = e.target; if (t instanceof Element && t.closest('.ae-turn-card')) e.preventDefault(); });
  close = openModal(dialog, { onCancel, closeOnScrim: false });
  need(dialog.parentElement, 'sfondo della finestra').classList.add('ae-turn-screen-backdrop');
  window.addEventListener('resize', onResize);
  // Il primo disegno mette scritte, linea e cuspide al loro posto senza transizione: le transizioni valgono solo per gli
  // spostamenti successivi, come quello del segmento con una carta del mazzo in mano
  heads.classList.add('is-settling');
  draw();
  void heads.offsetWidth;
  heads.classList.remove('is-settling');
  fitPhaseName(copyShell);
  // Il foglio scende dall'alto, da sotto la copia della testata e della barra dei turni
  if (!reducedMotion.matches && sheet.animate) {
    sheet.animate([{ transform: 'translateY(-100%)' }, { transform: 'none' }],
      { duration: TURN_SHEET_MS, easing: 'cubic-bezier(.2, 0, 0, 1)' });
  }
  turnScreen = { dialog, get draft() { return d; }, dirty, tryClose, onCancel, shuffle: runShuffle,
    get shuffling() { return shuffling; } };
}

// Finestra "Chi gioca questo turno?": esce una carta 1/2 o 3/4 senza giocatore. Al centro due carte grandi come quelle
// della fascia piccola (bordo nero, colore del giocatore scurito, numero nero al centro). Finché non si sceglie è tutto
// disattivato (inert) tranne la scelta e il pulsante Menu; la testata resta sopra l'oscuramento. Elementi creati in
// avvio()
export let pairChoice: HTMLDivElement;
export let pairChoicePanel: HTMLDivElement;
export let pairChoiceTitle: HTMLHeadingElement;
export let pairChoiceCards: HTMLDivElement;

// La finestra scende e si trasforma nel pulsante diviso in due. Una copia della finestra parte dalla sua posizione e si
// stringe/allunga fino al pulsante, sfumando; il pulsante compare mentre lei arriva
export const PAIR_DOCK_MS = 420;

export function animatePairToDock(from: DOMRect): void {
  const to = pairDock.getBoundingClientRect();
  if (reducedMotion.matches || !document.body.animate || !from.width || !to.width) return;
  const ghost = pairChoicePanel.cloneNode(true);
  if (!(ghost instanceof HTMLElement)) return;
  ghost.removeAttribute('id');
  ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  ghost.setAttribute('aria-hidden', 'true');
  ghost.classList.add('ae-pair-ghost');
  Object.assign(ghost.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
  document.body.appendChild(ghost);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const anim = ghost.animate([
    { transform: 'none', opacity: 1 },
    { transform: `translate(${dx * .7}px, ${dy * .7}px) scale(${1 + (sx - 1) * .7}, ${1 + (sy - 1) * .7})`, opacity: .9, offset: .7 },
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0 }
  ], { duration: PAIR_DOCK_MS, easing: 'cubic-bezier(.4, 0, .2, 1)' });
  anim.onfinish = () => ghost.remove();
  setTimeout(() => ghost.remove(), PAIR_DOCK_MS + 200);
  pairDock.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 0, transform: 'scale(.96)', offset: .55 },
    { opacity: 1, transform: 'none' }], { duration: PAIR_DOCK_MS, easing: 'ease-out' });
}

// Pulsante diviso in due ("Giocatore x | Giocatore y") con la scelta ridotta, creato in avvio()
export let pairDock: HTMLDivElement;

export function needsPairChoice(): boolean {
  const cur = currentTurnCard();
  return !partita.resolving && !ui.deckBuilding && isPairCard(cur) && !turnCardPlayer(cur);
}

// Carta 1/2 o 3/4 in attesa di scelta (giro e posizione): la finestra ridotta vale solo per questa carta
export function pairChoiceKey(): string {
  return partita.turnOrder.round + ':' + ((partita.turnOrder.history || []).length - 1);
}

export function pairButtons(kind: CartaTurno | null, cls: string, label: (p: Giocatore) => string): HTMLButtonElement[] {
  return pairOptions(kind).map(p => {
    const b = el('button', cls, label(p));
    b.type = 'button';
    b.dataset.kind = p;
    b.setAttribute('aria-label', I18N_IT.pairChoiceLabel(Number(p.slice(1))));
    b.addEventListener('click', () => chooseTurnPlayer(p));
    return b;
  });
}

export function renderPairChoice(): void {
  const pending = needsPairChoice();
  const minimized = pending && ui.pairMinimized === pairChoiceKey();
  const show = pending && !minimized;
  const wasShown = !pairChoice.hidden;
  pairChoice.hidden = !show;
  app.classList.toggle('is-pair-choice', show);
  // Scelta ridotta nel pulsante in basso: niente carte e niente pesca dal mazzo (cardControls, openCardDialog, mazzo)
  app.classList.toggle('is-pair-pending', minimized);
  mainEl.inert = show;
  const dock = query(document, '.ae-dock', HTMLElement);
  if (dock) dock.inert = show;
  headerPiles.inert = show;
  // Pulsante grande: sparisce con la finestra aperta; con la finestra ridotta lo sostituiscono i due giocatori
  // (con la finestra aperta resta il suo spazio, invisibile, così le carte sotto non cambiano misura)
  nemesisBtn.style.visibility = show ? 'hidden' : '';
  if (minimized) nemesisBtn.hidden = true;
  pairDock.hidden = !minimized;
  // (con la scelta in sospeso la carta in corso è una carta 1/2 o 3/4: String la scrive come prima nel dataset)
  const curCard = currentTurnCard();
  if (minimized && pairDock.dataset.kind !== curCard) {
    pairDock.dataset.kind = String(curCard);
    pairDock.replaceChildren(...pairButtons(curCard, 'ae-button ae-pair-half',
      p => I18N_IT.trackPlayerName(Number(p.slice(1)))));
  }
  if (!minimized) delete pairDock.dataset.kind;
  if (!show) return;
  // Misura delle carte della fascia piccola (52px sul telefono)
  const small = document.querySelector('.ae-compact-rail .ae-queue-item');
  const w = small && small.getBoundingClientRect().width ? small.getBoundingClientRect().width : 52;
  pairChoice.style.setProperty('--ae-pick-w', w + 'px');
  const kind = currentTurnCard();
  if (pairChoiceCards.dataset.kind !== kind) {
    pairChoiceCards.dataset.kind = String(kind);
    pairChoiceCards.replaceChildren(...pairButtons(kind, 'ae-pair-pick', p => p.slice(1)));
  }
  if (!wasShown) {
    announce(I18N_IT.pairChoiceTitle);
    const first = pairChoiceCards.firstChild;
    if (first instanceof HTMLElement) first.focus({ preventScroll: true });
    else throw new TypeError('scelta del giocatore senza pulsanti');
  }
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  pairChoice = el('div', 'ae-pair-choice');
  pairChoice.hidden = true;
  pairChoicePanel = el('div', 'ae-pair-choice-panel');
  pairChoicePanel.setAttribute('role', 'dialog');
  pairChoicePanel.setAttribute('aria-labelledby', 'ae-pair-choice-title');
  pairChoiceTitle = el('h2', 'ae-pair-choice-title', I18N_IT.pairChoiceTitle);
  pairChoiceTitle.id = 'ae-pair-choice-title';
  pairChoiceCards = el('div', 'ae-pair-choice-cards');
  pairChoicePanel.append(pairChoiceTitle, pairChoiceCards);
  pairChoice.appendChild(pairChoicePanel);
  app.appendChild(pairChoice);

  // Toccando fuori dalla finestra la scelta scende nel pulsante grande in basso, diviso in due
  // ("Giocatore x | Giocatore y"); l'app si può usare, ma non si toccano le carte e non si pesca dal mazzo
  pairChoice.addEventListener('click', e => {
    if (e.target !== pairChoice || !needsPairChoice() || ui.isTransitioning) return;
    const from = pairChoicePanel.getBoundingClientRect();
    ui.pairMinimized = pairChoiceKey();
    render();
    animatePairToDock(from);
    const first = pairDock.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  });

  pairDock = el('div', 'ae-pair-dock');
  pairDock.setAttribute('role', 'group');
  pairDock.setAttribute('aria-label', I18N_IT.pairChoiceTitle);
  pairDock.hidden = true;
  nemesisBtn.after(pairDock);
}
