// regole/mazzo-turni.js: Storia dei turni del giro, memoria delle coppie 1/2 e 3/4, carte tolte dagli scarti dei turni, scelta del giocatore.
// Fase A del passaggio a Vite: codice spostato da script.js così com'era. Al caricamento il modulo dichiara solo
// funzioni e costanti; il codice che prima girava al caricamento è in avvio(), chiamata da main.js nell'ordine di prima.

import { G } from '../stato/condivise.js';
import { nemesisBtn, ui } from '../stato/stato.js';
import { isPairCard, pairOptions } from './mazzo.js';
import { announce } from '../ui/componenti/dialoghi.js';
import { act } from '../stato/salvataggio.js';
import { render } from '../ui/schermate/turno-nemesi.js';
import { turnTrack } from '../ui/eventi.js';

// --- Storia dei turni del giro (v222) ---
// turnOrder.history = [{ kind, player, forced, pos }]: un elemento per ogni turno cominciato nel giro, nell'ordine;
// l'ultimo è il turno in corso. player: chi ha giocato una carta 1/2 o 3/4 (null finché non si sceglie; per le altre
// carte si ricava dal tipo, per il wild da turnOrder.wild). pos: posizione della carta negli scarti dei turni
// (turnOrder.drawn), null se la carta non è più negli scarti (rimessa nel mazzo dalla finestra del mazzo dei turni).
// La barra dei turni mostra la storia (turni passati e turno in corso) più le carte del mazzo: una carta rimessa nel
// mazzo resta come turno passato e compare anche come turno futuro; il turno in corso continua anche se la sua carta
// torna nel mazzo. Riparte vuota a ogni giro (shuffleTurnOrder).
export function currentTurn(order = G.turnOrder) {
  if (order.waiting) return null;
  const h = order.history || [];
  return h.length ? h[h.length - 1] : null;
}

// Storia ricostruita dagli scarti dei turni (salvataggi di prima della v222): ogni carta negli scarti è un turno
export function historyFromPile(order) {
  return (order.drawn || []).map((kind, i) => {
    const pick = isPairCard(kind) ? pickOf(order, i) : null;
    return { kind, player: pick ? pick.player : null, forced: !!(pick && pick.forced), pos: i };
  });
}

// Giocatore di un turno della storia: 'p1'..'p4' (wild: chi è wild nel giro), null per la nemesi o per una 1/2 o 3/4
// non ancora scelta
export function historyPlayer(entry) {
  if (!entry) return null;
  if (entry.kind === 'wild') return G.turnOrder.wild ? 'p' + G.turnOrder.wild : null;
  if (isPairCard(entry.kind)) return entry.player || null;
  return entry.kind && entry.kind !== 'nemesis' ? entry.kind : null;
}

// Giocatori dedotti per le carte 1/2 e 3/4 del mazzo dei turni (dalla cima), seguendo la memoria delle coppie: una
// carta obbligata ha il suo giocatore; dopo una carta da scegliere quelle della stessa coppia non si sanno
export function predictedPairPlayers(order) {
  const mem = emptyPairNext(order.pairNext);
  const unknown = { p12: false, p34: false };
  return (order.left || []).map(kind => {
    if (!isPairCard(kind) || unknown[kind]) return null;
    if (mem[kind]) { const p = mem[kind]; mem[kind] = null; return p; }
    unknown[kind] = true;
    return null;
  });
}

// --- Carte turno 1/2 e 3/4: memoria per coppia (v220) ---
// pairNext: { p12: null | 'p1' | 'p2', p34: null | 'p3' | 'p4' } = a chi tocca la prossima carta della coppia (null:
// si sceglie). Dura tra un giro e l'altro; riparte da "nessuno" con Nuova partita e "Ricomincia la partita" (newGame).
// picks[pos] = { player, forced } per ogni carta della coppia negli scarti dei turni: chi l'ha giocata e se era scelta
// (forced false) o obbligata dalla memoria (forced true). I picks di prima della v220 sono stringhe (scelte).
export function emptyPairNext(old) {
  return { p12: old && old.p12 ? old.p12 : null, p34: old && old.p34 ? old.p34 : null };
}

export function pickOf(order, i) {
  const p = order.picks && order.picks[i];
  if (!p) return null;
  return typeof p === 'string' ? { player: p, forced: false } : (p.player ? p : null);
}

export function otherOfPair(kind, player) {
  return pairOptions(kind).find(p => p !== player) || null;
}

// --- Mazzo dei turni (v206, finestra unica dalla v211) ---
// Carte tolte dagli scarti dei turni (posizioni in order.drawn): i giocatori scelti per le carte 1/2 e 3/4 restano
// attaccati alle carte che restano negli scarti; la scelta delle carte tolte si perde. order: turnOrder o la bozza della
// finestra del mazzo dei turni. Restituisce le carte tolte, nell'ordine degli scarti.
export function takeFromTurnPile(order, positions) {
  const take = new Set(positions.filter(i => i >= 0 && i < order.drawn.length));
  const keep = [];
  const picks = {};
  order.drawn.forEach((kind, i) => {
    if (take.has(i)) return;
    if (order.picks && order.picks[i]) picks[keep.length] = order.picks[i];
    keep.push(kind);
  });
  const taken = [...take].sort((a, b) => a - b).map(i => order.drawn[i]);
  // (v222) La storia dei turni segue le carte: posizione nuova negli scarti, o null per quelle tolte
  if (Array.isArray(order.history)) {
    const newPos = {};
    let k = 0;
    order.drawn.forEach((kind, i) => { if (!take.has(i)) newPos[i] = k++; });
    order.history = order.history.map(e => Object.assign({}, e, { pos: e.pos === null || e.pos === undefined || !(e.pos in newPos) ? null : newPos[e.pos] }));
  }
  order.drawn = keep;
  order.picks = picks;
  return taken;
}

// Carta del turno in corso (l'ultimo turno della storia del giro); null in attesa della carta turno
export function currentTurnCard() {
  const cur = currentTurn();
  return cur ? cur.kind : null;
}

// Giocatore a cui va una carta del mazzo dei turni: 'p1'..'p4'; il jolly va al giocatore che è jolly in questo giro
// (null per la nemesi)
// Carta x/y (v192; v220): il giocatore che l'ha giocata, scelto o obbligato dalla memoria della coppia (picks, per
// posizione negli scarti dei turni); null se è ancora da scegliere o se la carta è nel mazzo (i = -1).
// i: posizione della carta in turnOrder.drawn (-1 = nel mazzo); senza i (v222): il turno in corso, dalla storia.
// order: turnOrder o la bozza della finestra del mazzo dei turni (v211)
export function turnCardPlayer(kind, i, order = G.turnOrder) {
  if (kind === 'wild') return G.turnOrder.wild ? 'p' + G.turnOrder.wild : null;
  if (isPairCard(kind)) {
    if (i === undefined) { const cur = currentTurn(order); return cur && cur.kind === kind ? cur.player || null : null; }
    const pick = i >= 0 ? pickOf(order, i) : null;
    return pick ? pick.player : null;
  }
  return kind && kind !== 'nemesis' ? kind : null;
}

// Scelta del giocatore per la carta x/y del turno in corso (si può annullare con Undo)
export function chooseTurnPlayer(player) {
  const cur = currentTurn();
  if (G.resolving || ui.isTransitioning || !cur || !isPairCard(cur.kind) || cur.player) return;
  // (v220) Carta SCELTA: la prossima carta della coppia tocca all'altro giocatore (memoria). Undo riporta tutto
  // (v222: il giocatore va nella storia del turno e, se la carta è ancora negli scarti, sulla carta)
  act(() => {
    const kind = cur.kind;
    const h = G.turnOrder.history.slice();
    h[h.length - 1] = Object.assign({}, cur, { player, forced: false });
    G.turnOrder.history = h;
    if (cur.pos !== null && cur.pos !== undefined) {
      G.turnOrder.picks = Object.assign({}, G.turnOrder.picks, { [cur.pos]: { player, forced: false } });
    }
    G.turnOrder.pairNext = Object.assign(emptyPairNext(G.turnOrder.pairNext), { [kind]: otherOfPair(kind, player) });
  });
  render();
  announce(turnTrack.getAttribute('aria-label'));
  nemesisBtn.focus({ preventScroll: true });
  turnTrack.classList.remove('is-changed');
  void turnTrack.offsetWidth;
  turnTrack.classList.add('is-changed');
}

// Codice eseguito all'avvio (prima: al caricamento di script.js), nell'ordine di prima
export function avvio() {
}
