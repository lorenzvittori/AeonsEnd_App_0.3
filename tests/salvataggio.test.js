// Salvataggio (src/regole/salvataggio.js): fotografia e ripristino, lettura dei formati vecchi (un salvataggio vero di
// main v228 e fotografie senza i campi recenti), controllo della versione e scrittura.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as S from '../src/regole/salvataggio.ts';
import * as T from '../src/regole/mazzo-turni.ts';
import * as N from '../src/regole/turno-nemesi.ts';
import { buildDeck } from '../src/regole/mazzo-nemesi.ts';
import { nemesisStartLife } from '../src/regole/vite.ts';
import { db, nemeses, cardsById, seeded, allProducts } from './aiuto.js';

const MAIN_V228 = JSON.parse(readFileSync(join(import.meta.dirname, 'dati', 'salvataggio-main-v228.json'), 'utf8'));

// Fotografia attesa dopo un ripristino. Bug noto (annotato, non corretto): al passo Pesca con carte in coda
// (currentIndex = lunghezza della coda) il ripristino riporta currentIndex sull'ultima carta, da risolvere di nuovo
function afterRestore(snap) {
  const s = JSON.parse(JSON.stringify(snap));
  if (s.resolving && s.queue.length && s.newIndex < 0 && s.currentIndex >= s.queue.length) s.currentIndex = s.queue.length - 1;
  return s;
}
// Partita come i campi di G usati dalle regole
function newGame(settings, random) {
  const deck = buildDeck(db, allProducts, settings, random).deck;
  return { settings, nextUid: 1, turn: 0, deck, discard: [], queue: [], resolving: false, currentIndex: 0, newIndex: -1,
    maxTierDrawn: 0, graveLife: 30, nemesisLife: nemesisStartLife(nemeses, settings.nemesis), stats: N.emptyStats(deck.length),
    turnOrder: T.newTurnOrder() };
}
function ctxFor(game, random) {
  return { cardsById, newUid: () => game.nextUid++, players: game.settings.players, nemeses, nemesisName: game.settings.nemesis,
    random, cards: () => T.turnOrderCards(game.settings.players, true) };
}
// Qualche passo di partita con le regole: turni, scelte 1/2 e 3/4, risoluzione e pesca, danni, vite
function play(game, steps, random) {
  const cards = () => T.turnOrderCards(game.settings.players, true);
  const next = () => {
    if (T.turnRoundOver(game.turnOrder)) { game.turnOrder = T.shuffleTurnOrder(game.turnOrder, game.settings.players, cards(), random); return null; }
    const r = T.drawTurnCard(game.turnOrder, { players: game.settings.players, cards, random });
    game.turnOrder = r.order;
    return r.card;
  };
  for (let i = 0; i < steps; i++) {
    const cur = T.currentTurn(game.turnOrder);
    if (!game.resolving && cur && T.isPairCard(cur.kind) && !cur.player) { T.choosePairPlayer(game.turnOrder, T.pairOptions(cur.kind)[i % 2]); continue; }
    if (game.resolving) {
      if (N.isDrawStep(game)) N.drawNewCard(game, () => game.nextUid++, () => 1700000000000 + i);
      else N.resolveCurrent(game);
      if (!game.resolving && next() === 'nemesis') N.nemesisTurn(game);
      continue;
    }
    const m = game.queue.find(e => e.data.type === 'Minion' && !N.hpUnset(e) && e.hp > 1);
    if (m && i % 3 === 0) N.applyDrafts(game, new Map([[m.uid, { hp: m.hp - 1 }]]), 'p1');
    const v = game.queue.find(e => N.hpUnset(e));
    if (v) N.applyDrafts(game, new Map([[v.uid, { hp: 4 }]]), 'p2');
    if (i % 4 === 0) game.graveLife = Math.max(0, game.graveLife - 1);
    N.endPlayerTurnCards(game);
    if (next() === 'nemesis') N.nemesisTurn(game);
  }
}

describe('fotografia e ripristino', () => {
  it('fotografia → JSON → ripristino → fotografia: lo stesso stato (4 partite, 6 momenti ciascuna)', () => {
    [[2, 'Rageborne'], [3, 'Carapace Queen'], [4, 'Maggoth'], [4, 'Prince of Gluttons']].forEach(([players, nemesis], k) => {
      const random = seeded(100 + k);
      const game = newGame({ players, nemesis, battleMode: true, mergeCollection: true }, random);
      for (let round = 0; round < 6; round++) {
        play(game, 9, random);
        const snap = S.snapshotGame(game);
        const copy = { settings: game.settings, nextUid: 1 };
        const r = S.restoreGame(JSON.parse(JSON.stringify(snap)), ctxFor(copy, seeded(1)));
        Object.assign(copy, r.game);
        expect(S.snapshotGame(copy), `${nemesis}, momento ${round}`).toEqual(afterRestore(snap));
        copy.deck.forEach(c => expect(cardsById.get(c.id)).toBe(c));
        expect(new Set(copy.queue.map(e => e.uid)).size).toBe(copy.queue.length);
      }
    });
  });

  it('formato: i campi di sempre più le vite, carte come id, coda senza uid; la partita non cambia', () => {
    const game = newGame({ players: 2, nemesis: 'Maggoth', battleMode: true, mergeCollection: true }, seeded(5));
    game.queue.push(N.makeEntry(game.deck.pop(), game.nextUid++, 0));
    const before = JSON.stringify(game);
    const snap = S.snapshotGame(game);
    expect(JSON.stringify(game)).toBe(before);
    expect(Object.keys(snap)).toEqual(['turn', 'deck', 'discard', 'queue', 'resolving', 'currentIndex', 'newIndex', 'maxTierDrawn',
      'graveLife', 'nemesisLife', 'stats', 'turnOrder']);
    expect(Object.keys(snap.turnOrder)).toEqual(['left', 'drawn', 'round', 'wild', 'picks', 'pairNext', 'history', 'known', 'waiting']);
    expect(typeof snap.deck[0]).toBe('string');
    expect('uid' in snap.queue[0]).toBe(false);
    expect(snap.queue[0].id).toBe(game.queue[0].data.id);
    expect(snap.stats).not.toBe(game.stats);
  });

  it('viste dopo il ripristino: carta da risolvere, carta appena pescata, passo Pesca, carta più recente', () => {
    let uid = 1;
    const ctx = { cardsById, newUid: () => uid++, players: 4, nemeses, nemesisName: 'Carapace Queen', random: seeded(1), cards: () => T.turnOrderCards(4, true) };
    const r = S.restoreGame(MAIN_V228.state, ctx);
    expect(r.view.viewed).toBe(r.game.queue[1].uid);
    expect(r.view.lastDrawnUid).toBe(r.game.queue[1].uid);
    expect(r.view.anchor).toBe(null);
    const players = S.restoreGame({ ...MAIN_V228.state, resolving: false, newIndex: -1 }, ctx);
    expect(players.view).toEqual({ viewed: null, lastDrawnUid: null, anchor: { uid: players.game.queue[1].uid, align: 'anchor' } });
  });
});

describe('salvataggi vecchi', () => {
  it('main v228: si legge, si riscrive uguale più le vite iniziali (stato e i 3 passi di undo)', () => {
    expect(MAIN_V228.version).toBe(2);
    expect(S.checkSave(MAIN_V228, 2)).toBe('ok');
    const settings = MAIN_V228.settings;
    const start = nemesisStartLife(nemeses, settings.nemesis);
    expect(start).toBeGreaterThan(0);
    const game = { settings, nextUid: 1 };
    const r = S.restoreGame(MAIN_V228.state, ctxFor(game, seeded(1)));
    Object.assign(game, r.game);
    expect(game.turn).toBe(5);
    expect(game.deck.length).toBe(26);
    expect(game.deck[game.deck.length - 1].id).toBe('AE204');
    expect(game.queue.map(e => e.data.id)).toEqual(['AE208', 'NA-1c-26']);
    expect(game.queue[1].isNew).toBe(true);
    expect(game.resolving).toBe(true);
    expect(game.currentIndex).toBe(1);
    expect(game.newIndex).toBe(1);
    expect(game.turnOrder.pairNext).toEqual({ p12: null, p34: 'p3' });
    expect(game.turnOrder.picks[2]).toEqual({ player: 'p2', forced: true });
    expect(game.stats.minionsKilled).toBe(1);
    // v228 non aveva le vite (v254): Gravehold 30 e la vita della nemesi da nemesis.json
    expect(game.graveLife).toBe(30);
    expect(game.nemesisLife).toBe(start);
    const withLives = s => ({ ...s, graveLife: 30, nemesisLife: start });
    expect(S.snapshotGame(game)).toEqual(withLives(MAIN_V228.state));
    expect(MAIN_V228.undo.length).toBe(3);
    MAIN_V228.undo.forEach((u, i) => {
      const g = { settings, nextUid: 1 };
      Object.assign(g, S.restoreGame(u, ctxFor(g, seeded(1))).game);
      expect(S.snapshotGame(g), 'passo di undo ' + i).toEqual(withLives(afterRestore(u)));
    });
  });

  it('carta sconosciuta: errore prima di creare qualcosa', () => {
    const bad = JSON.parse(JSON.stringify(MAIN_V228.state));
    bad.deck.push('NON-ESISTE');
    let uid = 1;
    expect(() => S.restoreGame(bad, { cardsById, newUid: () => uid++, players: 4, nemeses, nemesisName: 'Carapace Queen', random: seeded(1), cards: () => [] }))
      .toThrow(/Carta sconosciuta/);
    expect(uid, 'nessun uid usato').toBe(1);
  });

  it('fotografia v48 (senza Tier, statistiche, mazzo dei turni, vite): campi ricostruiti', () => {
    let uid = 1;
    const old = { turn: 3, deck: MAIN_V228.state.deck.slice(), discard: MAIN_V228.state.discard.slice(),
      queue: [{ id: 'AE208', tokens: null, hp: 5 }], resolving: false, currentIndex: 0, newIndex: -1 };
    const ctx = { cardsById, newUid: () => uid++, players: 2, nemeses, nemesisName: 'Rageborne', random: seeded(3), cards: () => T.turnOrderCards(2, false) };
    const r = S.restoreGame(old, ctx);
    expect(r.game.maxTierDrawn).toBe(Math.max(0, ...[cardsById.get('AE208'), ...old.discard.map(id => cardsById.get(id))].map(c => c.tier || 0)));
    expect(r.game.stats.deckSize).toBe(old.deck.length + 1 + old.discard.length);
    expect(r.game.stats.mages).toEqual({});
    expect(r.game.queue[0].turnHp).toBe(5);
    expect(r.game.queue[0].bornTurn).toBe(3);
    expect(r.game.queue[0].isNew).toBe(false);
    expect(r.game.graveLife).toBe(30);
    expect(r.game.nemesisLife).toBe(nemesisStartLife(nemeses, 'Rageborne'));
    expect(r.game.turnOrder.drawn.length).toBe(1);
    expect(r.game.turnOrder.drawn[0]).not.toBe('nemesis');
    expect(r.view.anchor).toEqual({ uid: r.game.queue[0].uid, align: 'center' });
    // Turno nemesi con la coda vuota: passo Pesca
    const draw = S.restoreGame({ ...old, queue: [], resolving: true }, ctx);
    expect(draw.view.viewed).toBe('draw');
    expect(draw.game.resolving).toBe(true);
    expect(draw.game.turnOrder.drawn[0]).toBe('nemesis');
  });

  it('minion a vita variabile v214-v217 (senza hpMax): la più alta tra vita e vita di inizio turno', () => {
    const variable = db.cards.find(c => c.type === 'Minion' && c.hpVariable === true);
    let uid = 1;
    const ctx = { cardsById, newUid: () => uid++, players: 2, nemeses, nemesisName: 'Rageborne', random: seeded(3), cards: () => T.turnOrderCards(2, false) };
    const base = { turn: 2, deck: [], discard: [], resolving: false, currentIndex: 0, newIndex: -1 };
    const set = S.restoreGame({ ...base, queue: [{ id: variable.id, tokens: null, hp: 3, turnHp: 6, hpSet: true }] }, ctx).game.queue[0];
    expect([set.hpSet, set.hpMax]).toEqual([true, 6]);
    const unset = S.restoreGame({ ...base, queue: [{ id: variable.id, tokens: null, hp: 0, turnHp: null }] }, ctx).game.queue[0];
    expect([unset.hpSet, unset.hpMax]).toEqual([false, undefined]);
  });

  it('controllo e scrittura del salvataggio nel browser', () => {
    expect(S.checkSave(null, 2)).toBe(null);
    expect(S.checkSave({ version: 1, settings: {}, state: { queue: [] } }, 2)).toBe('other-version');
    expect(S.checkSave({ version: 2, settings: {}, state: {} }, 2)).toBe(null);
    expect(S.checkSave({ version: 2, state: { queue: [] } }, 2)).toBe(null);
    expect(S.buildSave(2, { a: 1 }, { turn: 1 }, [])).toEqual({ version: 2, settings: { a: 1 }, state: { turn: 1 }, undo: [] });
    expect(Object.keys(S.buildSave(2, {}, {}, []))).toEqual(['version', 'settings', 'state', 'undo']);
  });
});
