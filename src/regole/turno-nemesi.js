// regole/turno-nemesi.js: Statistiche, pesca dal mazzo nemesi, vittoria, carte in gioco e minion a vita variabile.
// Fase A del passaggio a Vite: codice spostato da script.js così com'era. Al caricamento il modulo dichiara solo
// funzioni e costanti; il codice che prima girava al caricamento è in avvio(), chiamata da main.js nell'ordine di prima.

import { G } from '../stato/condivise.js';
import { statCard } from '../stato/stato.js';

// --- Statistiche: si aggiornano quando una carta esce dal gioco ---

// Costo in Æ per scartare un potere (removalCost di cards.json); 0 se il costo non è in Æ (carte in mano, varchi...)
export function aetherCost(data) {
  return Number(data.removalCost) || 0;
}

// Minion ucciso (vita a 0, negli scarti)
export function countMinionKilled(entry) {
  G.stats.minionsKilled++;
  statCard('minionsKilled', entry.data);
  G.stats.minions.push({ id: entry.data.id, name: entry.data.name, turns: Math.max(0, G.turn - (entry.bornTurn || 0)) });
}

// Potere scartato pagando il costo
export function countPowerPaid(entry) {
  G.stats.powersPaid++;
  statCard('powersPaid', entry.data);
  G.stats.aetherSpent += aetherCost(entry.data);
}

// Carte grigie che escono dal gioco (minion a 0, poteri pagati): contate e messe negli scarti
export function discardGone(entry) {
  if (entry.data.type === 'Minion') countMinionKilled(entry);
  else if (entry.data.type === 'Power') countPowerPaid(entry);
  discardEntry(entry);
}

// Pesca la carta in cima al mazzo. Regole di Aeon's End: il mazzo nemesi non si rimescola; se è vuoto la nemesi non
// pesca (null). Con mazzo vuoto e nessun potere o minion in gioco i giocatori vincono (checkVictory).
export function drawFromDeck() {
  return G.deck.pop() || null;
}

// Vittoria: mazzo nemesi vuoto e nessun potere né minion in gioco (dopo il primo turno nemesi)
export function isVictory() {
  return G.turn > 0 && G.deck.length === 0 && !G.queue.some(e => e.data.type === 'Power' || e.data.type === 'Minion');
}

// Carta in gioco (nella coda) con il suo stato
export function makeEntry(data) {
  // turnHp: vita del minion all'inizio del turno dei giocatori (per mostrare il danno o la cura del turno)
  // paid: potere con costo pagato (salvato nel turno giocatori), grigio fino al turno nemesi, poi negli scarti
  // bornTurn: turno nemesi in cui la carta è stata pescata (per i turni in gioco dei minion nelle statistiche)
  // hpSet (v214): minion con vita variabile (data.hpVariable, la decidono i giocatori): entra in gioco senza vita ("?",
  // hp 0, turnHp null) finché non la si imposta una volta; prima non muore a 0
  if (isVariableMinion(data)) {
    return { uid: G.nextUid++, data, tokens: data.powerTokens, hp: 0, turnHp: null, hpSet: false, isNew: false, paid: false, bornTurn: G.turn };
  }
  return { uid: G.nextUid++, data, tokens: data.powerTokens, hp: data.hp, turnHp: data.hp, isNew: false, paid: false, bornTurn: G.turn };
}

// Minion con vita variabile (v214) e minion la cui vita non è ancora stata impostata ("?")
export function isVariableMinion(data) {
  return data.type === 'Minion' && data.hpVariable === true;
}

export function hpUnset(entry) {
  return isVariableMinion(entry.data) && !entry.hpSet;
}

// Vita massima: quella della carta o, per un minion a vita variabile, quella impostata la prima volta (hpMax, v218)
export function hpMaxOf(entry) {
  return isVariableMinion(entry.data) ? entry.hpMax : entry.data.hp;
}

// Tetto del +1: vita massima e vita di inizio turno (turno giocatori). Minion a vita variabile non ancora impostata:
// nessun tetto (si sceglie la vita); dopo, la vita impostata è la sua vita massima (v218)
export function hpCap(entry, nemesisTurn) {
  if (hpUnset(entry)) return Infinity;
  const max = hpMaxOf(entry);
  if (nemesisTurn) return max;
  return Math.min(max, entry.turnHp === undefined || entry.turnHp === null ? entry.hp : entry.turnHp);
}

// Toglie la carta dalla coda e la mette nella pila degli scarti
export function discardEntry(entry) {
  const i = G.queue.indexOf(entry);
  if (i >= 0) G.queue.splice(i, 1);
  G.discard.push(entry.data);
}

export function entryByUid(uid) {
  return G.queue.find(e => e.uid === uid) || null;
}

// Codice eseguito all'avvio (prima: al caricamento di script.js), nell'ordine di prima
export function avvio() {
}
