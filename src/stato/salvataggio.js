// stato/salvataggio.js: Fotografia della partita, ripristino, salvataggio nel browser, undo.
// Fase A del passaggio a Vite: codice spostato da script.js così com'era. Al caricamento il modulo dichiara solo
// funzioni e costanti; il codice che prima girava al caricamento è in avvio(), chiamata da main.js nell'ordine di prima.

import * as Salv from '../regole/salvataggio.js';
import { G } from './condivise.js';
import { I18N_IT } from '../ui/testi.js';
import { SAVE_KEY, SAVE_VERSION, UNDO_LIMIT, ui, undoBtn } from './stato.js';
import { turnOrderCards } from './partita.js';
import { closeAllModals, showToast } from '../ui/componenti/dialoghi.js';
import { closeDiscard } from '../ui/componenti/scarti.js';
import { DRAW_UID, render } from '../ui/schermate/turno-nemesi.js';
import { closeDeckBuild } from '../ui/schermate/crea-mazzo.js';

// --- 7. Stato della partita: fotografia, ripristino, salvataggio, undo ---------------------------------------------

// Fotografia della partita (solo dati semplici, stesso formato della v48, così si può salvare nel browser; formato in
// regole/salvataggio.js)
export function snapshot() {
  return Salv.snapshotGame(G);
}

// Rimette la partita come nella fotografia (senza animazioni; quelle in corso si fermano); formati vecchi letti da
// regole/salvataggio.js
export function restore(s) {
  // Prima si leggono tutti i dati (regole/salvataggio.js): se qualcosa non va, la partita in corso resta com'è
  const { game, view } = Salv.restoreGame(s, { cardsById: G.cardsById, newUid: () => G.nextUid++,
    players: G.settings.players, nemeses: G.nemeses, nemesisName: G.settings.nemesis, random: Math.random,
    cards: () => turnOrderCards(G.settings.players) });

  clearTransition();
  ui.drafts.clear();
  ui.flyingDiscards = 0;
  // Una creazione del mazzo interrotta (ripresa o undo): si va direttamente alla partita
  ui.deckBuilding = false;
  ui.deckShown = null;
  ui.deckDark = false;
  closeDeckBuild();
  closeAllModals();
  closeDiscard();
  ui.reveal = null;
  G.deck = game.deck;
  G.discard = game.discard;
  G.turn = game.turn;
  G.queue = game.queue;
  G.maxTierDrawn = game.maxTierDrawn;
  G.graveLife = game.graveLife;
  G.nemesisLife = game.nemesisLife;
  G.stats = game.stats;
  G.resolving = game.resolving;
  G.currentIndex = game.currentIndex;
  G.newIndex = game.newIndex;
  G.turnOrder = game.turnOrder;
  // Carta mostrata: passo Pesca, carta da risolvere o (turno giocatori) nessuna, con la carta più recente in vista
  ui.viewedUid = view.viewed === 'draw' ? DRAW_UID : view.viewed;
  // Dopo un undo le carte hanno uid nuovi: la carta appena pescata è quella in newIndex
  if (view.lastDrawnUid !== null) ui.lastDrawnUid = view.lastDrawnUid;
  if (view.anchor) ui.queueAnchor = view.anchor;
}

// La partita si salva solo dal primo turno nemesi (prima, anche durante "Crea mazzo", non si scrive niente e resta
// l'eventuale partita salvata prima). Una partita già salvata (ripresa, o tornata al turno 0 con l'undo) si salva sempre.
export function save() {
  // Modalità test (v215): niente salvataggio, la partita salvata vera resta com'è
  if (G.testRun) return;
  // Pagina scheletri/ (misura dell'app in un iframe): app.noSave = true e la partita salvata non cambia (prima la pagina
  // sostituiva la funzione save, che con i moduli ES non si può più riassegnare da fuori)
  if (G.noSave) return;
  if (G.turn < 1 && !ui.gameSaved) return;
  ui.gameSaved = true;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(Salv.buildSave(SAVE_VERSION, G.settings, snapshot(), G.undoStack)));
  } catch (err) {
    console.warn('Salvataggio non riuscito', err);
  }
}

export function readSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    const check = Salv.checkSave(saved, SAVE_VERSION);
    // Salvataggio di un'altra versione (prima della v210: carte con gli id vecchi): si ignora e si cancella
    if (check === 'other-version') {
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
    if (check === 'ok') return saved;
  } catch (err) {
    console.warn('Salvataggio illeggibile', err);
  }
  return null;
}

export function updateUndoBtn() {
  undoBtn.disabled = G.undoStack.length === 0 && ui.drafts.size === 0;
}

// Aggiunge un passo di undo (lo stato prima di un'azione), tenendone al massimo UNDO_LIMIT
export function pushUndo(state) {
  G.undoStack.push(state);
  if (G.undoStack.length > UNDO_LIMIT) G.undoStack.shift();
}

// Ogni azione che cambia la partita: prima si salva lo stato per l'undo, poi si fa l'azione, poi si salva la partita
export function act(action) {
  pushUndo(snapshot());
  const result = action();
  save();
  return result;
}

// Undo: torna allo stato prima dell'ultima azione (si può ripetere fino all'inizio della partita)
export function undo() {
  // Modifiche non salvate sulle carte (turno giocatori): il primo Annulla le scarta, poi si torna ai salvataggi precedenti
  if (ui.drafts.size) {
    ui.drafts.clear();
    render();
    showToast(I18N_IT.draftDiscarded);
    return;
  }
  const previous = G.undoStack.pop();
  if (!previous) return;
  restore(previous);
  render();
  save();
  showToast(I18N_IT.undone);
}

// Ferma le animazioni in corso dopo un'azione (undo, nuova partita, riprendi)
export function clearTransition() {
  clearTimeout(ui.transitionTimer);
  ui.transitionTimer = null;
  ui.isTransitioning = false;
  ui.holdUid = null;
}

// Blocca il pulsante principale per ms millisecondi, poi esegue then
export function lockFor(ms, then) {
  clearTimeout(ui.transitionTimer);
  ui.isTransitioning = true;
  ui.transitionTimer = setTimeout(() => {
    ui.transitionTimer = null;
    ui.isTransitioning = false;
    if (then) then();
    render();
  }, ms);
}

// Codice eseguito all'avvio (prima: al caricamento di script.js), nell'ordine di prima
export function avvio() {
}
