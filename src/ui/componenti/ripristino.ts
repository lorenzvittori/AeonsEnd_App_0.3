// ui/componenti/ripristino.ts: la partita rimessa com'era in una fotografia, vista dall'interfaccia: restore (ripresa,
// undo, scenari della Modalità test), undo (pulsante Annulla e menu), pulsante Undo attivo o no.
// La partita la cambia stato/partita.ts (preparaRipristino, applicaRipristino, togliPassoUndo); qui si fermano le
// animazioni, si chiudono finestre, scarti e "Crea mazzo" (aggancio chiudiCreaMazzo) e si sceglie cosa mostrare.
// Livello 3 (ui/componenti/). Dipende da: stato/partita.ts, ui/ base (pagina, testi, ridisegno), ui/componenti
// (animazioni, dialoghi, scarti). Usato da: pesca-undo, menu laterale, Modalità test, navigazione (ripresa, pulsante
// Undo), main.ts (app.restore, app.undo).

import { applicaRipristino, partita, preparaRipristino, save, togliPassoUndo } from '../../stato/partita.ts';
import type { FotografiaLetta } from '../../tipi/salvataggio.ts';
import { clearTransition } from './animazioni.ts';
import { closeAllModals, showToast } from './dialoghi.ts';
import { closeDiscard } from './scarti.ts';
import { DRAW_UID, ui, undoBtn } from '../pagina.ts';
import { chiudiCreaMazzo, richiediRidisegno } from '../ridisegno.ts';
import { I18N_IT } from '../testi.ts';

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
  chiudiCreaMazzo();
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
    richiediRidisegno();
    showToast(I18N_IT.draftDiscarded);
    return;
  }
  const previous = togliPassoUndo();
  if (!previous) return;
  restore(previous);
  richiediRidisegno();
  save();
  showToast(I18N_IT.undone);
}

