// ui/finestre/menu-laterale.ts: il menu laterale della partita (tempo di gioco, mazzo Nemesi, Partita: Annulla, Scarti,
// Statistiche, Ricomincia; Personalizzazione: sfondi e dorso; Fine partita: Nemesi sconfitta; Esci), con l'uscita animata,
// lo swipe per chiuderlo e la X sopra il pulsante Menu; il pulsante da tenere premuto (holdToConfirm).
// Le voci che portano altrove usano gli agganci (menu iniziale, fine partita, ricomincia il mazzo o lo scenario).
// Livello 4 (ui/finestre/). Dipende da: stato/partita.ts (lettura), ui/ base (testi, pagina, dom, ridisegno),
// ui/componenti (animazioni, dialoghi, pesca-undo, ripristino, scarti, sfondi), ui/finestre (icone, mazzo, tempo).
// Usato da: navigazione (pulsante Menu, aggancio apriMenuLaterale).

import { T } from '../testi.ts';
import { partita } from '../../stato/partita.ts';
import { menuBtn, reducedMotion, ui } from '../pagina.ts';
import { el } from '../dom.ts';
import { apriStatistiche, mostraFinePartita, ricominciaMazzo, ricominciaScenario, vaiAlMenuIniziale } from '../ridisegno.ts';
import { animDone, buzz } from '../componenti/animazioni.ts';
import { button, dialogShell, openModal } from '../componenti/dialoghi.ts';
import { openExitConfirm, openUndoFloat } from '../componenti/pesca-undo.ts';
import { undo } from '../componenti/ripristino.ts';
import { openDiscard } from '../componenti/scarti.ts';
import { backgroundChoiceButton, cardBackChoiceButton, GRAVEHOLD_BG_CHOICE } from '../componenti/sfondi.ts';
import { type IconaMenu, iconaMenu } from './menu-laterale-icone.ts';
import { indicatoreMazzo } from './menu-laterale-mazzo.ts';
import { avviaTempoPartita, formatoOrologio, tempoPartita } from './menu-laterale-tempo.ts';

// Durata dell'uscita animata del menu laterale
export const SIDE_MENU_OUT_MS = 220;

// Intestazione di sezione: titolo in maiuscolo con una linea sottile a destra
function sezione(titolo: string): HTMLElement {
  const h = el('div', 'ae-side-section');
  h.append(el('span', 'ae-side-section-title', titolo), el('span', 'ae-side-section-line'));
  return h;
}

// Riga di azione: icona lineare a sinistra, testo, eventuale indicatore a destra; nessun box
function riga(testo: string, onClick: () => void, icona?: IconaMenu, destra?: HTMLElement): HTMLButtonElement {
  const b = el('button', 'ae-side-row') as HTMLButtonElement;
  b.type = 'button';
  if (icona) {
    const ic = el('span', 'ae-side-row-icon');
    ic.appendChild(iconaMenu(icona, 22));
    b.appendChild(ic);
  }
  b.appendChild(el('span', 'ae-side-row-label', testo));
  if (destra) b.appendChild(destra);
  b.addEventListener('click', onClick);
  return b;
}

// leave (facoltativo) = cosa chiudere prima di una voce che porta altrove (Menu aperto dalla finestra del mazzo dei
// turni: la finestra si chiude prima di undo, scarti, vittoria, esci, ricomincia)
export function openSideMenu(leave?: () => void): void {
  if (ui.isTransitioning) return;
  let close = () => {};
  const cancel = () => close();
  const go = () => { close(); if (typeof leave === 'function') leave(); };
  const panel = dialogShell(T.menuTitle, '', cancel, { displayTitle: true });
  panel.classList.add('ae-side-menu');
  // La X dell'intestazione: icona del mockup (chiude il menu come la X sopra il pulsante Menu)
  const headX = panel.querySelector<HTMLElement>('.ae-modal-header > .ae-icon-button');
  // Resta solo la X animata sopra il pulsante Menu (menuCloseToggle): quella dell'intestazione si toglie
  headX?.remove();

  // Tempo di gioco (si aggiorna ogni secondo finché il menu è aperto; il conteggio sta in menu-laterale-tempo.ts)
  const orologio = el('div', 'ae-side-clock');
  const valoreOrologio = el('span', 'ae-side-clock-value', formatoOrologio(tempoPartita()));
  orologio.append(iconaMenu('orologio', 14), valoreOrologio);
  const tempo = el('div', 'ae-side-time');
  tempo.append(orologio);
  const timer = setInterval(() => { valoreOrologio.textContent = formatoOrologio(tempoPartita()); }, 1000);

  // Mazzo Nemesi: un'unica barra con una tacca per carta (menu-laterale-mazzo.ts)
  const mazzo = indicatoreMazzo(T.menuNemesisDeck, T.menuTier);
  mazzo.radice.classList.add('ae-side-deck');

  // PARTITA: Ricomincia (solo in Crea mazzo o nella Modalità test), Annulla, Carte scartate, Statistiche
  const partitaVoci: HTMLElement[] = [];
  if (ui.deckBuilding) partitaVoci.push(riga(T.restartGame, () => { go(); ricominciaMazzo(); }));
  if (partita.testRun) partitaVoci.push(riga(T.testRestart, () => { go(); ricominciaScenario(); }));
  // Undo: annulla l'ultima azione (prima le modifiche non salvate)
  const undoItem = riga(T.undoAction, () => { go(); undo(); openUndoFloat(); }, 'annulla');
  undoItem.disabled = partita.undoStack.length === 0 && ui.drafts.size === 0;
  const conteggioScarti = el('span', 'ae-side-badge', String(partita.discard.length));
  const discardOpen = riga(T.menuDiscarded, () => { go(); openDiscard(); }, 'scarti', conteggioScarti);
  discardOpen.setAttribute('aria-label', T.discardButtonLabel(partita.discard.length));
  const freccia = () => { const s = el('span', 'ae-side-arrow'); s.appendChild(iconaMenu('freccia', 14)); return s; };
  const statsOpen = riga(T.statsInProgress, () => { go(); apriStatistiche(); }, 'statistiche', freccia());
  partitaVoci.push(undoItem, discardOpen, statsOpen);

  // PERSONALIZZAZIONE: anteprime reali di sfondo, sfondo di Gravehold e dorso (nessun box attorno alla riga)
  const bgRow = el('div', 'ae-side-field ae-side-field--row');
  bgRow.append(el('span', 'ae-side-field-label', T.menuGameBackground), backgroundChoiceButton(null, { compact: true }));
  const graveRow = el('div', 'ae-side-field ae-side-field--row');
  graveRow.append(el('span', 'ae-side-field-label', T.graveholdBg),
    backgroundChoiceButton(null, { compact: true, choice: GRAVEHOLD_BG_CHOICE }));
  const backRow = el('div', 'ae-side-field ae-side-field--row');
  backRow.append(el('span', 'ae-side-field-label', T.cardBack), cardBackChoiceButton(null, { compact: true }));

  // FINE PARTITA: "Nemesi sconfitta" da tenere premuto (come l'uscita), con didascalia e trofeo
  const killed = el('button', 'ae-side-end') as HTMLButtonElement;
  killed.type = 'button';
  const trofeo = el('span', 'ae-side-row-icon ae-side-trophy');
  trofeo.appendChild(iconaMenu('trofeo', 22));
  const testoFine = el('span', 'ae-side-end-text');
  testoFine.append(el('span', 'ae-side-end-title', T.menuNemesisDefeated));
  killed.append(trofeo, testoFine);
  holdToConfirm(killed, HOLD_EXIT_MS, () => { go(); mostraFinePartita('victory'); });

  // Esci dalla partita (rosso): finestra di conferma, poi il menu iniziale (Modalità test: "Esci dal test")
  const exit = button(partita.testRun ? T.testExit : T.exitGame, 'danger', () => openExitConfirm(() => { go(); vaiAlMenuIniziale(); }));
  exit.classList.add('ae-button--full', 'ae-side-exit', 'ae-hold-exit');

  panel.append(tempo, el('hr', 'ae-side-sep'), mazzo.radice,
    sezione(T.menuGameSection), ...partitaVoci,
    sezione(T.menuCustomSection), bgRow, graveRow, backRow,
    sezione(T.menuEndSection), killed, exit);
  close = openModal(panel, { onCancel: cancel, onClosed: () => clearInterval(timer) });
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
  // Il tempo di gioco conta dall'avvio dell'app (solo a partita in corso, a pagina visibile)
  avviaTempoPartita();
}
