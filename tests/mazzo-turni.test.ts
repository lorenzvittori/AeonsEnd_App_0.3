// Mazzo dei turni (src/regole/mazzo-turni.ts): carte per 2/3/4 giocatori, wild, carte 1/2 e 3/4, mescola e giro nuovo,
// pesca dalla cima, carte note, attesa e turno annullato, memoria delle coppie, carte tolte e aggiunte agli scarti,
// carta del mazzo portata negli scarti, bozza della finestra, salvataggi vecchi del mazzo dei turni.
import { describe, it, expect } from 'vitest';
import * as T from '../src/regole/mazzo-turni.ts';
import { seeded, must } from './aiuto.ts';
import type { CartaTurno, MazzoTurni } from '../src/tipi/partita.ts';
import type { MazzoTurniLetto } from '../src/tipi/salvataggio.ts';

const sorted = (list: readonly string[]) => list.slice().sort();
// Mazzo dei turni a mano: left dalla cima, il resto vuoto
function orderWith(left: CartaTurno[], extra: Partial<MazzoTurni> = {}): MazzoTurni {
  const base: MazzoTurni = { left: left.slice(), drawn: [], round: 1, wild: null, picks: {}, known: left.map(() => false),
    waiting: false, pairNext: { p12: null, p34: null }, history: [] };
  return Object.assign(base, extra);
}
// Pesca quando il mazzo non è vuoto (le carte del giro nuovo non servono)
function draw(order: MazzoTurni, opts: Partial<T.OpzioniPesca> = {}) {
  const base: T.OpzioniPesca = { players: 4, cards: () => { throw new Error('giro nuovo inatteso'); }, random: seeded(1) };
  return T.drawTurnCard(order, Object.assign(base, opts));
}

describe('carte e giri', () => {
  it('carte del mazzo dei turni per 2, 3 e 4 giocatori (e 1/2 e 3/4)', () => {
    expect(sorted(T.turnOrderCards(2, false))).toEqual(sorted(['p1', 'p1', 'p2', 'p2', 'nemesis', 'nemesis']));
    expect(sorted(T.turnOrderCards(3, false))).toEqual(sorted(['p1', 'p2', 'p3', 'wild', 'nemesis', 'nemesis']));
    expect(sorted(T.turnOrderCards(4, false))).toEqual(sorted(['p1', 'p2', 'p3', 'p4', 'nemesis', 'nemesis']));
    expect(sorted(T.turnOrderCards(4, true))).toEqual(sorted(['p12', 'p12', 'p34', 'p34', 'nemesis', 'nemesis']));
    // L'opzione 1/2 e 3/4 vale solo con 4 giocatori, e la funzione si legge solo allora
    let reads = 0;
    const pairs = () => { reads++; return true; };
    expect(sorted(T.turnOrderCards(3, pairs))).toEqual(sorted(T.turnOrderCards(3, false)));
    expect(reads).toBe(0);
    expect(sorted(T.turnOrderCards(4, pairs))).toEqual(sorted(T.turnOrderCards(4, true)));
    expect(reads).toBe(1);
    expect(T.playerKinds(3)).toEqual(['p1', 'p2', 'p3']);
    // (il numero di giocatori è un numero: i tipi non permettono più il testo "4")
    expect(T.playerKinds(4)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(T.isPairCard('p12')).toBe(true);
    expect(T.isPairCard('p1')).toBe(false);
    expect(T.pairOptions('p34')).toEqual(['p3', 'p4']);
    expect(T.otherOfPair('p12', 'p2')).toBe('p1');
  });

  it('partita nuova: mazzo dei turni vuoto in attesa della carta turno', () => {
    const order = T.newTurnOrder();
    expect(order).toEqual({ left: [], drawn: [], round: 0, picks: {}, known: [], waiting: false, pairNext: { p12: null, p34: null }, history: [] });
    expect(T.awaitingTurnCard(order, false)).toBe(true);
  });

  it('giro nuovo: mazzo mescolato, giro +1, niente note, storia vuota, memoria delle coppie conservata', () => {
    const before = orderWith([], { round: 2, drawn: ['p1', 'nemesis'], picks: { 0: { player: 'p1', forced: false } },
      pairNext: { p12: 'p2', p34: null }, history: [{ kind: 'p1', player: null, forced: false, pos: 0 }] });
    const cards = T.turnOrderCards(4, true);
    const after = T.shuffleTurnOrder(before, 4, cards, seeded(3));
    expect(after.round).toBe(3);
    expect(sorted(after.left)).toEqual(sorted(cards));
    expect(after.known).toEqual(after.left.map(() => false));
    expect(after.drawn).toEqual([]);
    expect(after.picks).toEqual({});
    expect(after.history).toEqual([]);
    expect(after.pairNext).toEqual({ p12: 'p2', p34: null });
    expect(after.wild).toBe(null);
    expect(after.pairNext).not.toBe(before.pairNext);
    expect(before.drawn, 'il mazzo di prima non cambia').toEqual(['p1', 'nemesis']);
    expect(T.shuffleTurnOrder(before, 4, cards, seeded(3)).left).toEqual(after.left);
  });

  it('wild con 3 giocatori: al primo giro a caso, poi passa al giocatore dopo (1→2→3→1)', () => {
    const cards = T.turnOrderCards(3, false);
    let order = T.shuffleTurnOrder(T.newTurnOrder(), 3, cards, () => 0.5); // 1 + floor(0.5 * 3) = 2
    expect(order.wild).toBe(2);
    const seen = [];
    for (let i = 0; i < 4; i++) { order = T.shuffleTurnOrder(order, 3, cards, seeded(i)); seen.push(order.wild); }
    expect(seen).toEqual([3, 1, 2, 3]);
    expect(T.turnCardPlayer('wild', 0, order, order.wild)).toBe('p3');
    expect(T.historyPlayer({ kind: 'wild' }, 3)).toBe('p3');
    expect(T.historyPlayer({ kind: 'nemesis' }, 3)).toBe(null);
    expect(T.historyPlayer({ kind: 'p2' }, 3)).toBe('p2');
    expect(T.turnCardPlayer('wild', 0, order, null)).toBe(null);
  });
});

describe('pesca, attesa e fine del giro', () => {
  it('pesca dalla cima, carte note, storia; a mazzo vuoto un giro nuovo', () => {
    const order = orderWith(['p2', 'nemesis', 'p1'], { known: [true, false, true] });
    let r = draw(order);
    expect(r.card).toBe('p2');
    expect(r.order).toBe(order);
    expect(order.left).toEqual(['nemesis', 'p1']);
    expect(order.known).toEqual([false, true]);
    expect(order.drawn).toEqual(['p2']);
    expect(T.currentTurn(order)).toEqual({ kind: 'p2', player: null, forced: false, pos: 0 });
    draw(order);
    draw(order);
    expect(T.turnRoundOver(order)).toBe(true);
    // Mazzo vuoto: giro nuovo (carte lette solo ora) e poi pesca
    r = T.drawTurnCard(order, { players: 2, cards: () => T.turnOrderCards(2, false), random: seeded(5) });
    expect(r.order).not.toBe(order);
    expect(r.order.round).toBe(2);
    expect(r.order.left.length).toBe(5);
    expect(r.order.history.length).toBe(1);
    // pick (salvataggi vecchi): la prima carta dall'alto che lo soddisfa
    const o2 = orderWith(['nemesis', 'p1', 'p2']);
    expect(draw(o2, { pick: c => c !== 'nemesis' }).card).toBe('p1');
    expect(o2.left).toEqual(['nemesis', 'p2']);
  });

  it('attesa della carta turno, turno annullato dei salvataggi vecchi, fine del giro', () => {
    const order = T.newTurnOrder();
    expect(T.awaitingTurnCard(order, false)).toBe(true);
    expect(T.awaitingTurnCard(order, true)).toBe(false);
    expect(T.currentTurn(order)).toBe(null);
    expect(T.turnRoundOver(order)).toBe(false);
    const o = orderWith(['p1']);
    draw(o);
    expect(T.awaitingTurnCard(o, false)).toBe(false);
    expect(T.turnRoundOver(o)).toBe(true);
    o.waiting = true;
    expect(T.awaitingTurnCard(o, false)).toBe(true);
    expect(T.currentTurn(o)).toBe(null);
    // La pesca toglie l'attesa
    o.left = ['p2'];
    draw(o);
    expect(o.waiting).toBe(false);
  });
});

describe('carte 1/2 e 3/4: memoria delle coppie', () => {
  it('carta scelta, poi la prossima della coppia è obbligata', () => {
    const order = orderWith(['p12', 'p34', 'p12', 'p34']);
    draw(order);
    expect(must(T.currentTurn(order), 'turno in corso').player).toBe(null);
    expect(T.turnCardPlayer('p12', undefined, order, null)).toBe(null);
    expect(T.choosePairPlayer(order, 'p1')).toBe(true);
    expect(order.picks[0]).toEqual({ player: 'p1', forced: false });
    expect(T.currentTurn(order)).toEqual({ kind: 'p12', player: 'p1', forced: false, pos: 0 });
    expect(order.pairNext).toEqual({ p12: 'p2', p34: null });
    expect(T.choosePairPlayer(order, 'p2')).toBe(false);
    draw(order);
    expect(must(T.currentTurn(order), 'turno in corso').player).toBe(null);
    T.choosePairPlayer(order, 'p4');
    expect(order.pairNext).toEqual({ p12: 'p2', p34: 'p3' });
    draw(order);
    expect(T.currentTurn(order)).toEqual({ kind: 'p12', player: 'p2', forced: true, pos: 2 });
    expect(order.picks[2]).toEqual({ player: 'p2', forced: true });
    expect(order.pairNext.p12).toBe(null);
    expect(T.choosePairPlayer(order, 'p1')).toBe(false);
    draw(order);
    expect(T.currentTurn(order)).toEqual({ kind: 'p34', player: 'p3', forced: true, pos: 3 });
    expect(order.pairNext).toEqual({ p12: null, p34: null });
    expect(T.turnCardPlayer('p34', 3, order, null)).toBe('p3');
    expect(T.turnCardPlayer('p34', -1, order, null)).toBe(null);
    expect(T.pickOf({ picks: { 0: 'p2' } }, 0)).toEqual({ player: 'p2', forced: false });
  });

  it('tra i giri: la scelta dell\'ultimo giro decide la prima carta del giro dopo', () => {
    let order = orderWith(['p12']);
    draw(order);
    T.choosePairPlayer(order, 'p2');
    expect(T.turnRoundOver(order)).toBe(true);
    order = T.shuffleTurnOrder(order, 4, ['p12', 'nemesis'], () => 0.99); // nessuno scambio: p12 in cima
    expect(order.left).toEqual(['p12', 'nemesis']);
    expect(order.pairNext).toEqual({ p12: 'p1', p34: null });
    draw(order);
    expect(T.currentTurn(order)).toEqual({ kind: 'p12', player: 'p1', forced: true, pos: 0 });
  });

  it('tre carte della stessa coppia nello stesso giro: scelta, obbligata, di nuovo scelta', () => {
    const order = orderWith(['p12', 'p12', 'p12']);
    draw(order);
    T.choosePairPlayer(order, 'p1');
    draw(order);
    expect(T.currentTurn(order)).toEqual({ kind: 'p12', player: 'p2', forced: true, pos: 1 });
    draw(order);
    expect(must(T.currentTurn(order), 'turno in corso').player).toBe(null);
    T.choosePairPlayer(order, 'p2');
    expect(order.pairNext.p12).toBe('p1');
  });

  it('giocatori dedotti per le carte 1/2 e 3/4 del mazzo', () => {
    const order = orderWith(['p12', 'p34', 'p12', 'nemesis', 'p34'], { pairNext: { p12: 'p2', p34: null } });
    expect(T.predictedPairPlayers(order)).toEqual(['p2', null, null, null, null]);
  });
});

describe('scarti dei turni e finestra del mazzo dei turni', () => {
  it('carta tolta dagli scarti: i picks restano sulle carte rimaste, la storia segue le posizioni', () => {
    const order = orderWith([], {
      drawn: ['p12', 'nemesis', 'p12', 'p34'],
      picks: { 0: { player: 'p1', forced: false }, 2: { player: 'p2', forced: true }, 3: { player: 'p3', forced: false } },
      history: [{ kind: 'p12', player: 'p1', forced: false, pos: 0 }, { kind: 'nemesis', player: null, forced: false, pos: 1 },
        { kind: 'p12', player: 'p2', forced: true, pos: 2 }, { kind: 'p34', player: 'p3', forced: false, pos: 3 }]
    });
    expect(T.takeFromTurnPile(order, [1, 9, -1])).toEqual(['nemesis']);
    expect(order.drawn).toEqual(['p12', 'p12', 'p34']);
    expect(order.picks).toEqual({ 0: { player: 'p1', forced: false }, 1: { player: 'p2', forced: true }, 2: { player: 'p3', forced: false } });
    expect(order.history.map(e => e.pos)).toEqual([0, null, 1, 2]);
    T.takeFromTurnPile(order, [0]);
    expect(order.picks).toEqual({ 0: { player: 'p2', forced: true }, 1: { player: 'p3', forced: false } });
    expect(T.turnCardPlayer('p12', 0, order, null)).toBe('p2');
    expect(order.history[0]).toEqual({ kind: 'p12', player: 'p1', forced: false, pos: null });
  });

  it('turno in corso rimesso nel mazzo (scelto): il turno continua, la memoria non cambia, poi carta obbligata', () => {
    const order = orderWith(['p12', 'p1']);
    draw(order);
    T.choosePairPlayer(order, 'p1');
    const d = T.turnDraftFrom(order);
    expect(T.turnDraftCurrent(d)).toBe(0);
    expect(T.turnDraftOps.pileToDeck(d, 0, 'top')).toBe(true);
    expect(d.left).toEqual(['p12', 'p1']);
    expect(d.known).toEqual([true, false]);
    expect(T.turnDraftCurrent(d), 'la carta del turno non è più negli scarti').toBe(-1);
    T.applyTurnDraft(order, d);
    expect(T.currentTurn(order)).toEqual({ kind: 'p12', player: 'p1', forced: false, pos: null });
    expect(order.pairNext).toEqual({ p12: 'p2', p34: null });
    expect(T.turnCardPlayer('p12', undefined, order, null)).toBe('p1');
    expect(T.predictedPairPlayers(order)).toEqual(['p2', null]);
    draw(order);
    expect(T.currentTurn(order)).toEqual({ kind: 'p12', player: 'p2', forced: true, pos: 0 });
    expect(order.history.length).toBe(2);
  });

  it('turno in corso rimesso nel mazzo (obbligato): la memoria resta vuota, poi si sceglie', () => {
    const order = orderWith(['p12', 'p1'], { pairNext: { p12: 'p2', p34: null } });
    draw(order);
    expect(T.currentTurn(order)).toEqual({ kind: 'p12', player: 'p2', forced: true, pos: 0 });
    const d = T.turnDraftFrom(order);
    T.turnDraftOps.pileToDeck(d, 0, 'bottom');
    expect(d.left).toEqual(['p1', 'p12']);
    T.applyTurnDraft(order, d);
    expect(order.pairNext).toEqual({ p12: null, p34: null });
    expect(order.picks).toEqual({});
    order.left = ['p12'];
    order.known = [true];
    draw(order);
    expect(must(T.currentTurn(order), 'turno in corso').player).toBe(null);
  });

  it('bozza: copie, firma, rivela, copri, sposta, mescola, posizione numerica', () => {
    const order = orderWith(['p1', 'p2', 'nemesis', 'p3'], { known: [false, true, false, false], drawn: ['p4'],
      history: [{ kind: 'p4', player: null, forced: false, pos: 0 }] });
    const d = T.turnDraftFrom(order);
    const key = T.turnDraftKey(d);
    expect(d.left).not.toBe(order.left);
    T.turnDraftOps.revealTop(d);
    expect(d.known).toEqual([true, true, false, false]);
    expect(order.known, 'la bozza non tocca il mazzo dei turni').toEqual([false, true, false, false]);
    expect(T.turnDraftKey(d)).not.toBe(key);
    // Sposta: solo carte note; posizioni valide
    expect(T.turnDraftOps.moveInDeck(d, 2, 0)).toBe(false);
    expect(T.turnDraftOps.moveInDeck(d, 0, 9)).toBe(false);
    expect(T.turnDraftOps.moveInDeck(d, 0, 3)).toBe(true);
    expect(d.left).toEqual(['p2', 'nemesis', 'p3', 'p1']);
    expect(d.known).toEqual([true, false, false, true]);
    T.turnDraftOps.revealAll(d);
    expect(d.known).toEqual([true, true, true, true]);
    T.turnDraftOps.coverAll(d);
    expect(d.known).toEqual([false, false, false, false]);
    // Carta degli scarti in una posizione dalla cima (numero)
    T.turnDraftOps.pileToDeck(d, 0, 2);
    expect(d.left).toEqual(['p2', 'nemesis', 'p4', 'p3', 'p1']);
    expect(d.known[2]).toBe(true);
    expect(d.history, 'il turno giocato resta nella storia').toEqual([{ kind: 'p4', player: null, forced: false, pos: null }]);
    expect(T.turnDraftOps.pileToDeck(d, 0, 'top'), 'scarti vuoti').toBe(false);
    // Mescola: tutto coperto, ripetibile con lo stesso caso
    const e = JSON.parse(JSON.stringify(d));
    T.turnDraftOps.shuffle(d, seeded(9));
    T.turnDraftOps.shuffle(e, seeded(9));
    expect(d.left).toEqual(e.left);
    expect(sorted(d.left)).toEqual(sorted(['p2', 'nemesis', 'p4', 'p3', 'p1']));
    expect(d.known.every(k => k === false)).toBe(true);
  });

  it('carte già note all\'apertura (old): si spostano solo dalla cima; copri e mescola le liberano', () => {
    const d = T.turnDraftFrom(orderWith(['p1', 'p2', 'p3'], { known: [true, true, false] }));
    d.old = [true, true, false];
    expect(T.turnDeckMovable(d, 0)).toBe(true);
    expect(T.turnDeckMovable(d, 1)).toBe(false);
    expect(T.turnDeckMovable(d, 2)).toBe(false);
    expect(T.turnDraftOps.moveInDeck(d, 1, 2)).toBe(false);
    expect(T.turnDraftOps.moveInDeck(d, 0, 2)).toBe(true);
    expect(d.old).toEqual([true, false, true]);
    T.turnDraftOps.coverAll(d);
    expect(d.old).toEqual([false, false, false]);
  });

  it('carta del mazzo portata negli scarti: in fondo, non è un turno, senza giocatore', () => {
    const order = orderWith(['p12', 'p1'], { known: [true, false], drawn: ['p3'], history: [{ kind: 'p3', player: null, forced: false, pos: 0 }] });
    const d = T.turnDraftFrom(order);
    expect(T.turnDraftOps.deckToPile(d, 1), 'non nota').toBe(false);
    expect(T.turnDraftOps.deckToPile(d, 0)).toBe(true);
    expect(d.left).toEqual(['p1']);
    expect(d.known).toEqual([false]);
    expect(d.drawn).toEqual(['p3', 'p12']);
    expect(d.history).toEqual(order.history);
    T.applyTurnDraft(order, d);
    expect(T.currentTurn(order)).toEqual({ kind: 'p3', player: null, forced: false, pos: 0 });
    expect(T.turnCardPlayer('p12', 1, order, null)).toBe(null);
    expect(order.pairNext).toEqual({ p12: null, p34: null });
  });

  it('linea del tempo: giocata, in corso, saltata; il turno in corso segue la carta, non la posizione', () => {
    const order = orderWith(['p1', 'p2', 'nemesis'], { known: [true, true, true], drawn: ['p3', 'p4'],
      history: [{ kind: 'p3', player: null, forced: false, pos: 0 }, { kind: 'p4', player: null, forced: false, pos: 1 }] });
    const d = T.turnDraftFrom(order);
    expect(T.turnPileStates(d)).toEqual(['done', 'current']);
    // carta del mazzo portata negli scarti: saltata, l'anello resta dov'è
    T.turnDraftOps.deckToPile(d, 0);
    expect(T.turnPileStates(d)).toEqual(['done', 'current', 'skipped']);
    // carta del turno in corso nel mazzo: nessun anello; un'altra carta portata negli scarti non lo eredita
    T.turnDraftOps.pileToDeck(d, 1, 'top');
    expect(T.turnPileStates(d)).toEqual(['done', 'skipped']);
    T.turnDraftOps.deckToPile(d, 1);
    expect(T.turnPileStates(d), 'altra carta').toEqual(['done', 'skipped', 'skipped']);
    // la carta del turno in corso torna negli scarti: X, l'anello non ricompare; il turno in corso resta nella storia
    T.turnDraftOps.deckToPile(d, 0);
    expect(T.turnPileStates(d)).toEqual(['done', 'skipped', 'skipped', 'skipped']);
    expect(d.history[1]).toEqual({ kind: 'p4', player: null, forced: false, pos: null });
    expect(T.currentTurn(d)).toEqual(d.history[1]);
    // togliere una carta giocata sposta i simboli insieme alle carte
    T.turnDraftOps.pileToDeck(d, 0, 'bottom');
    expect(T.turnPileStates(d)).toEqual(['skipped', 'skipped', 'skipped']);
  });
});

describe('salvataggi del mazzo dei turni', () => {
  const cards2 = () => T.turnOrderCards(2, false);

  it('mazzo dei turni completo letto com\'è (copie)', () => {
    const saved: MazzoTurniLetto = { left: ['p34', 'nemesis'], drawn: ['p12', 'p12', 'p34'], round: 3, wild: null,
      picks: { 0: { player: 'p1', forced: false }, 1: { player: 'p2', forced: true }, 2: { player: 'p4', forced: false } },
      known: [true, false], waiting: false, pairNext: { p12: null, p34: 'p3' },
      history: [{ kind: 'p12', player: 'p1', forced: false, pos: 0 }, { kind: 'p12', player: 'p2', forced: true, pos: 1 },
        { kind: 'p34', player: 'p4', forced: false, pos: 2 }] };
    const order = T.restoreTurnOrder(saved, { players: 4, resolving: false, turn: 5, cards: () => [], random: seeded(1) });
    expect(order).toEqual(saved);
    expect(order.left).not.toBe(saved.left);
  });

  it('prima della v220/v222: picks a stringhe, senza memoria né storia; la seconda carta della coppia è obbligata', () => {
    const old: MazzoTurniLetto = { left: ['nemesis'], drawn: ['p12', 'p12', 'p34', 'nemesis'], round: 2, picks: { 0: 'p2', 2: 'p3' } };
    const o = T.restoreTurnOrder(old, { players: 4, resolving: false, turn: 4, cards: () => [], random: seeded(1) });
    expect(o.picks).toEqual({ 0: { player: 'p2', forced: false }, 1: { player: 'p1', forced: true }, 2: { player: 'p3', forced: false } });
    expect(o.pairNext).toEqual({ p12: null, p34: 'p4' });
    expect(o.history.map(e => [e.kind, e.player, e.forced, e.pos]))
      .toEqual([['p12', 'p2', false, 0], ['p12', 'p1', true, 1], ['p34', 'p3', false, 2], ['nemesis', null, false, 3]]);
    expect(o.known).toEqual([false]);
    expect(o.waiting).toBe(false);
  });

  it('v168 senza giro, prima della v179 senza wild, prima della v168 senza mazzo dei turni', () => {
    const v168 = T.restoreTurnOrder({ left: ['p1'], drawn: ['wild'] }, { players: 3, resolving: false, turn: 4, cards: () => [], random: () => 0 });
    expect(v168.round).toBe(4);
    expect(v168.wild).toBe(1);
    // Senza mazzo dei turni: giro nuovo con il turno in corso già estratto (giocatore o nemesi)
    const none = T.restoreTurnOrder(undefined, { players: 2, resolving: false, turn: 3, cards: cards2, random: seeded(2) });
    expect(none.round).toBe(3);
    expect(none.drawn.length).toBe(1);
    expect(none.drawn[0]).not.toBe('nemesis');
    expect(none.left.length).toBe(5);
    const noneN = T.restoreTurnOrder(undefined, { players: 2, resolving: true, turn: 3, cards: cards2, random: seeded(2) });
    expect(noneN.drawn[0]).toBe('nemesis');
    // Turno nemesi con scarti dei turni e storia vuoti: come senza mazzo dei turni
    const empty = T.restoreTurnOrder({ left: ['p1'], drawn: [] }, { players: 2, resolving: true, turn: 1, cards: cards2, random: seeded(2) });
    expect(empty.drawn[0]).toBe('nemesis');
    // Ma con un turno nella storia (la carta tornata nel mazzo) si legge com'è
    const back = T.restoreTurnOrder({ left: ['nemesis'], drawn: [], history: [{ kind: 'nemesis', pos: 0 }], pairNext: {} },
      { players: 2, resolving: true, turn: 1, cards: cards2, random: seeded(2) });
    expect(back.left).toEqual(['nemesis']);
    expect(back.history).toEqual([{ kind: 'nemesis', player: null, forced: false, pos: null }]);
    // Turno annullato (v211-v221) solo nel turno giocatori e con carte negli scarti
    expect(T.restoreTurnOrder({ left: [], drawn: ['p1'], waiting: true }, { players: 2, resolving: false, turn: 1, cards: cards2, random: seeded(2) }).waiting).toBe(true);
    expect(T.restoreTurnOrder({ left: [], drawn: ['p1'], waiting: true }, { players: 2, resolving: true, turn: 1, cards: cards2, random: seeded(2) }).waiting).toBe(false);
    // Carte note di lunghezza sbagliata: nessuna nota
    expect(T.restoreTurnOrder({ left: ['p1', 'p2'], drawn: ['p1'], known: [true] }, { players: 2, resolving: false, turn: 1, cards: cards2, random: seeded(2) }).known).toEqual([false, false]);
  });

  it('storia ricostruita dagli scarti', () => {
    expect(T.historyFromPile({ drawn: ['p12', 'nemesis'], picks: { 0: { player: 'p2', forced: true } } }))
      .toEqual([{ kind: 'p12', player: 'p2', forced: true, pos: 0 }, { kind: 'nemesis', player: null, forced: false, pos: 1 }]);
  });
});
