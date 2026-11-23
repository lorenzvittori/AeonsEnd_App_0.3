// stato/salvataggio.ts: fotografia della partita, ripristino, salvataggio nel browser, undo, blocco del pulsante
// principale durante le animazioni.
// Dipende da: regole/salvataggio.ts, stato/ (condivise, stato, partita), ui (dialoghi, scarti, turno-nemesi,
// crea-mazzo). Usato da: quasi tutta l'interfaccia (act, save, undo), avvio e Modalità test.

import * as Salv from '../regole/salvataggio.ts';
import { parseJson } from '../regole/json.ts';
import { G } from './condivise.ts';
import { I18N_IT } from '../ui/testi.ts';
import { SAVE_KEY, SAVE_VERSION, UNDO_LIMIT, ui, undoBtn } from './stato.ts';
import { turnOrderCards } from './partita.ts';
import { closeAllModals, showToast } from '../ui/componenti/dialoghi.ts';
import { closeDiscard } from '../ui/componenti/scarti.ts';
import { DRAW_UID, render } from '../ui/schermate/turno-nemesi.ts';
import { closeDeckBuild } from '../ui/schermate/crea-mazzo.ts';
import type { Fotografia, FotografiaLetta, SalvataggioValido } from '../tipi/salvataggio.ts';

// Fotografia della partita (solo dati semplici, così si può salvare nel browser; formato in regole/salvataggio.ts)
export function snapshot(): Fotografia {
  return Salv.snapshotGame(G);
}

// Rimette la partita come nella fotografia (senza animazioni; quelle in corso si fermano); formati vecchi letti da
// regole/salvataggio.ts
export function restore(s: FotografiaLetta): void {
  // Prima si leggono tutti i dati: se qualcosa non va, la partita in corso resta com'è
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
export function save(): void {
  // Modalità test: niente salvataggio, la partita salvata vera resta com'è
  if (G.testRun) return;
  // Pagina scheletri/ (misura dell'app in un iframe): app.noSave = true e la partita salvata non cambia (con i moduli
  // ES la pagina non può sostituire la funzione save)
  if (G.noSave) return;
  if (G.turn < 1 && !ui.gameSaved) return;
  ui.gameSaved = true;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(Salv.buildSave(SAVE_VERSION, G.settings, snapshot(), G.undoStack)));
  } catch (err) {
    console.warn('Salvataggio non riuscito', err);
  }
}

export function readSave(): SalvataggioValido | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const saved = raw === null ? null : parseJson(raw);
    const check = Salv.checkSave(saved, SAVE_VERSION);
    // Salvataggio di un'altra versione (carte con gli id di prima del DataBase): si ignora e si cancella
    if (check === 'other-version') {
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
    if (check === 'ok' && Salv.isResumableSave(saved)) return saved;
  } catch (err) {
    console.warn('Salvataggio illeggibile', err);
  }
  return null;
}

export function updateUndoBtn(): void {
  undoBtn.disabled = G.undoStack.length === 0 && ui.drafts.size === 0;
}

// Aggiunge un passo di undo (lo stato prima di un'azione), tenendone al massimo UNDO_LIMIT
export function pushUndo(state: FotografiaLetta): void {
  G.undoStack.push(state);
  if (G.undoStack.length > UNDO_LIMIT) G.undoStack.shift();
}

// Ogni azione che cambia la partita: prima si salva lo stato per l'undo, poi si fa l'azione, poi si salva la partita
export function act<T>(action: () => T): T {
  pushUndo(snapshot());
  const result = action();
  save();
  return result;
}

// Undo: torna allo stato prima dell'ultima azione (si può ripetere fino all'inizio della partita)
export function undo(): void {
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
export function clearTransition(): void {
  if (ui.transitionTimer !== null) clearTimeout(ui.transitionTimer);
  ui.transitionTimer = null;
  ui.isTransitioning = false;
  ui.holdUid = null;
}

// Blocca il pulsante principale per ms millisecondi, poi esegue then
export function lockFor(ms: number, then?: () => void): void {
  if (ui.transitionTimer !== null) clearTimeout(ui.transitionTimer);
  ui.isTransitioning = true;
  ui.transitionTimer = setTimeout(() => {
    ui.transitionTimer = null;
    ui.isTransitioning = false;
    if (then) then();
    render();
  }, ms);
}

// Al caricamento non c'è niente da fare (main.ts chiama avvio() di ogni modulo)
export function avvio(): void {
}
