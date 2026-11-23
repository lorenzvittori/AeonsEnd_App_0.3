// regole/mazzo.js: Opzioni del mazzo, Nemesis Deck Setup, creazione del mazzo nemesi, nuova partita e pesca del mazzo dei turni.
// Fase A del passaggio a Vite: codice spostato da script.js così com'era. Al caricamento il modulo dichiara solo
// funzioni e costanti; il codice che prima girava al caricamento è in avvio(), chiamata da main.js nell'ordine di prima.

import { G } from '../stato/condivise.js';
import { GRAVEHOLD_LIFE, emptyStats, nemesisStartLife } from '../stato/stato.js';
import { battleOf, pickRandom, shuffle } from '../dati/dati.js';
import { cardAllowed, ownsProduct, waveOfCode, waveOfNemesis } from '../dati/collezione.js';
import { currentTurn, emptyPairNext } from './mazzo-turni.js';
import { nemesisTurn } from '../ui/schermate/turno-nemesi.js';

// --- Opzioni del mazzo (v213), nella pagina Nuova partita sopra la wave ---
// battleMode ("Modalità battaglia"): attivo = numeri di deck-setup.json per la battaglia della nemesi (Basic +
//   Upgraded); spento = setup standard, sempre la riga della battaglia 1 (solo Basic), qualunque sia la battaglia.
// mergeCollection ("Unisci le carte della collezione"): attivo = Basic e Upgraded da tutti i prodotti della collezione;
//   spento = solo dai prodotti della collezione della stessa wave della nemesi (scatola base + mini espansioni).
// Preferenza del browser (DECK_OPTIONS_KEY), ricordata tra le partite e copiata in settings della partita (salvataggio,
// "Ricomincia la partita"). Salvataggi senza i campi: entrambe attive (come prima della v213); il vecchio
// settings.includeUpgraded non si usa più.
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

// Riga di deck-setup.json usata dal mazzo: la battaglia della nemesi o, senza "Modalità battaglia", la battaglia 1
// (con le Upgraded a 0). null se la nemesi non ha battaglia
export function deckSetupRow(s = G.settings) {
  const battleMode = s.battleMode !== false;
  const battle = G.deckSetup.battles.find(b => b.battle === (battleMode ? battleOf(s.nemesis) : 1));
  const row = battle && battle.players[String(s.players)];
  if (!row) return null;
  return battleMode ? row : { basic: row.basic, upgradedBasic: { 1: 0, 2: 0, 3: 0 } };
}

// Carte Upgraded del mazzo nemesi nei prodotti posseduti di una wave
export function ownedUpgradedInWave(wave) {
  return G.allCards.some(c => c.category === 'Upgraded' && c.inNemesisDeck === true && c.boxCode
    && waveOfCode(c.boxCode) === wave && ownsProduct(c.boxCode));
}

// Conflitto (decisione dell'utente): con "Modalità battaglia" la battaglia chiede carte Upgraded ma la wave della
// nemesi, nella collezione, non ne ha: "Unisci" resta acceso e bloccato. Restituisce la wave (o null se non c'è blocco)
export function mergeLockedWave(s = G.settings) {
  if (s.battleMode === false) return null;
  const info = G.nemeses.find(n => n.name === s.nemesis);
  const row = deckSetupRow(s);
  if (!info || !info.boxCode || !row) return null;
  const wantsUpgraded = [1, 2, 3].some(t => (row.upgradedBasic[t] || 0) > 0);
  const wave = waveOfNemesis(info);
  return wantsUpgraded && !ownedUpgradedInWave(wave) ? wave : null;
}

export function mergeActive(s = G.settings) {
  return s.mergeCollection !== false || !!mergeLockedWave(s);
}

// Carte Basic / Upgraded che possono entrare nel mazzo per un Tier: della collezione e, senza "Unisci", della wave
// della nemesi
export function deckPool(category, tier, s = G.settings) {
  const info = G.nemeses.find(n => n.name === s.nemesis);
  const wave = info ? waveOfNemesis(info) : null;
  const merge = mergeActive(s);
  return G.allCards.filter(c => c.category === category && c.inNemesisDeck === true && c.tier === tier && cardAllowed(c)
    && (merge || waveOfCode(c.boxCode) === wave));
}

// Carte che mancano rispetto a deck-setup.json (per la riga di avviso prima di "Inizia partita"): { want, have }
export function deckShortfall(s = G.settings) {
  const row = deckSetupRow(s);
  if (!row) return null;
  let want = 0;
  let have = 0;
  [1, 2, 3].forEach(t => {
    const b = row.basic[t] || 0;
    const u = row.upgradedBasic[t] || 0;
    want += b + u;
    have += Math.min(b, deckPool('Basic', t, s).length) + Math.min(u, deckPool('Upgraded', t, s).length);
  });
  return have < want ? { want, have } : null;
}

// Mazzo per la battaglia del boss scelto (Nemesis Deck Setup): per ogni Tier si estraggono a caso le carte base e
// potenziate indicate nella tabella (deckSetupRow, con le opzioni del mazzo) e si aggiungono le carte specifiche del
// nemico di quel Tier. Se le carte della collezione non bastano, il Tier esce più corto.
// Ogni Tier è mescolato a parte; si pesca dalla fine, quindi in cima c'è il Tier 1 e in fondo il Tier 3.
// Restano fuori le carte che non sono del mazzo nemesi (inNemesisDeck false: World Devourer, maledizione...).
// Ultimo mazzo creato: carte prese da ogni mazzo (Tier × Base / Potenziate / Specifiche)
export let deckPlan = [];

export function buildDeck() {
  deckPlan = [];
  // Nessuna nemesi giocabile (per esempio collezione vuota, v194): mazzo vuoto, si sceglie dopo
  const setup = deckSetupRow();
  if (!setup) return [];
  const result = [];
  [3, 2, 1].forEach(tier => {
    // solo le carte del mazzo nemesi (inNemesisDeck) di quel Tier
    const ofTier = c => c.inNemesisDeck === true && c.tier === tier;
    const basic = pickRandom(deckPool('Basic', tier), setup.basic[tier] || 0);
    const upgraded = pickRandom(deckPool('Upgraded', tier), setup.upgradedBasic[tier] || 0);
    const specific = G.allCards.filter(c => c.category === 'Specific' && c.nemesis === G.settings.nemesis && ofTier(c));
    // Quante carte vengono da ognuno dei 9 mazzi (per la schermata "Crea mazzo")
    deckPlan.push({ tier, kind: 'basic', count: basic.length }, { tier, kind: 'upgraded', count: upgraded.length },
      { tier, kind: 'specific', count: specific.length });
    result.push(...shuffle([...basic, ...upgraded, ...specific]));
  });
  return result;
}

// Nuova partita: mazzo nuovo per le scelte correnti, scarti vuoti, turni a zero
export function newGame() {
  G.graveLife = GRAVEHOLD_LIFE;
  G.nemesisLife = nemesisStartLife();
  G.deck = buildDeck();
  G.discard = [];
  G.turn = 0;
  G.maxTierDrawn = 0;
  G.stats = emptyStats(G.deck.length);
  G.stats.startedAt = Date.now();
  // Mazzo dei turni ancora da cominciare (v193): finito "Crea mazzo" si aspetta "Pesca carta turno" (drawFirstTurn)
  G.turnOrder = { left: [], drawn: [], round: 0, picks: {}, known: [], waiting: false, pairNext: emptyPairNext(), history: [] };
}

// Attesa della carta turno: nessun turno ancora cominciato nel giro (o, salvataggi v211-v221, waiting: turno annullato)
export function awaitingTurnCard() {
  return !G.resolving && (!(G.turnOrder.history || []).length || !!G.turnOrder.waiting);
}

// "Pesca carta turno": estrae il primo turno; se è la nemesi parte subito il turno nemesi
export function drawFirstTurn() {
  if (drawTurnCard() === 'nemesis') nemesisTurn();
}

// Carte del mazzo dei turni per il numero di giocatori (regole del gioco): 2 giocatori = due carte a testa,
// 3 giocatori = una a testa più il jolly, 4 giocatori = una a testa; sempre due carte nemesi
// Con 4 giocatori e l'opzione "Carte turno 1/2 e 3/4" (wave 4, v192, attiva di default): 1/2, 1/2, 3/4, 3/4
// ('p12', 'p34'); quando esce una carta x/y i giocatori scelgono chi gioca e l'altra carta x/y va all'altro giocatore
export function turnOrderCards(players) {
  // Modalità test (v215): lo scenario può avere il suo mazzo dei turni
  if (G.testRun && G.testRun.turnCards) return G.testRun.turnCards.slice();
  const n = Math.max(1, Math.min(4, Number(players) || 2));
  const mine = n === 1 ? ['p1', 'p1', 'p1', 'p1'] : n === 2 ? ['p1', 'p1', 'p2', 'p2']
    : n === 3 ? ['p1', 'p2', 'p3', 'wild'] : turnPairsOn() ? ['p12', 'p12', 'p34', 'p34'] : ['p1', 'p2', 'p3', 'p4'];
  return mine.concat('nemesis', 'nemesis');
}

// Opzione del Menu (preferenza del browser, non della partita): vale dal prossimo giro del mazzo dei turni
export const TURN_PAIRS_KEY = 'aeonsend-app-0.2-turn-pairs';

export function turnPairsOn() {
  // Modalità test (v215): lo scenario può attivarle o spegnerle solo per sé, senza cambiare la preferenza
  if (G.testRun && typeof G.testRun.pairs === 'boolean') return G.testRun.pairs;
  try { return localStorage.getItem(TURN_PAIRS_KEY) !== 'off'; } catch (err) { return true; }
}

export function setTurnPairs(on) {
  try { localStorage.setItem(TURN_PAIRS_KEY, on ? 'on' : 'off'); } catch (err) { console.warn(err); }
}

export function isPairCard(kind) { return kind === 'p12' || kind === 'p34'; }

export function pairOptions(kind) { return kind === 'p12' ? ['p1', 'p2'] : ['p3', 'p4']; }

// Giocatori della partita: 'p1'..'pN' (righe delle Statistiche maghi)
export function playerKinds() {
  const n = Math.max(1, Math.min(4, Number(G.settings.players) || 2));
  return Array.from({ length: n }, (_, i) => 'p' + (i + 1));
}

// Estrae a caso una carta tra quelle rimaste (finite le 6 si rimescola). pick: solo le carte che lo soddisfano
// (serve per i salvataggi vecchi, senza mazzo dei turni)
// Giro nuovo: si rimescola e il contatore dei giri ("Turno N" nella testata) sale.
// Con 3 giocatori il jolly è uno dei giocatori (v179): al primo giro a caso, poi a ogni giro il successivo (1→2→3→1)
export function shuffleTurnOrder() {
  const wild = Number(G.settings.players) === 3
    ? (G.turnOrder.wild ? (G.turnOrder.wild % 3) + 1 : 1 + Math.floor(Math.random() * 3)) : null;
  // v206: il mazzo è in ordine (left[0] = la carta in cima), mescolato qui; si pesca sempre dalla cima, così le carte
  // che guardano o riordinano il mazzo dei turni (Hissing Acid, Quartz Shard, Xaxos...) vedono le carte vere
  // known (v211): nessuna carta del mazzo è nota (scoperta) in un giro nuovo
  const left = shuffle(turnOrderCards(G.settings.players));
  // pairNext (v220): la memoria delle carte 1/2 e 3/4 NON si azzera a fine giro né quando si mescola
  // history (v222): la storia dei turni riparte vuota a ogni giro
  G.turnOrder = { left, drawn: [], round: (G.turnOrder.round || 0) + 1, wild, picks: {}, known: left.map(() => false), waiting: false,
    pairNext: emptyPairNext(G.turnOrder.pairNext), history: [] };
}

// Turno in corso = ultimo del giro (v194): mazzo dei turni vuoto; finendolo si mischia il mazzo e si aspetta "Pesca la
// prima carta turno"
export function turnRoundOver() {
  return !!currentTurn() && !G.turnOrder.left.length;
}

// Fine di un turno: carta turno dopo, o a fine giro mazzo mischiato e attesa (null)
export function nextTurnCard() {
  if (turnRoundOver()) { shuffleTurnOrder(); return null; }
  return drawTurnCard();
}

export function drawTurnCard(pick) {
  if (!G.turnOrder.left.length) shuffleTurnOrder();
  // Dalla cima (v206); pick (salvataggi vecchi): la prima carta dall'alto che lo soddisfa
  let at = 0;
  if (pick) { const i = G.turnOrder.left.findIndex(pick); if (i >= 0) at = i; }
  const card = G.turnOrder.left.splice(at, 1)[0];
  if (Array.isArray(G.turnOrder.known)) G.turnOrder.known.splice(at, 1);
  G.turnOrder.drawn.push(card);
  G.turnOrder.waiting = false;
  const entry = { kind: card, player: null, forced: false, pos: G.turnOrder.drawn.length - 1 };
  // Carta 1/2 o 3/4 (v220): se la memoria della coppia dice a chi tocca, gioca lui senza scelta (OBBLIGATA) e la
  // memoria torna a "nessuno"; altrimenti si sceglie nella finestra "Chi gioca questo turno?" (chooseTurnPlayer)
  if (isPairCard(card)) {
    G.turnOrder.pairNext = emptyPairNext(G.turnOrder.pairNext);
    const next = G.turnOrder.pairNext[card];
    if (next) {
      G.turnOrder.picks = Object.assign({}, G.turnOrder.picks, { [G.turnOrder.drawn.length - 1]: { player: next, forced: true } });
      G.turnOrder.pairNext[card] = null;
      Object.assign(entry, { player: next, forced: true });
    }
  }
  // Storia dei turni del giro (v222): ogni carta pescata è un turno; l'ultimo è il turno in corso
  G.turnOrder.history = (G.turnOrder.history || []).concat(entry);
  return card;
}

// Codice eseguito all'avvio (prima: al caricamento di script.js), nell'ordine di prima
export function avvio() {
}
