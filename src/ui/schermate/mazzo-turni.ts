// ui/schermate/mazzo-turni.ts: la schermata del mazzo dei turni (dalla barra dei turni): apertura (elementi, stato della
// finestra, gestori), discesa del foglio, chiusura con un solo passo di undo per la visita, Esc e Indietro. Disegno della
// riga in mazzo-turni-disegno.ts, tocchi, trascinamento e Mescola in mazzo-turni-trascina.ts, bozza e stato in
// mazzo-turni-bozza.ts.
// Livello 5 (ui/schermate/). Dipende da: stato/partita.ts, ui/ base (testi, pagina, dom, ridisegno: apriMenuLaterale
// dalla copia della testata), ui/componenti (animazioni, dialoghi, testata), i file di supporto mazzo-turni-*.ts.
// Usato da: navigazione (tocco sulla barra dei turni).

import { T } from '../testi.ts';
import { awaitingTurnCard, aggiungiPassoUndo, currentTurnCard, isPairCard, partita, snapshot,
  turnCardPlayer } from '../../stato/partita.ts';
import { pairChoiceKey } from '../componenti/barra-turni.ts';
import { button, dialogShell, modals, openModal } from '../componenti/dialoghi.ts';
import { fitPhaseName } from '../componenti/testata.ts';
import type { BozzaTurni, MazzoTurni } from '../../tipi/partita.ts';
import { app, byId, pulsantePrincipale, reducedMotion, ui } from '../pagina.ts';
import { animDone } from '../componenti/animazioni.ts';
import { el, icon, need, query } from '../dom.ts';
import { apriMenuLaterale, passaAlTurnoNemesi, richiediRidisegno } from '../ridisegno.ts';
import { impostaMazzoTurniAperto } from '../navigazione-stato.ts';
import { turnDraftFrom, turnDraftKey, turnDraftOps, viewOnlyCopy } from './mazzo-turni-bozza.ts';
import type { Finestra } from './mazzo-turni-bozza.ts';
import { draw, flipChange, inPileZone, layoutFan } from './mazzo-turni-disegno.ts';
import { avviaPesca } from './mazzo-turni-pesca.ts';
import { dropOn, endDrag, onCardClick, onPointerCancel, onPointerDown, onPointerMove, onPointerUp,
  runShuffle } from './mazzo-turni-trascina.ts';

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

// Modalità pesca: la schermata si apre da sola e pesca il turno dopo (avviaPesca); fine dice cosa fare dopo la chiusura
export interface OpzioniApertura {
  pesca?: { fine: () => void };
}

export function turnDeckBlocked(): boolean {
  return ui.isTransitioning || ui.deckBuilding || !!ui.trackShuffle || modals.length > 0;
}

// Finestra aperta (per le verifiche e per il ridisegno al cambio di misura)
export let turnScreen: FinestraTurni | null = null;

// Durata della discesa del foglio della finestra
export const TURN_SHEET_MS = 320;

// Apre la finestra: crea gli elementi e lo stato (Finestra, mazzo-turni-bozza.ts), registra i gestori, la disegna
// (mazzo-turni-disegno.ts) e fa scendere il foglio. Tocchi e trascinamenti: mazzo-turni-trascina.ts
export function openTurnScreen(opzioni: OpzioniApertura = {}): void {
  if (turnDeckBlocked()) return;
  // d.old: carte già note all'apertura (scurite, si spostano solo dalla cima); parallelo a d.left, solo nella finestra
  const fresh = (order: MazzoTurni | BozzaTurni) => { const x = turnDraftFrom(order); x.old = x.known.slice(); return x; };
  const initial = fresh(partita.turnOrder);
  const d = fresh(partita.turnOrder);

  // Il titolo è "Mazzo dei turni" ("Turno N" è nella copia della testata, sopra)
  const dialog = dialogShell(T.turnDeckTitle, '', () => tryClose(f));
  dialog.classList.add('ae-turn-screen');
  // In modalità pesca i comandi di gestione non servono: restano il mazzo, gli scarti e la linea del tempo
  if (opzioni.pesca) dialog.classList.add('is-pesca');
  // Tutto tranne la copia della testata sta in un foglio che scende da sotto la barra dei turni
  const sheet = el('div', 'ae-turn-sheet');
  sheet.appendChild(need(dialog.firstChild, 'intestazione della finestra')); // titolo e X
  // Desktop: dentro la colonna centrale della partita (--ae-col)
  const col = app.style.getPropertyValue('--ae-col');
  if (col) dialog.style.setProperty('--ae-turn-col', col);
  // In cima una copia, solo da guardare, della testata (nome nemesi, Turno N, Mazzo, Scarti, Menu) e della barra della
  // fase. La testata è copiata all'apertura; la barra mostra la bozza e si rifà a ogni modifica (trackHolder)
  // (classi di #app da cui dipende lo stile della testata; non quelle di passaggio: scelta 1/2 o 3/4, scossa, scorrimento)
  const copyShell = el('div', ['ae-shell', ...['clear-header'].filter(c => app.classList.contains(c)), 'ae-turn-copy'].join(' '));
  copyShell.appendChild(viewOnlyCopy(byId('topbar', HTMLElement)));
  const trackHolder = el('div', 'ae-turn-copy-track');
  copyShell.appendChild(trackHolder);
  // Un tocco sulla barra dei turni chiude la finestra (come la X; la barra dentro è inerte, il tocco arriva al contenitore)
  trackHolder.addEventListener('click', () => tryClose(f));
  // Nella copia funziona solo il pulsante Menu (il menu si apre sopra la finestra); il resto è solo da guardare
  const copyMenu = query(copyShell, '.ae-menu-button', HTMLElement);
  (function inertExcept(node: Element) {
    [...node.children].forEach(c => {
      if (copyMenu && c === copyMenu) return;
      if (copyMenu && c.contains(copyMenu)) inertExcept(c);
      else { if (c instanceof HTMLElement) c.inert = true; c.setAttribute('aria-hidden', 'true'); }
    });
  })(copyShell);
  // La barra dei turni della copia chiude la finestra: il contenitore non è inerte (la barra dentro è solo da guardare)
  trackHolder.inert = false;
  trackHolder.removeAttribute('aria-hidden');
  trackHolder.setAttribute('role', 'button');
  trackHolder.setAttribute('aria-label', T.close);
  if (copyMenu) {
    copyMenu.setAttribute('aria-label', T.menu);
    copyMenu.setAttribute('aria-haspopup', 'dialog');
    copyMenu.addEventListener('click', () => {
      if (f.drag || f.shuffling || f.closing || f.pesca?.busy) return;
      f.sel = null;
      draw(f);
      // Le voci che portano altrove (undo, scarti, vittoria, esci, ricomincia) chiudono prima la finestra; chiudendo
      // il menu si torna qui
      apriMenuLaterale(() => shut(f));
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
  shuffleBtn.setAttribute('aria-label', T.turnShuffleLabel);
  shuffleBtn.title = T.turnShuffleDeck;
  shuffleBtn.appendChild(icon('shuffle'));
  shuffleBtn.addEventListener('click', () => runShuffle(f));
  // Le scritte "Scarti" e "Mazzo turno" stanno in una riga sopra le carte, ai due lati del segmento verticale
  // (--ae-split, da layoutFan), così non cambiano la larghezza delle carte né lo spazio; Mescola in fondo a destra
  const heads = el('div', 'ae-turn-heads');
  const pileHead = el('h3', 'ae-turn-subtitle ae-turn-head--pile', T.turnPileTitle);
  const deckHead = el('h3', 'ae-turn-subtitle ae-turn-head--deck');
  // Le due parole in due elementi, così con .is-two-lines vanno una sotto l'altra; il testo letto resta lo stesso
  {
    const words = T.turnDeckRowTitle.split(' ');
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
  // Due archi di circonferenza identici (raggio 7): il sinistro di centro (0,7), dal punto (0,0) con tangente
  // orizzontale (raccordato alla linea) alla punta (7,7) con tangente verticale; il destro di centro (14,7), dalla punta
  // a (14,0). Mezzo pixel per lo spessore 1px. SVG 14x8 come il viewBox, mai stirato (curva liscia anche ad alta
  // densità: vector-effect). La punta sta --ae-cusp-gap (4px) sopra il segmento: la riga delle carte si sposta in
  // verticale perché il segmento cominci a 28px dall'alto dei titoli (layoutFan)
  cusp.innerHTML = '<svg viewBox="0 0 14 8" width="14" height="8" focusable="false">' +
    '<path d="M0,0.5 A7,7 0 0 1 7,7.5 A7,7 0 0 1 14,0.5" fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>';
  divider.appendChild(cusp);
  heads.append(...headLines, pileHead, deckHead, shuffleBtn);
  const board = el('div', 'ae-turn-board');
  // Corsia del mazzo: carte in fila (posizioni assolute, così si spostano con una transizione)
  const lane = el('div', 'ae-turn-lane');
  // Carta presa o selezionata: le carte del mazzo si stringono al centro e ai due lati compaiono i posti "Cima" (a
  // sinistra) e "Fondo" (a destra)
  const zoneTop = el('button', 'ae-turn-zone ae-turn-zone--top', T.turnTopEnd);
  const zoneBottom = el('button', 'ae-turn-zone ae-turn-zone--bottom', T.turnBottomEnd);
  zoneBottom.type = zoneTop.type = 'button';
  zoneBottom.dataset.zone = 'bottom';
  zoneTop.dataset.zone = 'top';
  zoneBottom.setAttribute('aria-label', T.turnZoneBottom);
  zoneTop.setAttribute('aria-label', T.turnZoneTop);
  const zones: [HTMLButtonElement, 'top' | 'bottom'][] = [[zoneTop, 'top'], [zoneBottom, 'bottom']];
  zones.forEach(([z, type]) => z.addEventListener('click', () => {
    if (!f.sel || z.hidden) return;
    dropOn(f, { type }, f.sel);
  }));
  const revealTop = el('button', 'ae-turn-eye ae-turn-eye--top');
  revealTop.type = 'button';
  revealTop.setAttribute('aria-label', T.turnRevealTopLabel);
  revealTop.appendChild(icon('eye'));
  revealTop.addEventListener('click', () => flipChange(f, () => turnDraftOps.revealTop(f.d)));
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
    if (f.sel && f.sel.source === 'deck' && inPileZone(f, e.clientX, e.clientY, lane.getBoundingClientRect())) dropOn(f, { type: 'pile' }, f.sel);
  });
  const revealAll = el('button', 'ae-turn-eye ae-turn-eye--all');
  revealAll.type = 'button';
  revealAll.setAttribute('aria-label', T.turnRevealAllLabel);
  // Solo l'occhio, senza scritta (il nome resta per i lettori di schermo); con tutto scoperto diventa l'occhio barrato
  // ("Copri tutto")
  const revealAllEye = icon('eye');
  revealAll.append(revealAllEye);
  revealAll.addEventListener('click', () => {
    flipChange(f, () => { if (f.allKnown()) turnDraftOps.coverAll(f.d); else turnDraftOps.revealAll(f.d); });
  });
  // Il pulsante dell'occhio è un rettangolo lungo quanto le carte del mazzo (larghezza da layoutFan)
  const revealRow = el('div', 'ae-turn-reveal-row');
  revealRow.appendChild(revealAll);
  deckArea.append(lane, revealRow);
  // Linea del tempo sotto le carte (nodi e segmenti, solo da guardare; li dispone layoutTime)
  const time = el('div', 'ae-turn-time');
  time.setAttribute('aria-hidden', 'true');
  row.append(pileArea, divider, deckArea, time);
  board.append(heads, row);
  // Mazzo vuoto: niente Cima e Fondo; con una carta degli scarti selezionata, un tocco sul mazzo la mette lì
  lane.addEventListener('click', e => {
    const target = e.target;
    if (f.d.left.length || !f.sel || f.sel.source !== 'pile' || (target instanceof Element && target.closest('.ae-turn-card'))) return;
    dropOn(f, { type: 'top' }, f.sel);
  });

  // Solo la scritta della carta selezionata (nessun testo istruttivo fisso): vuota quando non c'è selezione
  const hint = el('p', 'ae-turn-hint');
  hint.setAttribute('aria-live', 'polite');
  const footer = el('div', 'ae-turn-screen-footer');
  const resetBtn = button(T.turnResetAll, 'secondary', () => {
    if (f.drag || f.shuffling) return;
    f.d = f.fresh(f.initial);
    f.d.old = need(f.initial.old, 'carte note all\'apertura').slice();
    f.sel = null;
    draw(f);
  });
  footer.append(resetBtn);
  sheet.append(board, hint, footer);

  // Lo stato della finestra (Finestra, mazzo-turni-bozza.ts); i gestori la ricevono quando scattano
  const f: Finestra = {
    d, initial, savedKey: turnDraftKey(d),
    // Fotografia della partita all'apertura: alla chiusura, se il mazzo dei turni è cambiato, diventa l'unico passo di
    // undo della visita (Annulla porta da dopo tutte le modifiche a prima di tutte)
    before: snapshot(), committed: false, fresh,
    dirty: () => turnDraftKey(f.d) !== turnDraftKey(f.initial),
    allKnown: () => f.d.left.length > 0 && f.d.known.every(Boolean),
    sel: null, press: null, drag: null, shuffling: false, closing: false, suppressClick: false, close: () => {},
    pesca: opzioni.pesca ? { busy: true, fine: opzioni.pesca.fine } : undefined,
    fanEls: [], pileEls: [], rowGeo: null, headsGrowTimer: undefined, headsGrowing: false, lastHeadsCx: 0,
    dialog, sheet, copyShell, trackHolder, copyMenu, row, pileArea, pileRow, divider, deckArea, shuffleBtn, heads, pileHead,
    deckHead, headLines, cusp, board, lane, zoneTop, zoneBottom, revealTop, insertBar, pileInsert, pileZone, revealAll,
    revealAllEye, revealRow, time, hint, footer, resetBtn,
    h: {
      onCardClick: e => onCardClick(f, e),
      onPointerDown: e => onPointerDown(f, e),
      onPointerMove: e => onPointerMove(f, e),
      onPointerUp: () => onPointerUp(f),
      onPointerCancel: () => onPointerCancel(f),
      onResize: () => onResize(f),
      shut: () => shut(f),
      runShuffle: () => runShuffle(f)
    }
  };

  // Tenendo premuta una carta il telefono non deve aprire il menu del browser
  dialog.addEventListener('contextmenu', e => { const t = e.target; if (t instanceof Element && t.closest('.ae-turn-card')) e.preventDefault(); });
  f.close = openModal(dialog, { onCancel: () => onCancel(f), closeOnScrim: false });
  need(dialog.parentElement, 'sfondo della finestra').classList.add('ae-turn-screen-backdrop');
  window.addEventListener('resize', f.h.onResize);
  // Il primo disegno mette scritte, linea e cuspide al loro posto senza transizione: le transizioni valgono solo per gli
  // spostamenti successivi, come quello del segmento con una carta del mazzo in mano
  heads.classList.add('is-settling');
  draw(f);
  void heads.offsetWidth;
  heads.classList.remove('is-settling');
  fitPhaseName(copyShell);
  // Il foglio scende dall'alto, da sotto la copia della testata e della barra dei turni
  if (!reducedMotion.matches && sheet.animate) {
    sheet.animate([{ transform: 'translateY(-100%)' }, { transform: 'none' }],
      { duration: TURN_SHEET_MS, easing: 'cubic-bezier(.2, 0, 0, 1)' });
  }
  turnScreen = { dialog, get draft() { return f.d; }, dirty: f.dirty, tryClose: () => tryClose(f), onCancel: () => onCancel(f),
    shuffle: f.h.runShuffle, get shuffling() { return f.shuffling; } };
  impostaMazzoTurniAperto(true);
  // Modalità pesca: la sequenza parte da sola; a fine chiude la schermata (tryClose)
  if (f.pesca) avviaPesca(f, () => tryClose(f));
}

// Apre la schermata in modalità pesca per la carta del nuovo turno (dopo "Fine turno", o da "Pesca la prima carta turno"):
// nessun tocco per pescare; a fine pesca la schermata si chiude e si torna alla partita (passaAlTurnoNemesi se il turno è
// della nemesi)
export function openDrawTurn(): void {
  if (ui.pescaTurnoAperta || turnDeckBlocked() || ui.deckBuilding || partita.resolving || !awaitingTurnCard()) return;
  ui.pescaTurnoAperta = true;
  app.classList.add('is-draw-turn');
  openTurnScreen({ pesca: { fine: () => {
    ui.pescaTurnoAperta = false;
    app.classList.remove('is-draw-turn');
    if (partita.resolving) { passaAlTurnoNemesi(); return; }
    // Carta 1/2 o 3/4 non ancora scelta (schermata chiusa prima): la scelta scende nei pulsanti in basso
    const kind = currentTurnCard();
    if (isPairCard(kind) && !turnCardPlayer(kind)) ui.pairMinimized = pairChoiceKey();
    richiediRidisegno();
    pulsantePrincipale.focus({ preventScroll: true });
  } } });
}

// Chiusura: le modifiche sono già valide (niente "Uscire senza salvare?"). Con la X o Esc il foglio risale sotto la
// barra dei turni; dal Menu (voci che portano altrove) si chiude subito
function shut(f: Finestra): void {
  endDrag(f, false);
  window.removeEventListener('resize', f.h.onResize);
  commitUndo(f);
  turnScreen = null;
  impostaMazzoTurniAperto(false);
  f.close();
  f.pesca?.fine();
}
// Un solo passo di undo per la visita: lo stato di prima, se alla fine il mazzo dei turni è diverso
function commitUndo(f: Finestra): void {
  if (f.committed) return;
  f.committed = true;
  if (!f.dirty()) return;
  aggiungiPassoUndo(f.before);
}
function tryClose(f: Finestra): void {
  if (f.drag) { endDrag(f, false); return; }
  if (f.closing) return;
  // Pesca in corso: si chiude solo mentre si attende la scelta del giocatore (la scelta resta da fare in basso)
  if (f.pesca?.busy) {
    if (!f.pesca.lascia) return;
    const lascia = f.pesca.lascia;
    f.pesca.lascia = undefined;
    lascia();
  }
  f.closing = true;
  if (reducedMotion.matches || !f.sheet.animate) { shut(f); return; }
  const a = f.sheet.animate([{ transform: 'none' }, { transform: 'translateY(-100%)' }],
    { duration: TURN_SHEET_MS * 0.7, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' });
  need(f.dialog.parentElement, 'sfondo della finestra').classList.add('is-closing');
  animDone([a], TURN_SHEET_MS * 0.7).then(f.h.shut);
}
// Esc / Indietro: prima si annulla il trascinamento o la selezione, poi si prova a chiudere
function onCancel(f: Finestra): void {
  if (f.drag) { endDrag(f, false); return; }
  if (f.shuffling) return;
  if (f.sel) { f.sel = null; draw(f); return; }
  tryClose(f);
}
// Anche il nome della nemesi nella copia della testata si adatta alla colonna (fitPhaseName)
function onResize(f: Finestra): void { if (!f.drag) layoutFan(f); fitPhaseName(f.copyShell); }
