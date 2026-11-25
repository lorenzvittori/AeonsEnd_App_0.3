// ui/finestre/menu-laterale.ts: il menu laterale della partita (turno e mazzo, Annulla, Scarti, Nemesi uccisa,
// Ricomincia, sfondi e dorso, Esci), con l'uscita animata, lo swipe per chiuderlo e la X sopra il pulsante Menu; il
// pulsante da tenere premuto (holdToConfirm).
// Le voci che portano altrove usano gli agganci (menu iniziale, fine partita, ricomincia il mazzo o lo scenario).
// Livello 4 (ui/finestre/). Dipende da: stato/partita.ts (lettura), ui/ base (testi, pagina, dom, ridisegno),
// ui/componenti (animazioni, dialoghi, pesca-undo, ripristino, scarti, sfondi). Usato da: navigazione (pulsante Menu,
// aggancio apriMenuLaterale).

import { T } from '../testi.ts';
import { partita } from '../../stato/partita.ts';
import { menuBtn, reducedMotion, ui } from '../pagina.ts';
import { el } from '../dom.ts';
import { mostraFinePartita, ricominciaMazzo, ricominciaScenario, vaiAlMenuIniziale } from '../ridisegno.ts';
import { animDone, buzz } from '../componenti/animazioni.ts';
import { button, dialogShell, openModal } from '../componenti/dialoghi.ts';
import { openExitConfirm, openUndoFloat } from '../componenti/pesca-undo.ts';
import { undo } from '../componenti/ripristino.ts';
import { openDiscard } from '../componenti/scarti.ts';
import { backgroundChoiceButton, cardBackChoiceButton, GRAVEHOLD_BG_CHOICE } from '../componenti/sfondi.ts';

// Durata dell'uscita animata del menu laterale
export const SIDE_MENU_OUT_MS = 220;

// leave (facoltativo) = cosa chiudere prima di una voce che porta altrove (Menu aperto dalla finestra del mazzo dei
// turni: la finestra si chiude prima di undo, scarti, vittoria, esci, ricomincia)
export function openSideMenu(leave?: () => void): void {
  if (ui.isTransitioning) return;
  let close = () => {};
  const cancel = () => close();
  const go = () => { close(); if (typeof leave === 'function') leave(); };
  const panel = dialogShell(T.menu, '', cancel, { displayTitle: false });
  panel.classList.add('ae-side-menu');
  const statsList = el('dl', 'ae-side-stats');
  statsList.append(el('dt', '', T.menuTurn), el('dd', '', String(partita.turn)),
    el('dt', '', T.menuDeck), el('dd', '', String(partita.deck.length)));
  // Sfondo: anteprima dello sfondo scelto con il nome; si tocca per scegliere tra le anteprime di tutti gli sfondi
  const bgRow = el('div', 'ae-side-field ae-side-field--row');
  bgRow.append(el('span', 'ae-side-field-label', T.background), backgroundChoiceButton(null, { compact: true }));
  // Sfondo del box della vita di Gravehold (stessa riga con anteprima)
  const graveRow = el('div', 'ae-side-field ae-side-field--row');
  graveRow.append(el('span', 'ae-side-field-label', T.graveholdBg),
    backgroundChoiceButton(null, { compact: true, choice: GRAVEHOLD_BG_CHOICE }));
  // Dorso delle carte: miniatura del dorso scelto con il nome; si tocca per scegliere tra tutti i dorsi
  const backRow = el('div', 'ae-side-field ae-side-field--row');
  backRow.append(el('span', 'ae-side-field-label', T.cardBack), cardBackChoiceButton(null, { compact: true }));
  const discardOpen = button(T.discardButton(partita.discard.length), 'secondary', () => { go(); openDiscard(); });
  discardOpen.classList.add('ae-button--full');
  discardOpen.setAttribute('aria-label', T.discardButtonLabel(partita.discard.length));
  // Nemesi uccisa al tavolo (vita a 0): si va alla schermata Vittoria; la partita non cambia (Chiudi torna indietro)
  const killed = button(T.nemesisKilled, 'secondary', () => { go(); mostraFinePartita('victory'); });
  killed.classList.add('ae-button--full');
  // Esci dalla partita (rosso): finestra di conferma, poi il menu iniziale (Modalità test: "Esci dal test")
  const exit = button(partita.testRun ? T.testExit : T.exitGame, 'danger', () => openExitConfirm(() => { go(); vaiAlMenuIniziale(); }));
  exit.classList.add('ae-button--full', 'ae-side-exit', 'ae-hold-exit');
  // Undo: annulla l'ultima azione (prima le modifiche non salvate)
  const undoItem = button(T.undoAction, 'secondary', () => { go(); undo(); openUndoFloat(); });
  undoItem.classList.add('ae-button--full');
  undoItem.disabled = partita.undoStack.length === 0 && ui.drafts.size === 0;
  const items: HTMLElement[] = [statsList, undoItem, discardOpen, killed];
  // Durante "Crea mazzo": Ricomincia la partita (mazzo nuovo con la stessa nemesi e gli stessi giocatori)
  if (ui.deckBuilding) {
    const restart = button(T.restartGame, 'secondary', () => { go(); ricominciaMazzo(); });
    restart.classList.add('ae-button--full');
    items.splice(1, 0, restart);
  }
  // Modalità test: "Ricomincia lo scenario" (di nuovo dallo stato iniziale, undo vuoto)
  if (partita.testRun) {
    const restartTest = button(T.testRestart, 'secondary', () => { go(); ricominciaScenario(); });
    restartTest.classList.add('ae-button--full', 'ae-side-test-restart');
    items.splice(1, 0, restartTest);
  }
  panel.append(...items, bgRow, graveRow, backRow, exit);
  close = openModal(panel, { onCancel: cancel });
  // Anche l'uscita è animata: il pannello torna a destra e lo sfondo scuro svanisce, poi il menu si chiude. Parte da
  // dove si trova (se lo si è già trascinato fuori, niente salto)
  const closeNow = close;
  let leaving = false;
  close = () => {
    if (leaving) return;
    leaving = true;
    const back = panel.parentElement;
    if (reducedMotion.matches || !panel.animate || !back) { closeNow(); return; }
    back.style.pointerEvents = 'none';
    const out = panel.animate([{ transform: 'translateX(100%)' }], { duration: SIDE_MENU_OUT_MS, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' });
    back.animate([{ opacity: 0 }], { duration: SIDE_MENU_OUT_MS, easing: 'ease-in', fill: 'forwards' });
    animDone([out], SIDE_MENU_OUT_MS).then(closeNow);
  };
  const backdrop = panel.parentElement;
  if (backdrop) backdrop.classList.add('ae-modal-backdrop--side');
  swipeToClose(panel, cancel);
  if (backdrop) menuCloseToggle(menuBtn, backdrop, cancel);
}

// Pulsante Menu aperto: sopra il menu, nello stesso punto del pulsante, le tre linee diventano una X (animazione
// classica "hamburger → X": la linea centrale sparisce, le altre due ruotano di 45°). Toccando la X le linee tornano e il
// menu si chiude. Il pulsante vero resta sotto l'oscuramento.
export function menuCloseToggle(source: HTMLElement, backdrop: HTMLElement, close: () => void): void {
  const r = source.getBoundingClientRect();
  if (!r.width) return;
  const x = el('button', 'ae-icon-button ae-menu-button ae-menu-toggle');
  x.type = 'button';
  x.setAttribute('aria-label', T.close);
  x.appendChild(el('span', 'ae-menu-lines'));
  Object.assign(x.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  x.addEventListener('click', e => {
    e.stopPropagation();
    x.classList.remove('is-open');
    setTimeout(close, reducedMotion.matches ? 0 : 180);
  });
  backdrop.appendChild(x);
  void x.offsetWidth;
  setTimeout(() => x.classList.add('is-open'), 20);
}

// Pulsante da tenere premuto (ms): si riempie da sinistra (CSS .is-holding); lasciando prima si annulla e si chiama
// onShort (per esempio un avviso). Da tastiera (Invio, clic senza puntatore) vale subito.
export const HOLD_EXIT_MS = 900;

export function holdToConfirm(btn: HTMLElement, ms: number, onDone: () => void, onShort?: () => void): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fired = false;
  btn.classList.add('is-hold-action');
  btn.style.setProperty('--ae-hold-ms', ms + 'ms');
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    btn.classList.remove('is-holding');
  };
  btn.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    fired = false;
    cancel();
    void btn.offsetWidth;
    btn.classList.add('is-holding');
    timer = setTimeout(() => {
      timer = null;
      fired = true;
      buzz(30);
      onDone();
    }, ms);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => btn.addEventListener(t, () => {
    if (!timer) return;
    cancel();
    if (t === 'pointerup' && onShort) onShort();
  }));
  btn.addEventListener('click', e => {
    if (e.detail === 0 && !fired) onDone();
  });
  btn.addEventListener('contextmenu', e => e.preventDefault());
}

// Menu laterale: trascinandolo verso destra segue il dito; oltre un terzo della larghezza (o con uno scatto) si chiude
export function swipeToClose(panel: HTMLElement, close: () => void): void {
  let start: { x: number; y: number; t: number; dragging: boolean } | null = null;
  const reset = () => {
    panel.style.transition = 'transform .18s ease-out';
    panel.style.transform = '';
    start = null;
  };
  panel.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || (e.target instanceof Element && e.target.closest('select'))) return;
    start = { x: e.clientX, y: e.clientY, t: Date.now(), dragging: false };
  });
  panel.addEventListener('pointermove', e => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!start.dragging) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { start = null; return; }
      if (dx < 10) return;
      start.dragging = true;
      panel.style.transition = 'none';
      try { panel.setPointerCapture(e.pointerId); } catch (err) { /* niente cattura */ }
    }
    panel.style.transform = `translateX(${Math.max(0, dx)}px)`;
  });
  let dragged = false;
  const end = (e: PointerEvent) => {
    if (!start) return;
    if (!start.dragging) { start = null; return; }
    dragged = true;
    setTimeout(() => { dragged = false; }, 0);
    const dx = e.clientX - start.x;
    const fast = dx > 40 && Date.now() - start.t < 250;
    if (dx > panel.offsetWidth / 3 || fast) {
      start = null;
      // Il pannello esce a destra, poi si chiude
      panel.style.transition = 'transform .15s ease-in';
      panel.style.transform = 'translateX(100%)';
      setTimeout(close, 150);
    } else reset();
  };
  panel.addEventListener('pointerup', end);
  panel.addEventListener('pointercancel', () => { if (start) reset(); });
  // Un trascinamento non deve diventare un tocco sui pulsanti del menu
  panel.addEventListener('click', e => { if (dragged) { e.stopPropagation(); e.preventDefault(); } }, true);
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  // (il menu non riceve l'evento del tocco: openSideMenu accetta solo una funzione da chiamare prima di uscire)
  menuBtn.addEventListener('click', () => openSideMenu());
}
