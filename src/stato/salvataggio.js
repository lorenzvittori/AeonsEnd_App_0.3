// stato/salvataggio.js: Fotografia della partita, ripristino, salvataggio nel browser, undo.
// Fase A del passaggio a Vite: codice spostato da script.js così com'era. Al caricamento il modulo dichiara solo
// funzioni e costanti; il codice che prima girava al caricamento è in avvio(), chiamata da main.js nell'ordine di prima.

import { G } from './condivise.js';
import { I18N_IT } from '../ui/testi.js';
import { GRAVEHOLD_LIFE, SAVE_KEY, SAVE_VERSION, UNDO_LIMIT, emptyStats, nemesisStartLife, ui, undoBtn } from './stato.js';
import { drawTurnCard, isPairCard } from '../regole/mazzo.js';
import { emptyPairNext, historyFromPile, otherOfPair, pickOf } from '../regole/mazzo-turni.js';
import { isVariableMinion, makeEntry } from '../regole/turno-nemesi.js';
import { closeAllModals, showToast } from '../ui/componenti/dialoghi.js';
import { closeDiscard } from '../ui/componenti/scarti.js';
import { DRAW_UID, render } from '../ui/schermate/turno-nemesi.js';
import { closeDeckBuild } from '../ui/schermate/crea-mazzo.js';

// --- 7. Stato della partita: fotografia, ripristino, salvataggio, undo ---------------------------------------------

// Fotografia della partita (solo dati semplici, stesso formato della v48, così si può salvare nel browser)
export function snapshot() {
  return {
    turn: G.turn,
    deck: G.deck.map(c => c.id),
    discard: G.discard.map(c => c.id),
    queue: G.queue.map(e => ({ id: e.data.id, tokens: e.tokens, hp: e.hp, turnHp: e.turnHp, isNew: !!e.isNew, paid: !!e.paid, bornTurn: e.bornTurn,
      // v214: vita impostata (solo i minion a vita variabile)
      // (v218: con la sua vita massima, quella impostata la prima volta)
      ...(isVariableMinion(e.data) ? { hpSet: !!e.hpSet, hpMax: typeof e.hpMax === 'number' ? e.hpMax : null } : {}) })),
    resolving: G.resolving,
    currentIndex: G.currentIndex,
    newIndex: G.newIndex,
    // In più rispetto alla v48 (i salvataggi senza questi campi restano validi)
    maxTierDrawn: G.maxTierDrawn,
    // v254: vite di Gravehold e della nemesi
    graveLife: G.graveLife,
    nemesisLife: G.nemesisLife,
    stats: JSON.parse(JSON.stringify(G.stats)),
    turnOrder: { left: G.turnOrder.left.slice(), drawn: G.turnOrder.drawn.slice(), round: G.turnOrder.round, wild: G.turnOrder.wild || null,
      picks: JSON.parse(JSON.stringify(G.turnOrder.picks || {})),
      // v220: memoria delle carte 1/2 e 3/4 (a chi tocca la prossima carta della coppia)
      pairNext: emptyPairNext(G.turnOrder.pairNext),
      // v222: storia dei turni del giro (barra dei turni)
      history: JSON.parse(JSON.stringify(G.turnOrder.history || [])),
      // v211: carte del mazzo note (parallelo a left) e turno annullato in attesa della carta turno
      known: G.turnOrder.left.map((k, i) => !!(G.turnOrder.known && G.turnOrder.known[i])), waiting: !!G.turnOrder.waiting }
  };
}

// Rimette la partita come nella fotografia (senza animazioni; quelle in corso si fermano)
export function restore(s) {
  const get = id => {
    const card = G.cardsById.get(id);
    if (!card) throw new Error('Carta sconosciuta: ' + id);
    return card;
  };
  // Prima si leggono tutti i dati: se qualcosa non va, la partita in corso resta com'è
  const newDeck = s.deck.map(get);
  const newDiscard = s.discard.map(get);
  const newQueue = s.queue.map(q => Object.assign(makeEntry(get(q.id)), {
    tokens: q.tokens, hp: q.hp, turnHp: q.turnHp === undefined ? q.hp : q.turnHp, isNew: !!q.isNew, paid: !!q.paid,
    bornTurn: typeof q.bornTurn === 'number' ? q.bornTurn : s.turn
  }, isVariableMinion(get(q.id)) ? { hpSet: !!q.hpSet,
    // Vita massima (v218); salvataggi della v214-v217 senza il campo: la più alta tra vita e vita di inizio turno
    hpMax: typeof q.hpMax === 'number' ? q.hpMax : (q.hpSet ? Math.max(q.hp || 0, q.turnHp || 0) : undefined) } : {}));

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
  G.deck = newDeck;
  G.discard = newDiscard;
  G.turn = s.turn;
  G.queue = newQueue;
  // Salvataggi senza il campo: il tier più alto tra le carte già uscite (coda e scarti)
  G.maxTierDrawn = typeof s.maxTierDrawn === 'number' ? s.maxTierDrawn
    : Math.max(0, ...G.queue.map(e => e.data.tier || 0), ...G.discard.map(c => c.tier || 0));
  // v254: vite (salvataggi senza i campi: valori iniziali)
  G.graveLife = typeof s.graveLife === 'number' ? s.graveLife : GRAVEHOLD_LIFE;
  G.nemesisLife = typeof s.nemesisLife === 'number' ? s.nemesisLife : nemesisStartLife();
  // Salvataggi senza statistiche: si parte da zero (mazzo iniziale = tutte le carte della partita)
  G.stats = Object.assign(emptyStats(G.deck.length + G.queue.length + G.discard.length), s.stats ? JSON.parse(JSON.stringify(s.stats)) : {});
  G.stats.minions = Array.isArray(G.stats.minions) ? G.stats.minions : [];
  G.stats.cards = Object.assign(emptyStats(0).cards, G.stats.cards || {});
  G.stats.tierAt = Object.assign({}, G.stats.tierAt || {});
  G.stats.mages = G.stats.mages && typeof G.stats.mages === 'object' ? G.stats.mages : {};

  if (s.resolving && G.queue.length === 0 && G.deck.length > 0) {
    // Turno nemesi con la coda vuota (per esempio il primo turno, se il mazzo dei turni dà subito la nemesi):
    // si torna alla carta da pescare
    G.resolving = true;
    G.currentIndex = 0;
    G.newIndex = -1;
    ui.viewedUid = DRAW_UID;
  } else if (s.resolving && G.queue.length > 0) {
    G.resolving = true;
    G.currentIndex = Math.max(0, Math.min(s.currentIndex, G.queue.length - 1));
    G.newIndex = s.newIndex >= 0 ? Math.min(s.newIndex, G.queue.length - 1) : -1;
    // Dopo un undo le carte hanno uid nuovi: la carta appena pescata è quella in newIndex
    if (G.newIndex >= 0) ui.lastDrawnUid = G.queue[G.newIndex].uid;
    ui.viewedUid = G.queue[G.currentIndex].uid;
  } else {
    G.resolving = false;
    G.currentIndex = 0;
    G.newIndex = -1;
    ui.viewedUid = null;
    // Si mostra la carta più recente
    if (G.queue.length) ui.queueAnchor = { uid: G.queue[G.queue.length - 1].uid, align: G.queue.length === 1 ? 'center' : 'anchor' };
  }
  // Mazzo dei turni. Salvataggi senza (prima della v168): giro nuovo con il turno in corso già estratto
  const savedOrder = s.turnOrder;
  // (drawn vuoto: attesa di "Pesca carta turno", v193, per esempio con l'undo)
  // (v222: nel turno nemesi basta un turno nella storia: la sua carta può essere tornata nel mazzo)
  if (savedOrder && Array.isArray(savedOrder.left) && Array.isArray(savedOrder.drawn)
    && (savedOrder.drawn.length || (Array.isArray(savedOrder.history) && savedOrder.history.length) || !G.resolving)) {
    // Salvataggi della v168 senza il contatore dei giri: si parte dai turni nemesi giocati
    G.turnOrder = { left: savedOrder.left.slice(), drawn: savedOrder.drawn.slice(),
      round: typeof savedOrder.round === 'number' ? savedOrder.round : Math.max(1, s.turn),
      // Salvataggi prima della v179 con 3 giocatori: il jolly si sceglie a caso
      wild: Number(G.settings.players) === 3
        ? (savedOrder.wild >= 1 && savedOrder.wild <= 3 ? savedOrder.wild : 1 + Math.floor(Math.random() * 3)) : null,
      // Giocatori scelti per le carte 1/2 e 3/4 (v192; prima non c'erano)
      picks: savedOrder.picks && typeof savedOrder.picks === 'object' ? Object.assign({}, savedOrder.picks) : {} };
    // Carte note e attesa (v211; senza il campo: nessuna carta nota, nessun turno annullato)
    const known = Array.isArray(savedOrder.known) && savedOrder.known.length === G.turnOrder.left.length ? savedOrder.known : [];
    G.turnOrder.known = G.turnOrder.left.map((k, i) => !!known[i]);
    // (v222: il turno non si annulla più; resta per i salvataggi v211-v221 con un turno annullato)
    G.turnOrder.waiting = !!savedOrder.waiting && !G.resolving && G.turnOrder.drawn.length > 0;
    // Carte 1/2 e 3/4 (v220): picks come { player, forced } e memoria per coppia. Salvataggi di prima (picks a stringhe,
    // senza pairNext): la seconda carta della coppia nel giro non aveva un pick (si deduceva dalla prima): si ricostruisce
    // come obbligata, e la memoria dalle carte del giro
    if (savedOrder.pairNext && typeof savedOrder.pairNext === 'object') {
      const picks = {};
      Object.keys(G.turnOrder.picks).forEach(i => { const p = pickOf(G.turnOrder, Number(i)); if (p) picks[i] = { player: p.player, forced: !!p.forced }; });
      G.turnOrder.picks = picks;
      G.turnOrder.pairNext = emptyPairNext(savedOrder.pairNext);
    } else {
      const picks = {};
      const next = { p12: null, p34: null };
      G.turnOrder.drawn.forEach((kind, i) => {
        if (!isPairCard(kind)) return;
        const p = pickOf(G.turnOrder, i);
        if (p) { picks[i] = { player: p.player, forced: false }; next[kind] = otherOfPair(kind, p.player); }
        else if (next[kind]) { picks[i] = { player: next[kind], forced: true }; next[kind] = null; }
      });
      G.turnOrder.picks = picks;
      G.turnOrder.pairNext = next;
    }
    // Storia dei turni del giro (v222); salvataggi di prima: un turno per ogni carta negli scarti dei turni
    G.turnOrder.history = Array.isArray(savedOrder.history)
      ? savedOrder.history.filter(e => e && e.kind).map(e => ({ kind: e.kind, player: e.player || null, forced: !!e.forced,
        pos: typeof e.pos === 'number' && e.pos >= 0 && e.pos < G.turnOrder.drawn.length ? e.pos : null }))
      : historyFromPile(G.turnOrder);
  } else {
    G.turnOrder = { left: [], drawn: [], round: Math.max(1, s.turn) - 1, known: [], waiting: false, pairNext: emptyPairNext(), history: [] };
    drawTurnCard(c => (G.resolving ? c === 'nemesis' : c !== 'nemesis'));
  }
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
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, settings: G.settings, state: snapshot(), undo: G.undoStack }));
  } catch (err) {
    console.warn('Salvataggio non riuscito', err);
  }
}

export function readSave() {
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
