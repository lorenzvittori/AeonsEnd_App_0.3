// ui/componenti/pesca-undo.ts: "Pesca carta" dal mazzo in alto (tocco sul mazzo, carta in cima in grande, Rimetti o
// Scarta), Annulla sospeso dopo l'undo dal menu, conferma di "Esci dalla partita".
// Livello 3 (ui/componenti/). Dipende da: stato/partita.ts (lettura, scartaCimaDelMazzo), ui/ base (testi, pagina, dom,
// ridisegno), ui/componenti (componenti, dialoghi, testata, ripristino). Usato da: menu laterale, navigazione (Indietro,
// Esc).

import { T } from '../testi.ts';
import { cardArt, needsPairChoice } from './componenti.ts';
import { button, dialogShell, modals, openModal, showToast } from './dialoghi.ts';
import { dockDeck, flyToDiscard } from './testata.ts';
import { partita, scartaCimaDelMazzo } from '../../stato/partita.ts';
import { ui } from '../pagina.ts';
import { el } from '../dom.ts';
import { richiediRidisegno } from '../ridisegno.ts';
import { undo } from './ripristino.ts';

// "Annulla ultima azione" dal Menu: il menu si chiude e resta un pulsante sospeso che si può toccare più volte;
// un tocco fuori dal pulsante (o Esc) chiude e si torna all'app
export let undoFloat: HTMLDivElement | null = null;

export function openUndoFloat(): void {
  closeUndoFloat();
  const layer = el('div', 'ae-undo-float');
  const b = button(T.undoAction, 'primary', e => {
    e.stopPropagation();
    undo();
    sync();
  });
  b.classList.add('ae-undo-float-button');
  const sync = () => { b.disabled = partita.undoStack.length === 0 && ui.drafts.size === 0; };
  layer.addEventListener('click', e => { if (e.target === layer) closeUndoFloat(); });
  layer.appendChild(b);
  document.body.appendChild(layer);
  undoFloat = layer;
  sync();
  b.focus({ preventScroll: true });
}

export function closeUndoFloat(): void {
  if (!undoFloat) return;
  undoFloat.remove();
  undoFloat = null;
}

// Tocco sul mazzo in alto: sotto compare "Pesca carta" (un tocco fuori lo chiude). "Pesca carta" apre la carta in cima
// al mazzo in grande con "Rimetti nel mazzo" (resta in cima, nessun cambiamento) e "Scarta" (va negli scarti, un passo
// di undo). Se il mazzo è vuoto il pulsante è disattivato (gli scarti non si rimescolano qui).
export let deckPopover: HTMLDivElement | null = null;

export function openDeckPopover(): void {
  closeDeckPopover();
  const layer = el('div', 'ae-deck-popover');
  const r = dockDeck.getBoundingClientRect();
  const b = button(T.drawCard, 'primary', e => {
    e.stopPropagation();
    closeDeckPopover();
    openDeckDraw();
  });
  b.classList.add('ae-deck-popover-button');
  b.disabled = partita.deck.length === 0;
  b.style.left = Math.max(8, r.left) + 'px';
  b.style.top = (r.bottom + 8) + 'px';
  layer.addEventListener('click', e => { if (e.target === layer) closeDeckPopover(); });
  layer.appendChild(b);
  document.body.appendChild(layer);
  deckPopover = layer;
  b.focus({ preventScroll: true });
}

export function closeDeckPopover(): void {
  if (!deckPopover) return;
  deckPopover.remove();
  deckPopover = null;
}

// Conferma di "Esci dalla partita": Annulla torna al Menu, Esci va al menu iniziale (la partita resta salvata)
export function openExitConfirm(onExit: () => void): void {
  let close = () => {};
  const cancel = () => close();
  const dialog = dialogShell(T.exitConfirmTitle, '', cancel, { displayTitle: false });
  dialog.classList.add('ae-exit-confirm');
  dialog.appendChild(el('p', 'ae-modal-text', T.exitConfirmText));
  const footer = el('div', 'ae-modal-footer');
  const cancelBtn = button(T.cancel, 'secondary', cancel);
  footer.append(cancelBtn, button(T.exitConfirm, 'danger', () => { close(); onExit(); }));
  dialog.appendChild(footer);
  close = openModal(dialog, { onCancel: cancel, initialFocus: cancelBtn });
}

export function openDeckDraw(): void {
  const data = partita.deck[partita.deck.length - 1];
  if (!data) return;
  let close = () => {};
  const putBack = () => { close(); showToast(T.cardPutBack(data.name)); };
  const dialog = dialogShell(T.deckCardTitle, data.name, putBack, { displayTitle: false });
  dialog.classList.add('ae-deck-draw');
  const art = cardArt(data);
  art.classList.add('ae-modal-art');
  const footer = el('div', 'ae-modal-footer');
  const discardBtnEl = button(T.discardDrawn, 'danger', () => {
    const source = art.getBoundingClientRect().width ? art : null;
    // La carta in cima va negli scarti (la finestra è aperta solo con il mazzo non vuoto)
    scartaCimaDelMazzo();
    // La carta vola dalla finestra alla pila degli scarti
    if (source) flyToDiscard([source]);
    close();
    richiediRidisegno();
    showToast(T.cardDiscarded(data.name));
  });
  footer.append(button(T.putBack, 'secondary', putBack), discardBtnEl);
  dialog.append(art, footer);
  close = openModal(dialog, { onCancel: putBack });
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  // Tocco sul mazzo in alto (testata): compare il pulsante "Pesca carta" (per gli effetti che fanno pescare o guardare la
  // carta in cima); non con la scelta del giocatore 1/2 o 3/4 in sospeso
  dockDeck.addEventListener('click', () => {
    if (!ui.isTransitioning && !modals.length && !ui.deckBuilding && !needsPairChoice()) openDeckPopover();
  });
}
