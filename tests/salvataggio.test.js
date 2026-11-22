// Fotografia della partita (salvataggio e undo) e ripristino: Regole.snapshotGame / Regole.restoreGame (fase 4).
// Il formato deve restare quello di sempre: un salvataggio fatto con main (v228) si legge e si riscrive uguale.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { Regole, db, cards, seeded, allProducts } = require('./aiuto.js');

const cardsById = new Map(cards.map(c => [c.id, c]));
const MAIN_SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'dati', 'salvataggio-main-v228.json'), 'utf8'));

// Fotografia attesa dopo un ripristino. Comportamento di sempre (bug annotato, non corretto nel refactoring): al passo
// Pesca con carte in coda (currentIndex = lunghezza della coda) il ripristino riporta currentIndex sull'ultima carta
function afterRestore(snap) {
  const s = JSON.parse(JSON.stringify(snap));
  if (s.resolving && s.queue.length && s.newIndex < 0 && s.currentIndex >= s.queue.length) s.currentIndex = s.queue.length - 1;
  return s;
}
// Partita come l'oggetto game dell'app (js/01-testi-stato.js)
function newGame(settings, random) {
  const game = { settings, nextUid: 1, turn: 0, deck: [], discard: [], queue: [], resolving: false, currentIndex: 0, newIndex: -1,
    maxTierDrawn: 0, stats: Regole.emptyStats(0), turnOrder: Regole.newTurnOrder() };
  game.deck = Regole.buildDeck(db, allProducts, settings, random).deck;
  game.stats = Regole.emptyStats(game.deck.length);
  return game;
}
function ctxFor(game, random) {
  return { cardsById, newUid: () => game.nextUid++, players: game.settings.players, random,
    cards: Regole.turnOrderCards(game.settings.players, true) };
}
// Qualche passo di partita con le regole: turni, scelte 1/2 e 3/4, risoluzione e pesca, danni e poteri pagati
function play(game, steps, random) {
  const cards = Regole.turnOrderCards(game.settings.players, true);
  const next = () => {
    if (Regole.turnRoundOver(game.turnOrder)) { game.turnOrder = Regole.shuffleTurnOrder(game.turnOrder, game.settings.players, cards, random); return null; }
    const r = Regole.drawTurnCard(game.turnOrder, { players: game.settings.players, cards, random });
    game.turnOrder = r.order;
    return r.card;
  };
  for (let i = 0; i < steps; i++) {
    const cur = Regole.currentTurn(game.turnOrder);
    if (!game.resolving && cur && Regole.isPairCard(cur.kind) && !cur.player) { Regole.choosePairPlayer(game.turnOrder, Regole.pairOptions(cur.kind)[i % 2]); continue; }
    if (game.resolving) {
      if (Regole.isDrawStep(game)) Regole.drawNewCard(game, () => game.nextUid++, () => 1700000000000 + i);
      else Regole.resolveCurrent(game);
      if (!game.resolving && next() === 'nemesis') Regole.nemesisTurn(game);
      continue;
    }
    const m = game.queue.find(e => e.data.type === 'Minion' && !Regole.hpUnset(e) && e.hp > 1);
    if (m && i % 3 === 0) Regole.applyDrafts(game, new Map([[m.uid, { hp: m.hp - 1 }]]), 'p1');
    const v = game.queue.find(e => Regole.hpUnset(e));
    if (v) Regole.applyDrafts(game, new Map([[v.uid, { hp: 4 }]]), 'p2');
    Regole.endPlayerTurnCards(game);
    if (next() === 'nemesis') Regole.nemesisTurn(game);
  }
}

test('fotografia → ripristino → fotografia: lo stesso stato, anche passando da JSON (salvataggio)', () => {
  [[2, 'Rageborne'], [3, 'Carapace Queen'], [4, 'Maggoth'], [4, 'Prince of Gluttons']].forEach(([players, nemesis], k) => {
    const random = seeded(100 + k);
    const game = newGame({ players, nemesis, battleMode: true, mergeCollection: true }, random);
    for (let round = 0; round < 6; round++) {
      play(game, 9, random);
      const snap = Regole.snapshotGame(game);
      assert.equal('settings' in snap, false, 'settings si salva a parte');
      assert.equal('nextUid' in snap, false, 'nextUid non si salva');
      const copy = { settings: game.settings, nextUid: 1 };
      const r = Regole.restoreGame(JSON.parse(JSON.stringify(snap)), ctxFor(copy, seeded(1)));
      Object.assign(copy, r.game);
      assert.deepEqual(Regole.snapshotGame(copy), afterRestore(snap), `${nemesis}, giro ${round}`);
      // Le carte tornano oggetti di cards.json, le voci della coda hanno uid nuovi e unici
      copy.deck.forEach(c => assert.equal(cardsById.get(c.id), c));
      assert.equal(new Set(copy.queue.map(e => e.uid)).size, copy.queue.length);
    }
  });
});

test('fotografia: tutti i campi di game tranne settings e nextUid, carte come id, coda senza uid', () => {
  const game = newGame({ players: 2, nemesis: 'Maggoth', battleMode: true, mergeCollection: true }, seeded(5));
  game.queue.push(Regole.makeEntry(game.deck.pop(), game.nextUid++, 0));
  game.extraField = { a: [1, 2] };
  const snap = Regole.snapshotGame(game);
  assert.deepEqual(Object.keys(snap), ['turn', 'deck', 'discard', 'queue', 'resolving', 'currentIndex', 'newIndex', 'maxTierDrawn',
    'stats', 'turnOrder', 'extraField']);
  assert.deepEqual(snap.extraField, { a: [1, 2] }, 'un campo nuovo entra da solo');
  assert.notEqual(snap.extraField, game.extraField, 'è una copia');
  assert.equal(typeof snap.deck[0], 'string');
  assert.equal('uid' in snap.queue[0], false);
  assert.equal(snap.queue[0].id, game.queue[0].data.id);
  // Un campo nuovo torna anche con il ripristino
  const r = Regole.restoreGame(snap, ctxFor({ settings: game.settings, nextUid: 1 }, seeded(1)));
  assert.deepEqual(r.game.extraField, { a: [1, 2] });
});

test('salvataggio fatto con main (v228): si legge e si riscrive uguale (stato e undo)', () => {
  assert.equal(MAIN_SAVE.version, 2);
  const settings = MAIN_SAVE.settings;
  const game = { settings, nextUid: 1 };
  const r = Regole.restoreGame(MAIN_SAVE.state, ctxFor(game, seeded(1)));
  Object.assign(game, r.game);
  assert.equal(game.turn, 5);
  assert.equal(game.deck.length, 26);
  assert.equal(game.deck[game.deck.length - 1].id, 'AE204', 'in cima al mazzo (fine dell\'array) la stessa carta');
  assert.deepEqual(game.queue.map(e => e.data.id), ['AE208', 'NA-1c-26']);
  assert.equal(game.queue[1].isNew, true);
  assert.equal(game.resolving, true);
  assert.equal(game.currentIndex, 1);
  assert.equal(game.newIndex, 1);
  assert.equal(r.view.viewed, game.queue[1].uid);
  assert.equal(r.view.lastDrawnUid, game.queue[1].uid);
  assert.deepEqual(game.turnOrder.pairNext, { p12: null, p34: 'p3' });
  assert.deepEqual(game.turnOrder.picks[2], { player: 'p2', forced: true });
  assert.equal(game.stats.minionsKilled, 1);
  assert.deepEqual(Regole.snapshotGame(game), MAIN_SAVE.state, 'riscritto nello stesso formato');
  MAIN_SAVE.undo.forEach((u, i) => {
    const g = { settings, nextUid: 1 };
    Object.assign(g, Regole.restoreGame(u, ctxFor(g, seeded(1))).game);
    assert.deepEqual(Regole.snapshotGame(g), afterRestore(u), 'passo di undo ' + i);
  });
});

test('ripristino: carta sconosciuta = errore prima di cambiare qualcosa; salvataggi senza campi recenti', () => {
  const bad = JSON.parse(JSON.stringify(MAIN_SAVE.state));
  bad.deck.push('NON-ESISTE');
  let uid = 1;
  assert.throws(() => Regole.restoreGame(bad, { cardsById, newUid: () => uid++, players: 4, random: seeded(1), cards: [] }), /Carta sconosciuta/);
  // Salvataggio vecchio: senza maxTierDrawn, stats, turnOrder (v48)
  const old = { turn: 3, deck: MAIN_SAVE.state.deck.slice(), discard: MAIN_SAVE.state.discard.slice(),
    queue: [{ id: 'AE208', tokens: null, hp: 5 }], resolving: false, currentIndex: 0, newIndex: -1 };
  const r = Regole.restoreGame(old, { cardsById, newUid: () => uid++, players: 2, random: seeded(3), cards: Regole.turnOrderCards(2, false) });
  assert.equal(r.game.maxTierDrawn, Math.max(0, ...[cardsById.get('AE208'), ...old.discard.map(id => cardsById.get(id))].map(c => c.tier || 0)));
  assert.equal(r.game.stats.deckSize, old.deck.length + 1 + old.discard.length);
  assert.equal(r.game.queue[0].turnHp, 5, 'vita di inizio turno = vita');
  assert.equal(r.game.queue[0].bornTurn, 3);
  assert.equal(r.game.turnOrder.drawn.length, 1, 'mazzo dei turni nuovo con il turno in corso già estratto');
  assert.notEqual(r.game.turnOrder.drawn[0], 'nemesis');
  assert.deepEqual(r.view.anchor, { uid: r.game.queue[0].uid, align: 'center' });
  // Turno nemesi con la coda vuota: passo Pesca
  const draw = Regole.restoreGame(Object.assign({}, old, { queue: [], resolving: true }), { cardsById, newUid: () => uid++, players: 2, random: seeded(3), cards: Regole.turnOrderCards(2, false) });
  assert.equal(draw.view.viewed, 'draw');
  assert.equal(draw.game.resolving, true);
});
