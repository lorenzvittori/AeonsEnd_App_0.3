// regole/salvataggio.js: fotografia della partita (salvataggio nel browser e undo) e ripristino, anche dai formati vecchi.
// Riceve `g`, la partita (turn, deck, discard, queue, resolving, currentIndex, newIndex, maxTierDrawn, graveLife,
// nemesisLife, stats, turnOrder: vedi regole/turno-nemesi.js e regole/mazzo-turni.js) e, per il ripristino, `ctx`:
//   { cardsById (Map id -> carta di cards.json), newUid() (uid delle carte in gioco), players, nemeses, nemesisName
//     (per la vita iniziale della nemesi), random, cards() (carte del mazzo dei turni per un giro nuovo) }.
// Restituisce oggetti nuovi; non cambia `g` né la fotografia.
// Usato da: stato/salvataggio.js (snapshot, restore, save, readSave), test in tests/salvataggio.test.js.
//
// Formato della fotografia (lo stesso dalla v48, con i campi aggiunti negli anni; il salvataggio è
// { version, settings, state: fotografia, undo: [fotografie] }):
//   { turn, deck: [id], discard: [id], queue: [{ id, tokens, hp, turnHp, isNew, paid, bornTurn, (hpSet, hpMax) }],
//     resolving, currentIndex, newIndex, maxTierDrawn, graveLife, nemesisLife, stats, turnOrder }
// Lettura dei salvataggi senza i campi più recenti: maxTierDrawn = Tier più alto tra coda e scarti; vite = valori
// iniziali; stats da zero (mazzo iniziale = tutte le carte); turnHp = hp; bornTurn = turn; hpMax (minion a vita
// variabile già impostata) = la più alta tra vita e vita di inizio turno; mazzo dei turni: restoreTurnOrder.

import { restoreTurnOrder, emptyPairNext } from './mazzo-turni.js';
import { emptyStats, isVariableMinion, makeEntry } from './turno-nemesi.js';
import { GRAVEHOLD_LIFE, nemesisStartLife } from './vite.js';

// Fotografia (solo dati semplici: le carte come id)
export function snapshotGame(g) {
  return {
    turn: g.turn,
    deck: g.deck.map(c => c.id),
    discard: g.discard.map(c => c.id),
    queue: g.queue.map(e => ({ id: e.data.id, tokens: e.tokens, hp: e.hp, turnHp: e.turnHp, isNew: !!e.isNew, paid: !!e.paid, bornTurn: e.bornTurn,
      ...(isVariableMinion(e.data) ? { hpSet: !!e.hpSet, hpMax: typeof e.hpMax === 'number' ? e.hpMax : null } : {}) })),
    resolving: g.resolving,
    currentIndex: g.currentIndex,
    newIndex: g.newIndex,
    maxTierDrawn: g.maxTierDrawn,
    graveLife: g.graveLife,
    nemesisLife: g.nemesisLife,
    stats: JSON.parse(JSON.stringify(g.stats)),
    turnOrder: { left: g.turnOrder.left.slice(), drawn: g.turnOrder.drawn.slice(), round: g.turnOrder.round, wild: g.turnOrder.wild || null,
      picks: JSON.parse(JSON.stringify(g.turnOrder.picks || {})),
      pairNext: emptyPairNext(g.turnOrder.pairNext),
      history: JSON.parse(JSON.stringify(g.turnOrder.history || [])),
      known: g.turnOrder.left.map((k, i) => !!(g.turnOrder.known && g.turnOrder.known[i])), waiting: !!g.turnOrder.waiting }
  };
}

// Ripristino. Prima si leggono tutte le carte: una carta sconosciuta è un errore (Error "Carta sconosciuta: id") prima
// di creare qualcosa. Restituisce { game, view }:
// - game: i campi della partita (da scrivere nello stato);
// - view: cosa mostrare. viewed = 'draw' (turno nemesi con la coda vuota: passo Pesca), l'uid della carta da
//   risolvere (turno nemesi), o null (turno giocatori); lastDrawnUid = uid della carta appena pescata (o null);
//   anchor = { uid, align } della carta più recente nel turno giocatori (o null).
// Nel turno nemesi currentIndex si limita all'ultima carta della coda (vedi i bug noti in CONTESTO: al passo Pesca con
// carte in coda si torna all'ultima carta da risolvere). Il caso (random) si usa solo per il mazzo dei turni.
export function restoreGame(s, ctx) {
  const get = id => {
    const card = ctx.cardsById.get(id);
    if (!card) throw new Error('Carta sconosciuta: ' + id);
    return card;
  };
  const deck = s.deck.map(get);
  const discard = s.discard.map(get);
  const queue = s.queue.map(q => {
    const data = get(q.id);
    return Object.assign(makeEntry(data, ctx.newUid(), s.turn), {
      tokens: q.tokens, hp: q.hp, turnHp: q.turnHp === undefined ? q.hp : q.turnHp, isNew: !!q.isNew, paid: !!q.paid,
      bornTurn: typeof q.bornTurn === 'number' ? q.bornTurn : s.turn
    }, isVariableMinion(data) ? { hpSet: !!q.hpSet,
      hpMax: typeof q.hpMax === 'number' ? q.hpMax : (q.hpSet ? Math.max(q.hp || 0, q.turnHp || 0) : undefined) } : {});
  });
  const game = { deck, discard, turn: s.turn, queue };
  game.maxTierDrawn = typeof s.maxTierDrawn === 'number' ? s.maxTierDrawn
    : Math.max(0, ...queue.map(e => e.data.tier || 0), ...discard.map(c => c.tier || 0));
  game.graveLife = typeof s.graveLife === 'number' ? s.graveLife : GRAVEHOLD_LIFE;
  game.nemesisLife = typeof s.nemesisLife === 'number' ? s.nemesisLife : nemesisStartLife(ctx.nemeses, ctx.nemesisName);
  const stats = Object.assign(emptyStats(deck.length + queue.length + discard.length), s.stats ? JSON.parse(JSON.stringify(s.stats)) : {});
  stats.minions = Array.isArray(stats.minions) ? stats.minions : [];
  stats.cards = Object.assign(emptyStats(0).cards, stats.cards || {});
  stats.tierAt = Object.assign({}, stats.tierAt || {});
  stats.mages = stats.mages && typeof stats.mages === 'object' ? stats.mages : {};
  game.stats = stats;
  const view = { viewed: null, lastDrawnUid: null, anchor: null };
  if (s.resolving && queue.length === 0 && deck.length > 0) {
    game.resolving = true;
    game.currentIndex = 0;
    game.newIndex = -1;
    view.viewed = 'draw';
  } else if (s.resolving && queue.length > 0) {
    game.resolving = true;
    game.currentIndex = Math.max(0, Math.min(s.currentIndex, queue.length - 1));
    game.newIndex = s.newIndex >= 0 ? Math.min(s.newIndex, queue.length - 1) : -1;
    if (game.newIndex >= 0) view.lastDrawnUid = queue[game.newIndex].uid;
    view.viewed = queue[game.currentIndex].uid;
  } else {
    game.resolving = false;
    game.currentIndex = 0;
    game.newIndex = -1;
    if (queue.length) view.anchor = { uid: queue[queue.length - 1].uid, align: queue.length === 1 ? 'center' : 'anchor' };
  }
  game.turnOrder = restoreTurnOrder(s.turnOrder, { players: ctx.players, resolving: game.resolving, turn: s.turn,
    random: ctx.random, cards: ctx.cards });
  return { game, view };
}

// Salvataggio letto dal browser (già convertito da JSON): 'ok' se si può riprendere, 'other-version' se è di un'altra
// versione del formato (si cancella: per esempio quelli di prima della v210, con gli id vecchi delle carte), null se
// manca o non è valido
export function checkSave(saved, version) {
  if (saved && saved.version !== version) return 'other-version';
  if (saved && saved.state && saved.settings && Array.isArray(saved.state.queue)) return 'ok';
  return null;
}

// Salvataggio da scrivere nel browser
export function buildSave(version, settings, state, undo) {
  return { version, settings, state, undo };
}
