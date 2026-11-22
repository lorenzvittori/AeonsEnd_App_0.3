// 07-salvataggio-undo.js: Stato della partita: fotografia, ripristino, salvataggio, undo. Caricato in ordine da script.js insieme agli altri file di js/ (script classici, variabili globali).
'use strict';

// --- 7. Stato della partita: fotografia, ripristino, salvataggio, undo ---------------------------------------------

// Fotografia della partita (salvataggio e undo): una copia di tutti i campi di game tranne settings e nextUid
// (Regole.snapshotGame: carte come id, voci della coda senza uid). Stesso formato di sempre (v48, version 2 dalla v210):
// un campo nuovo di game entra da solo nella fotografia
function snapshot() {
  return Regole.snapshotGame(game);
}

// Rimette la partita come nella fotografia (senza animazioni; quelle in corso si fermano). Regole.restoreGame copia
// tutti i campi salvati e completa i salvataggi vecchi (statistiche, Tier, mazzo dei turni: Regole.restoreTurnOrder);
// legge tutto prima di cambiare qualcosa: se una carta non c'è, la partita in corso resta com'è
function restore(s) {
  const r = Regole.restoreGame(s, { cardsById, newUid: () => game.nextUid++, players: game.settings.players, random: Math.random,
    get cards() { return turnOrderCards(game.settings.players); } });
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
  Object.assign(game, r.game);
  // Cosa si mostra: nel turno nemesi la carta da risolvere (o il passo Pesca con la coda vuota; dopo un undo le carte
  // hanno uid nuovi: la carta appena pescata è quella in newIndex), nel turno giocatori la carta più recente
  ui.viewedUid = r.view.viewed === 'draw' ? DRAW_UID : r.view.viewed;
  if (r.view.lastDrawnUid !== null) ui.lastDrawnUid = r.view.lastDrawnUid;
  if (r.view.anchor) ui.queueAnchor = r.view.anchor;
}
// La partita si salva solo dal primo turno nemesi (prima, anche durante "Crea mazzo", non si scrive niente e resta
// l'eventuale partita salvata prima). Una partita già salvata (ripresa, o tornata al turno 0 con l'undo) si salva sempre.
function save() {
  // Modalità test (v215): niente salvataggio, la partita salvata vera resta com'è
  if (testRun) return;
  if (game.turn < 1 && !ui.gameSaved) return;
  ui.gameSaved = true;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, settings: game.settings, state: snapshot(), undo: undoStack }));
  } catch (err) {
    console.warn('Salvataggio non riuscito', err);
  }
}

function readSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    // Salvataggio di un'altra versione (prima della v210: carte con gli id vecchi): si ignora e si cancella
    if (saved && saved.version !== SAVE_VERSION) {
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
    if (saved && saved.state && saved.settings && Array.isArray(saved.state.queue)) return saved;
  } catch (err) {
    console.warn('Salvataggio illeggibile', err);
  }
  return null;
}

function updateUndoBtn() {
  undoBtn.disabled = undoStack.length === 0 && ui.drafts.size === 0;
}

// Aggiunge un passo di undo (lo stato prima di un'azione), tenendone al massimo UNDO_LIMIT
function pushUndo(state) {
  undoStack.push(state);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
}

// Ogni azione che cambia la partita: prima si salva lo stato per l'undo, poi si fa l'azione, poi si salva la partita
function act(action) {
  pushUndo(snapshot());
  const result = action();
  save();
  return result;
}

// Undo: torna allo stato prima dell'ultima azione (si può ripetere fino all'inizio della partita)
function undo() {
  // Modifiche non salvate sulle carte (turno giocatori): il primo Annulla le scarta, poi si torna ai salvataggi precedenti
  if (ui.drafts.size) {
    ui.drafts.clear();
    render();
    showToast(I18N_IT.draftDiscarded);
    return;
  }
  const previous = undoStack.pop();
  if (!previous) return;
  restore(previous);
  render();
  save();
  showToast(I18N_IT.undone);
}

// Ferma le animazioni in corso dopo un'azione (undo, nuova partita, riprendi)
function clearTransition() {
  clearTimeout(ui.transitionTimer);
  ui.transitionTimer = null;
  ui.isTransitioning = false;
  ui.holdUid = null;
}

// Blocca il pulsante principale per ms millisecondi, poi esegue then
function lockFor(ms, then) {
  clearTimeout(ui.transitionTimer);
  ui.isTransitioning = true;
  ui.transitionTimer = setTimeout(() => {
    ui.transitionTimer = null;
    ui.isTransitioning = false;
    if (then) then();
    render();
  }, ms);
}

