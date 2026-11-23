// ui/componenti/menu-laterale.ts: sfondo dell'app e di Gravehold, menu laterale della partita, scelta del dorso delle
// carte, pulsanti tenuti premuti, swipe per chiudere, scorrimento con la rotella; in avvio i pulsanti principali.
// Dipende da: stato/ (condivise, stato, salvataggio), ui/testi.ts, ui/componenti (componenti, dialoghi, scarti,
// pesca-undo), ui/schermate (turno-giocatori, opzioni, turno-nemesi, mazzo-turni, statistiche, crea-mazzo, test),
// avvio.ts (init). Usato da: opzioni (scelte di sfondo e dorso), turno nemesi (vite), mazzo dei turni, pesca-undo.

import { G } from '../../stato/condivise.ts';
import { I18N_IT } from '../testi.ts';
import { app, backBtn, CARD_BACKS, cssUrl, currentCardBack, focusEl, menuBtn, nemesisBtn, queueViewport, rail, reducedMotion, resolveBtn, resumeBtn, retryBtn, setCardBack, startBtn, startLayer, ui, undoBtn } from '../../stato/stato.ts';
import { el, query } from './componenti.ts';
import { button, dialogShell, openModal } from './dialoghi.ts';
import { sizeQueue } from '../schermate/turno-giocatori.ts';
import { openDiscard } from './scarti.ts';
import { onStartClick, openStart, resumeGame } from '../schermate/opzioni.ts';
import { undo } from '../../stato/salvataggio.ts';
import { backToActive, buzz, onNemesisClick, onResolveClick, render, renderLives, sizeFocus } from '../schermate/turno-nemesi.ts';
import { animDone } from '../schermate/mazzo-turni.ts';
import { showVictory } from '../schermate/statistiche.ts';
import { buildDeckSlider, rebuildDeck } from '../schermate/crea-mazzo.ts';
import { openExitConfirm, openUndoFloat } from './pesca-undo.ts';
import { restartScenario } from '../schermate/test.ts';
import { init } from '../../avvio.ts';

// Uno sfondo (dell'app o del box della vita di Gravehold)
export interface Sfondo {
  id: string;                    // nome salvato nel browser
  src: string;                   // immagine
}

// Una scelta di sfondo: stesso pulsante con anteprima e stessa finestra per lo sfondo dell'app e quello di Gravehold
export interface SceltaSfondo {
  className: string;             // classe in più del pulsante
  title: () => string;           // titolo della finestra
  list: Sfondo[];                // sfondi possibili
  current: () => Sfondo;         // sfondo scelto
  set: (id: string) => void;     // sceglie uno sfondo
  name: (id: string) => string;  // nome mostrato
  chosen: (name: string) => string; // etichetta per i lettori di schermo
}

// Nome di un elemento di un elenco di testi (sfondi, dorsi) per id
function textOf(names: Record<string, string>, id: string): string {
  return names[id];
}

// Sfondo dell'app (maga a sinistra, nemesi a destra): si sceglie nel Menu, la scelta resta salvata nel browser.
// Non fa parte della partita (niente undo).
export const BACKGROUND_KEY = 'aeonsend-app-0.2-background';

export const BACKGROUNDS: Sfondo[] = [
  { id: 'masked', src: 'Assets/ui/decor/battle-bg.webp' },
  { id: 'horned', src: 'Assets/ui/decor/battle-bg-2.webp' },
  { id: 'maw', src: 'Assets/ui/decor/battle-bg-3.webp' }
];

export function currentBackground(): Sfondo {
  let id: string | null = null;
  try { id = localStorage.getItem(BACKGROUND_KEY); } catch (err) { /* si usa quello predefinito */ }
  return BACKGROUNDS.find(b => b.id === id) || BACKGROUNDS[0];
}

export function applyBackground(): void {
  app.style.setProperty('--ae-battle-bg', cssUrl(currentBackground().src));
}

export function setBackground(id: string): void {
  try { localStorage.setItem(BACKGROUND_KEY, id); } catch (err) { console.warn(err); }
  applyBackground();
}

// Scelta dello sfondo di tutta l'app (Menu e Opzioni), assegnata in avvio()
export let APP_BG_CHOICE: SceltaSfondo;

// Sfondo del box della vita di Gravehold (Assets/ui/gravehold/), scelto nel Menu della partita e salvato nel browser
// (non fa parte della partita, niente undo). Il box della nemesi ha il ritratto della nemesi (renderLives).
export const GRAVEHOLD_BG_KEY = 'aeonsend-app-0.2-gravehold-bg';

export const GRAVEHOLD_BGS: Sfondo[] = [
  { id: 'city', src: 'Assets/ui/gravehold/gravehold-city.webp' },
  { id: 'tower', src: 'Assets/ui/gravehold/gravehold-tower.webp' }
];

export function currentGraveholdBg(): Sfondo {
  let id: string | null = null;
  try { id = localStorage.getItem(GRAVEHOLD_BG_KEY); } catch (err) { /* si usa quello predefinito */ }
  return GRAVEHOLD_BGS.find(b => b.id === id) || GRAVEHOLD_BGS[0];
}

export function setGraveholdBg(id: string): void {
  try { localStorage.setItem(GRAVEHOLD_BG_KEY, id); } catch (err) { console.warn(err); }
  renderLives();
}

// Scelta dello sfondo di Gravehold, assegnata in avvio()
export let GRAVEHOLD_BG_CHOICE: SceltaSfondo;

// Durata dell'uscita animata del menu laterale
export const SIDE_MENU_OUT_MS = 220;

// leave (facoltativo) = cosa chiudere prima di una voce che porta altrove (Menu aperto dalla finestra del mazzo dei
// turni: la finestra si chiude prima di undo, scarti, vittoria, esci, ricomincia)
export function openSideMenu(leave?: () => void): void {
  if (ui.isTransitioning) return;
  let close = () => {};
  const cancel = () => close();
  const go = () => { close(); if (typeof leave === 'function') leave(); };
  const panel = dialogShell(I18N_IT.menu, '', cancel, { displayTitle: false });
  panel.classList.add('ae-side-menu');
  const statsList = el('dl', 'ae-side-stats');
  statsList.append(el('dt', '', I18N_IT.menuTurn), el('dd', '', String(G.turn)),
    el('dt', '', I18N_IT.menuDeck), el('dd', '', String(G.deck.length)));
  // Sfondo: anteprima dello sfondo scelto con il nome; si tocca per scegliere tra le anteprime di tutti gli sfondi
  const bgRow = el('div', 'ae-side-field ae-side-field--row');
  bgRow.append(el('span', 'ae-side-field-label', I18N_IT.background), backgroundChoiceButton(null, { compact: true }));
  // Sfondo del box della vita di Gravehold (stessa riga con anteprima)
  const graveRow = el('div', 'ae-side-field ae-side-field--row');
  graveRow.append(el('span', 'ae-side-field-label', I18N_IT.graveholdBg),
    backgroundChoiceButton(null, { compact: true, choice: GRAVEHOLD_BG_CHOICE }));
  // Dorso delle carte: miniatura del dorso scelto con il nome; si tocca per scegliere tra tutti i dorsi
  const backRow = el('div', 'ae-side-field ae-side-field--row');
  backRow.append(el('span', 'ae-side-field-label', I18N_IT.cardBack), cardBackChoiceButton(null, { compact: true }));
  const discardOpen = button(I18N_IT.discardButton(G.discard.length), 'secondary', () => { go(); openDiscard(); });
  discardOpen.classList.add('ae-button--full');
  discardOpen.setAttribute('aria-label', I18N_IT.discardButtonLabel(G.discard.length));
  // Nemesi uccisa al tavolo (vita a 0): si va alla schermata Vittoria; la partita non cambia (Chiudi torna indietro)
  const killed = button(I18N_IT.nemesisKilled, 'secondary', () => { go(); showVictory(); });
  killed.classList.add('ae-button--full');
  // Esci dalla partita (rosso): finestra di conferma, poi il menu iniziale (Modalità test: "Esci dal test")
  const exit = button(G.testRun ? I18N_IT.testExit : I18N_IT.exitGame, 'danger', () => openExitConfirm(() => { go(); openStart(); }));
  exit.classList.add('ae-button--full', 'ae-side-exit', 'ae-hold-exit');
  // Undo: annulla l'ultima azione (prima le modifiche non salvate)
  const undoItem = button(I18N_IT.undoAction, 'secondary', () => { go(); undo(); openUndoFloat(); });
  undoItem.classList.add('ae-button--full');
  undoItem.disabled = G.undoStack.length === 0 && ui.drafts.size === 0;
  const items: HTMLElement[] = [statsList, undoItem, discardOpen, killed];
  // Durante "Crea mazzo": Ricomincia la partita (mazzo nuovo con la stessa nemesi e gli stessi giocatori)
  if (ui.deckBuilding) {
    const restart = button(I18N_IT.restartGame, 'secondary', () => { go(); rebuildDeck(); });
    restart.classList.add('ae-button--full');
    items.splice(1, 0, restart);
  }
  // Modalità test: "Ricomincia lo scenario" (di nuovo dallo stato iniziale, undo vuoto)
  if (G.testRun) {
    const restartTest = button(I18N_IT.testRestart, 'secondary', () => { go(); restartScenario(); });
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

// Pulsante con la miniatura e il nome del dorso scelto: apre la griglia dei dorsi (Menu della partita e Opzioni)
// compact: solo la miniatura, senza nome (il nome resta per i lettori di schermo)
export function cardBackChoiceButton(onClosed: (() => void) | null, { compact = false }: { compact?: boolean } = {}): HTMLButtonElement {
  const btn = el('button', 'ae-back-choice' + (compact ? ' ae-back-choice--compact' : ''));
  btn.type = 'button';
  const thumb = el('img', 'ae-back-choice-thumb');
  thumb.alt = '';
  const name = el('span', 'ae-back-choice-name');
  const sync = () => {
    const b = currentCardBack();
    thumb.src = b.thumb;
    name.textContent = textOf(I18N_IT.cardBacks, b.id);
    btn.setAttribute('aria-label', I18N_IT.cardBackChosen(textOf(I18N_IT.cardBacks, b.id)));
  };
  btn.append(thumb, name);
  btn.addEventListener('click', () => openCardBackPicker(sync, onClosed));
  sync();
  return btn;
}

// Pulsante con l'anteprima e il nome dello sfondo scelto: apre la scelta con le anteprime (Menu della partita e Opzioni)
// compact: solo l'anteprima, senza nome (il nome resta per i lettori di schermo); choice = quale scelta (sfondo
// dell'app o di Gravehold; stessa anteprima e stessa finestra)
export function backgroundChoiceButton(onClosed: (() => void) | null,
  { compact = false, choice = APP_BG_CHOICE }: { compact?: boolean; choice?: SceltaSfondo } = {}): HTMLButtonElement {
  const btn = el('button', 'ae-bg-choice' + (compact ? ' ae-bg-choice--compact' : '') + choice.className);
  btn.type = 'button';
  const thumb = el('img', 'ae-bg-choice-thumb');
  thumb.alt = '';
  const name = el('span', 'ae-bg-choice-name');
  const sync = () => {
    const b = choice.current();
    thumb.src = b.src;
    name.textContent = choice.name(b.id);
    btn.setAttribute('aria-label', choice.chosen(choice.name(b.id)));
  };
  btn.append(thumb, name);
  btn.addEventListener('click', () => openBackgroundPicker(sync, onClosed, choice));
  sync();
  return btn;
}

// Scelta dello sfondo: le anteprime di tutti gli sfondi una sotto l'altra; un tocco lo applica subito e chiude
export function openBackgroundPicker(onChosen: (() => void) | null, onClosed: (() => void) | null, choice: SceltaSfondo = APP_BG_CHOICE): void {
  let closeModalFn = () => {};
  const close = () => { closeModalFn(); if (onClosed) onClosed(); };
  const dialog = dialogShell(choice.title(), '', close, { displayTitle: false });
  dialog.classList.add('ae-bg-picker');
  const list = el('div', 'ae-bg-grid');
  const chosen = choice.current().id;
  choice.list.forEach(b => {
    const item = el('button', 'ae-bg-item');
    item.type = 'button';
    item.setAttribute('aria-pressed', String(b.id === chosen));
    const img = el('img');
    img.alt = '';
    img.src = b.src;
    item.append(img, el('span', 'ae-bg-item-name', choice.name(b.id)));
    item.addEventListener('click', () => {
      choice.set(b.id);
      close();
      if (onChosen) onChosen();
    });
    list.appendChild(item);
  });
  const footer = el('div', 'ae-modal-footer');
  footer.appendChild(button(I18N_IT.close, 'secondary', close));
  dialog.append(list, footer);
  closeModalFn = openModal(dialog, { onCancel: close, initialFocus: query(list, '[aria-pressed="true"]', HTMLElement) });
}

// Scelta del dorso delle carte: griglia di miniature; un tocco sceglie il dorso, lo applica subito e chiude.
// onClosed: dopo la chiusura, in ogni caso (le Opzioni lo usano per tenere la pagina iniziale coperta)
export function openCardBackPicker(onChosen: (() => void) | null, onClosed: (() => void) | null): void {
  let closeModalFn = () => {};
  const close = () => { closeModalFn(); if (onClosed) onClosed(); };
  const cancel = () => close();
  const dialog = dialogShell(I18N_IT.cardBack, '', cancel, { displayTitle: false });
  dialog.classList.add('ae-back-picker');
  const grid = el('div', 'ae-back-grid');
  const chosen = currentCardBack().id;
  CARD_BACKS.forEach(b => {
    const item = el('button', 'ae-back-item');
    item.type = 'button';
    item.setAttribute('aria-pressed', String(b.id === chosen));
    const img = el('img');
    img.alt = '';
    img.loading = 'lazy';
    img.src = b.thumb;
    item.append(img, el('span', 'ae-back-item-name', textOf(I18N_IT.cardBacks, b.id)));
    item.addEventListener('click', () => {
      setCardBack(b.id);
      close();
      if (onChosen) onChosen();
      // Il carosello si ridisegna anche se non è cambiato niente, così il dorso da pescare prende quello nuovo
      G.focusSignature = '';
      if (startLayer.hidden) render();
    });
    grid.appendChild(item);
  });
  const footer = el('div', 'ae-modal-footer');
  footer.appendChild(button(I18N_IT.close, 'secondary', cancel));
  dialog.append(grid, footer);
  closeModalFn = openModal(dialog, { onCancel: cancel, initialFocus: query(grid, '[aria-pressed="true"]', HTMLElement) });
}

// Pulsante Menu aperto: sopra il menu, nello stesso punto del pulsante, le tre linee diventano una X (animazione
// classica "hamburger → X": la linea centrale sparisce, le altre due ruotano di 45°). Toccando la X le linee tornano e il
// menu si chiude. Il pulsante vero resta sotto l'oscuramento.
export function menuCloseToggle(source: HTMLElement, backdrop: HTMLElement, close: () => void): void {
  const r = source.getBoundingClientRect();
  if (!r.width) return;
  const x = el('button', 'ae-icon-button ae-menu-button ae-menu-toggle');
  x.type = 'button';
  x.setAttribute('aria-label', I18N_IT.close);
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
  applyBackground();

  APP_BG_CHOICE = {
    className: '', title: () => I18N_IT.background, list: BACKGROUNDS, current: currentBackground, set: setBackground,
    name: id => textOf(I18N_IT.backgrounds, id), chosen: n => I18N_IT.backgroundChosen(n)
  };

  GRAVEHOLD_BG_CHOICE = {
    className: ' ae-bg-choice--gravehold', title: () => I18N_IT.graveholdBg, list: GRAVEHOLD_BGS, current: currentGraveholdBg,
    set: setGraveholdBg, name: id => textOf(I18N_IT.graveholdBgs, id), chosen: n => I18N_IT.graveholdBgChosen(n)
  };

  startBtn.addEventListener('click', onStartClick);
  resumeBtn.addEventListener('click', resumeGame);
  undoBtn.addEventListener('click', undo);
  nemesisBtn.addEventListener('click', onNemesisClick);

  // Turno giocatori con modifiche non salvate: "Annulla modifiche" accanto a "Salva modifiche" (stessa riga) toglie tutte
  // le bozze (vita dei minion, costi pagati); non è un passo di undo, perché le bozze non sono ancora nella partita
  const cancelDrafts = el('button', 'ae-button ae-button--secondary ae-cancel-drafts', I18N_IT.cancelChanges);
  G.cancelDraftsBtn = cancelDrafts;
  cancelDrafts.type = 'button';
  cancelDrafts.hidden = true;

  {
    const row = el('div', 'ae-main-row');
    nemesisBtn.before(row);
    const slider = buildDeckSlider();
    G.deckSlider = slider;
    row.append(cancelDrafts, nemesisBtn, slider.box);
  }

  cancelDrafts.addEventListener('click', () => {
    if (G.resolving || ui.isTransitioning || !ui.drafts.size) return;
    ui.drafts.clear();
    render();
    nemesisBtn.focus({ preventScroll: true });
  });

  resolveBtn.addEventListener('click', onResolveClick);
  backBtn.addEventListener('click', backToActive);
  retryBtn.addEventListener('click', init);

  // Interruttore "Includi carte base potenziate" tolto: si toglie anche da un index.html vecchio in cache
  {
    const upgradedRow = document.getElementById('upgraded-switch');
    const switchRow = upgradedRow && upgradedRow.closest('.ae-switch-row');
    if (switchRow) switchRow.remove();
  }

  window.addEventListener('resize', () => { sizeFocus(); sizeQueue(); });

  // Desktop: la rotella del mouse (verticale) scorre le carte grandi e le fasce piccole, che vanno in orizzontale
  [focusEl, queueViewport, rail].forEach(c => c.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || c.scrollWidth <= c.clientWidth + 1) return;
    e.preventDefault();
    c.scrollBy({ left: e.deltaY, behavior: 'auto' });
  }, { passive: false }));

  // Se lo spazio della carta grande cambia per altri motivi (font caricato, pulsanti del dock), si ridimensiona subito
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => sizeFocus()).observe(focusEl);
    new ResizeObserver(() => sizeQueue()).observe(queueViewport);
  }
}
