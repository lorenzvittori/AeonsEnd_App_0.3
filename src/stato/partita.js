// stato/partita.js: collegamento tra la partita in corso e le regole di gioco (src/regole/).
// Le regole sono pure (ricevono tutto come argomenti); qui le stesse operazioni con i nomi usati dal resto dell'app:
// leggono e scrivono lo stato (G: partita, scelte, dati), le preferenze del browser (localStorage) e passano alle
// regole il caso (Math.random) e l'ora (Date.now). Usato da: interfaccia (ui/), stato/salvataggio.js, dati/.
// Provvisorio fino alla fase D (stato unico): G è l'oggetto delle variabili condivise (stato/condivise.js).

import { G } from './condivise.js';
import { GRAVEHOLD_LIFE, emptyStats, nemesisBtn, nemesisStartLife, ui } from './stato.js';
import { act } from './salvataggio.js';
import * as Mazzo from '../regole/mazzo-nemesi.js';
import * as Turni from '../regole/mazzo-turni.js';
import * as Nemesi from '../regole/turno-nemesi.js';
import { announce } from '../ui/componenti/dialoghi.js';
import { nemesisTurn, render } from '../ui/schermate/turno-nemesi.js';
import { turnTrack } from '../ui/eventi.js';

// Regole senza stato, usate così come sono
export { isPairCard, pairOptions, emptyPairNext, pickOf, otherOfPair, historyFromPile, predictedPairPlayers, takeFromTurnPile } from '../regole/mazzo-turni.js';
export { aetherCost, isVariableMinion, hpUnset, hpMaxOf, hpCap } from '../regole/turno-nemesi.js';

// Dati per le regole del mazzo nemesi
export function rulesDb() {
  return { cards: G.allCards, nemeses: G.nemeses, deckSetup: G.deckSetup };
}

// --- Mazzo nemesi ---

// Opzioni del mazzo ("Modalità battaglia", "Unisci le carte della collezione"): preferenza del browser, ricordata tra
// le partite e copiata nelle scelte della partita (G.settings). Mancanti = attive
export const DECK_OPTIONS_KEY = 'aeonsend-app-0.2-deck-options';

export function loadDeckOptions() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(DECK_OPTIONS_KEY)); } catch (err) { /* predefinite */ }
  return { battleMode: !(saved && saved.battleMode === false), mergeCollection: !(saved && saved.mergeCollection === false) };
}

export function saveDeckOptions() {
  try {
    localStorage.setItem(DECK_OPTIONS_KEY, JSON.stringify({ battleMode: G.settings.battleMode !== false, mergeCollection: G.settings.mergeCollection !== false }));
  } catch (err) { console.warn(err); }
}

export function deckSetupRow(s = G.settings) { return Mazzo.deckSetupRow(rulesDb(), s); }
export function ownedUpgradedInWave(wave) { return Mazzo.ownedUpgradedInWave(rulesDb(), G.collection, wave); }
export function mergeLockedWave(s = G.settings) { return Mazzo.mergeLockedWave(rulesDb(), G.collection, s); }
export function mergeActive(s = G.settings) { return Mazzo.mergeActive(rulesDb(), G.collection, s); }
export function deckPool(category, tier, s = G.settings) { return Mazzo.deckPool(rulesDb(), G.collection, category, tier, s); }
export function deckShortfall(s = G.settings) { return Mazzo.deckShortfall(rulesDb(), G.collection, s); }

// Ultimo mazzo creato: quante carte vengono da ognuno dei 9 mazzi (schermata "Crea mazzo")
export let deckPlan = [];

// Mazzo nemesi per le scelte della partita (vuoto se nessuna nemesi giocabile)
export function buildDeck() {
  const built = Mazzo.buildDeck(rulesDb(), G.collection, G.settings, Math.random);
  deckPlan = built.plan;
  return built.deck;
}

// Nuova partita: vite iniziali, mazzo nuovo, scarti vuoti, turni a zero, statistiche da zero (con l'ora di inizio) e
// mazzo dei turni da cominciare (finito "Crea mazzo" si aspetta "Pesca carta turno")
export function newGame() {
  G.graveLife = GRAVEHOLD_LIFE;
  G.nemesisLife = nemesisStartLife();
  G.deck = buildDeck();
  G.discard = [];
  G.turn = 0;
  G.maxTierDrawn = 0;
  G.stats = emptyStats(G.deck.length);
  G.stats.startedAt = Date.now();
  G.turnOrder = Turni.newTurnOrder();
}

// --- Mazzo dei turni ---

// Opzione "Carte turno 1/2 e 3/4" (preferenza del browser, vale dal prossimo giro). Lo scenario della Modalità test può
// sceglierla solo per sé (G.testRun.pairs)
export const TURN_PAIRS_KEY = 'aeonsend-app-0.2-turn-pairs';

export function turnPairsOn() {
  if (G.testRun && typeof G.testRun.pairs === 'boolean') return G.testRun.pairs;
  try { return localStorage.getItem(TURN_PAIRS_KEY) !== 'off'; } catch (err) { return true; }
}

export function setTurnPairs(on) {
  try { localStorage.setItem(TURN_PAIRS_KEY, on ? 'on' : 'off'); } catch (err) { console.warn(err); }
}

// Carte del mazzo dei turni per un giro nuovo (lo scenario della Modalità test può avere le sue: G.testRun.turnCards)
export function turnOrderCards(players) {
  if (G.testRun && G.testRun.turnCards) return G.testRun.turnCards.slice();
  return Turni.turnOrderCards(players, () => turnPairsOn());
}

export function playerKinds() { return Turni.playerKinds(G.settings.players); }

export function awaitingTurnCard() { return Turni.awaitingTurnCard(G.turnOrder, G.resolving); }

// "Pesca carta turno": il primo turno del giro; se è la nemesi parte subito il turno nemesi
export function drawFirstTurn() {
  if (drawTurnCard() === 'nemesis') nemesisTurn();
}

export function shuffleTurnOrder() {
  G.turnOrder = Turni.shuffleTurnOrder(G.turnOrder, G.settings.players, turnOrderCards(G.settings.players), Math.random);
}

export function turnRoundOver() { return Turni.turnRoundOver(G.turnOrder); }

// Fine di un turno: la carta turno dopo, o a fine giro il mazzo mescolato e l'attesa (null)
export function nextTurnCard() {
  if (turnRoundOver()) { shuffleTurnOrder(); return null; }
  return drawTurnCard();
}

// Carta dalla cima del mazzo dei turni (pick: salvataggi vecchi). Le carte del giro nuovo si leggono solo a mazzo vuoto
export function drawTurnCard(pick) {
  const r = Turni.drawTurnCard(G.turnOrder, { players: G.settings.players, pick, random: Math.random,
    cards: () => turnOrderCards(G.settings.players) });
  G.turnOrder = r.order;
  return r.card;
}

export function currentTurn(order = G.turnOrder) { return Turni.currentTurn(order); }
export function currentTurnCard() { const cur = currentTurn(); return cur ? cur.kind : null; }
export function historyPlayer(entry) { return Turni.historyPlayer(entry, G.turnOrder.wild); }
// (il wild si legge sempre dal mazzo dei turni della partita, anche con la bozza della finestra)
export function turnCardPlayer(kind, i, order = G.turnOrder) { return Turni.turnCardPlayer(kind, i, order, G.turnOrder.wild); }

// Scelta del giocatore per la carta 1/2 o 3/4 del turno in corso (un passo di undo), poi la barra dei turni
export function chooseTurnPlayer(player) {
  const cur = currentTurn();
  if (G.resolving || ui.isTransitioning || !cur || !isPairCardLocal(cur.kind) || cur.player) return;
  act(() => { Turni.choosePairPlayer(G.turnOrder, player); });
  render();
  announce(turnTrack.getAttribute('aria-label'));
  nemesisBtn.focus({ preventScroll: true });
  turnTrack.classList.remove('is-changed');
  void turnTrack.offsetWidth;
  turnTrack.classList.add('is-changed');
}
function isPairCardLocal(kind) { return Turni.isPairCard(kind); }

// --- Carte in gioco e turno nemesi ---

export function makeEntry(data) { return Nemesi.makeEntry(data, G.nextUid++, G.turn); }
export function entryByUid(uid) { return Nemesi.entryByUid(G.queue, uid); }
export function countMinionKilled(entry) { Nemesi.countMinionKilled(G.stats, entry, G.turn); }
export function countPowerPaid(entry) { Nemesi.countPowerPaid(G.stats, entry); }
export function discardEntry(entry) { Nemesi.discardEntry(G, entry); }
export function discardGone(entry) { Nemesi.discardGone(G, entry); }
export function drawFromDeck() { return Nemesi.drawFromDeck(G); }
export function isVictory() { return Nemesi.isVictory(G); }

// Al caricamento non c'è niente da fare (main.js chiama avvio() di ogni modulo)
export function avvio() {
}
