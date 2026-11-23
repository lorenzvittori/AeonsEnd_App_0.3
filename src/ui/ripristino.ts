// ui/ripristino.ts: la partita rimessa com'era in una fotografia, vista dall'interfaccia: restore (ripresa, undo,
// scenari della Modalità test), undo (pulsante Annulla), pulsante Undo attivo o no, blocco del pulsante principale
// durante le animazioni (clearTransition, lockFor).
// La partita la cambia stato/partita.ts (preparaRipristino, applicaRipristino, togliPassoUndo); qui si fermano le
// animazioni, si chiudono finestre e "Crea mazzo" e si sceglie cosa mostrare.
// Dipende da: stato/partita.ts, stato/salvataggio.ts, ui/pagina.ts, ui/testi.ts, ui/componenti (dialoghi, scarti),
// ui/schermate (turno-nemesi, crea-mazzo). Usato da: ui/ (menu, opzioni, test, turno-nemesi, turno-giocatori, menu
// laterale, pesca-undo...), main.ts (app.restore, app.undo).

import { partita, applicaRipristino, preparaRipristino, togliPassoUndo } from '../stato/partita.ts';
import { save } from '../stato/salvataggio.ts';
import { I18N_IT } from './testi.ts';
import { ui, undoBtn } from './pagina.ts';
import { closeAllModals, showToast } from './componenti/dialoghi.ts';
import { closeDiscard } from './componenti/scarti.ts';
import { DRAW_UID, render } from './schermate/turno-nemesi.ts';
import { closeDeckBuild } from './schermate/crea-mazzo.ts';
import type { FotografiaLetta } from '../tipi/salvataggio.ts';

// Rimette la partita come nella fotografia (senza animazioni; quelle in corso si fermano); formati vecchi letti da
// regole/salvataggio.ts
export function restore(s: FotografiaLetta): void {
  // Prima si leggono tutti i dati: se qualcosa non va, la partita in corso resta com'è
  const { game, view } = preparaRipristino(s);

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
  applicaRipristino(game);
  // Carta mostrata: passo Pesca, carta da risolvere o (turno giocatori) nessuna, con la carta più recente in vista
  ui.viewedUid = view.viewed === 'draw' ? DRAW_UID : view.viewed;
  // Dopo un undo le carte hanno uid nuovi: la carta appena pescata è quella in newIndex
  if (view.lastDrawnUid !== null) ui.lastDrawnUid = view.lastDrawnUid;
  if (view.anchor) ui.queueAnchor = view.anchor;
}

export function updateUndoBtn(): void {
  undoBtn.disabled = partita.undoStack.length === 0 && ui.drafts.size === 0;
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
  const previous = togliPassoUndo();
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
