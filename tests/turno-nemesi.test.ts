// Turno nemesi e turno giocatori (src/regole/turno-nemesi.ts) con le carte vere di cards.json: risoluzione (potere,
// minion, attacco), pesca (anche a mazzo vuoto), vittoria a mazzo vuoto, costo Æ, statistiche, minion a vita variabile.
import { describe, it, expect } from 'vitest';
import * as N from '../src/regole/turno-nemesi.ts';
import { cards, cardByName, must } from './aiuto.ts';
import type { Carta, TipoCarta } from '../src/tipi/dati.ts';
import type { Statistiche, VoceInGioco } from '../src/tipi/partita.ts';

const byType = (type: TipoCarta, pred: (c: Carta) => boolean = () => true): Carta =>
  must(cards.find(c => c.type === type && c.inNemesisDeck && pred(c)), type);
const POWER2 = byType('Power', c => c.powerTokens === 2);
const POWER1 = byType('Power', c => c.powerTokens === 1);
const MINION = byType('Minion', c => !c.hpVariable && Number(c.hp) > 1);
const MINION_HP = must(MINION.hp, 'vita del minion');
const ATTACK = byType('Attack');
const VARIABLE = must(cards.find(c => c.type === 'Minion' && c.hpVariable === true), 'minion a vita variabile');

// Partita minima, come la passa l'app (i campi di G usati dalle regole)
type GiocoProva = N.Gioco & { newUid: () => number; add: (data: Carta) => VoceInGioco };
function game(extra: Partial<N.Gioco> = {}): GiocoProva {
  let uid = 1;
  const newUid = () => uid++;
  const g: GiocoProva = {
    queue: extra.queue || [], deck: extra.deck || [], discard: extra.discard || [], stats: extra.stats || N.emptyStats(0),
    turn: extra.turn !== undefined ? extra.turn : 1, currentIndex: 0, newIndex: -1, resolving: false, maxTierDrawn: 1,
    newUid,
    add: data => { const e = N.makeEntry(data, newUid(), g.turn); g.queue.push(e); return e; }
  };
  return g;
}

describe('turno nemesi', () => {
  it('carte usate dai test', () => {
    [POWER2, POWER1, MINION, ATTACK, VARIABLE].forEach(c => expect(c).toBeTruthy());
  });

  it('risoluzione: potere con 2 token, minion, attacco, poi passo Pesca; potere all\'ultimo token negli scarti', () => {
    const g = game({ deck: [ATTACK] });
    const p = g.add(POWER2);
    const m = g.add(MINION);
    g.add(ATTACK);
    N.nemesisTurn(g);
    expect(g.turn).toBe(2);
    expect(g.resolving).toBe(true);
    expect(g.currentIndex).toBe(0);
    expect(N.resolveCurrent(g)).toBe('token');
    expect(p.tokens).toBe(1);
    expect(g.currentIndex).toBe(1);
    expect(N.resolveCurrent(g)).toBe('next');
    expect(g.queue.includes(m)).toBe(true);
    expect(N.resolveCurrent(g)).toBe('discard');
    expect(g.discard).toEqual([ATTACK]);
    expect(g.stats.attacksResolved).toBe(1);
    expect(g.stats.cards.attacksResolved).toEqual([ATTACK.id]);
    expect(N.isDrawStep(g)).toBe(true);
    expect(g.resolving).toBe(true);
    N.endResolution(g);
    N.nemesisTurn(g);
    expect(N.resolveCurrent(g)).toBe('discard');
    expect(g.stats.powersResolved).toBe(1);
    expect(g.stats.cards.powersResolved).toEqual([POWER2.id]);
    expect(g.queue.length).toBe(1);
  });

  it('inizio del turno: nessuna carta resta nuova; coda vuota = passo Pesca, o fine se non c\'è niente da pescare', () => {
    const g = game();
    const m = g.add(MINION);
    m.isNew = true;
    N.nemesisTurn(g);
    expect(m.isNew).toBe(false);
    expect(N.resolveCurrent(g)).toBe('next');
    expect(g.resolving).toBe(false);
    expect(g.currentIndex).toBe(0);
    const e = game();
    N.nemesisTurn(e);
    expect(e.resolving).toBe(false);
    const d = game({ deck: [MINION] });
    N.nemesisTurn(d);
    expect(N.isDrawStep(d)).toBe(true);
  });

  it('pesca: carta in fondo alla coda come nuova, Tier nuovo con l\'ora, poi attacco negli scarti o carta in gioco', () => {
    const tier2 = must(cards.find(c => c.inNemesisDeck && c.tier === 2 && c.type === 'Attack'), 'attacco Tier 2');
    const tier2m = must(cards.find(c => c.inNemesisDeck && c.tier === 2 && c.type === 'Minion' && !c.hpVariable), 'minion Tier 2');
    const g = game({ deck: [tier2m, tier2] });
    N.nemesisTurn(g);
    let clockReads = 0;
    let r = must(N.drawNewCard(g, g.newUid, () => { clockReads++; return 1234; }), 'carta pescata');
    expect(r.entry.data).toBe(tier2);
    expect(r.entry.isNew).toBe(true);
    expect(r.newTier).toBe(2);
    expect(g.stats.tierAt[2]).toBe(1234);
    expect(g.maxTierDrawn).toBe(2);
    expect(g.newIndex).toBe(0);
    expect(g.currentIndex).toBe(0);
    expect(N.isDrawStep(g)).toBe(false);
    expect(N.resolveCurrent(g)).toBe('discard');
    expect(g.resolving).toBe(false);
    expect(g.stats.attacksResolved).toBe(1);
    // Secondo Tier 2: nessuna scritta, l'orologio non si legge
    N.nemesisTurn(g);
    r = must(N.drawNewCard(g, g.newUid, () => { clockReads++; return 99; }), 'carta pescata');
    expect(clockReads).toBe(1);
    expect(r.newTier).toBe(null);
    expect(g.stats.tierAt[2]).toBe(1234);
    expect(N.resolveCurrent(g)).toBe('play');
    expect(r.entry.isNew).toBe(false);
    expect(g.queue.length).toBe(1);
    expect(g.resolving).toBe(false);
    expect(r.entry.bornTurn).toBe(3);
  });

  it('mazzo vuoto: non si rimescola, niente pesca e fine del turno', () => {
    const g = game({ discard: [ATTACK, MINION] });
    g.add(POWER2);
    N.nemesisTurn(g);
    N.resolveCurrent(g);
    expect(g.resolving).toBe(false);
    g.resolving = true;
    expect(N.drawNewCard(g, g.newUid, () => 0)).toBe(null);
    expect(g.resolving).toBe(false);
    expect(g.discard.length).toBe(2);
    expect(N.drawFromDeck(g)).toBe(null);
    expect(N.canDraw(g)).toBe(false);
  });

  it('vittoria a mazzo vuoto: dopo il primo turno nemesi, nessun potere né minion in gioco', () => {
    const g = game({ turn: 0 });
    expect(N.isVictory(g)).toBe(false);
    g.turn = 1;
    expect(N.isVictory(g)).toBe(true);
    g.add(ATTACK);
    expect(N.isVictory(g)).toBe(true);
    g.add(MINION);
    expect(N.isVictory(g)).toBe(false);
    g.queue = [N.makeEntry(POWER1, 9, 1)];
    expect(N.isVictory(g)).toBe(false);
    g.queue = [];
    g.deck = [ATTACK];
    expect(N.isVictory(g)).toBe(false);
  });

  it('minion eliminato nel turno nemesi: gli indici seguono la coda; il minion appena pescato chiude la risoluzione', () => {
    const g = game({ deck: [ATTACK] });
    const a = g.add(MINION);
    const b = g.add(MINION);
    g.add(POWER2);
    N.nemesisTurn(g);
    g.currentIndex = 2;
    N.removeWhileResolving(g, a);
    expect(g.currentIndex).toBe(1);
    expect(g.stats.minionsKilled).toBe(1);
    N.drawNewCard(g, g.newUid, () => 0);
    N.removeWhileResolving(g, g.queue[g.newIndex]);
    expect(g.resolving).toBe(false);
    expect(g.queue.includes(b)).toBe(true);
  });
});

describe('turno giocatori e statistiche', () => {
  it('costo Æ: removalCost numerico, altrimenti 0; poteri pagati nelle statistiche', () => {
    const paid = must(cards.find(c => c.type === 'Power' && Number(c.removalCost) > 0), 'potere con costo');
    expect(paid).toBeTruthy();
    expect(N.aetherCost(paid)).toBe(Number(paid.removalCost));
    expect(N.aetherCost({ removalCost: null })).toBe(0);
    expect(N.aetherCost({ removalCost: 'X' })).toBe(0);
    expect(N.aetherCost({ removalCost: '6' })).toBe(6);
    const g = game();
    const e = g.add(paid);
    e.paid = true;
    expect(N.isGone(e)).toBe(true);
    N.endPlayerTurnCards(g);
    expect(g.stats.powersPaid).toBe(1);
    expect(g.stats.aetherSpent).toBe(Number(paid.removalCost));
    expect(g.discard).toEqual([paid]);
  });

  it('fine del turno giocatori: vita di riferimento aggiornata, minion a 0 negli scarti con i turni in gioco', () => {
    const g = game({ turn: 4 });
    const m = N.makeEntry(MINION, 1, 1);
    const alive = N.makeEntry(MINION, 2, 3);
    g.queue.push(m, alive);
    m.hp = 0;
    alive.hp = 1;
    N.endPlayerTurnCards(g);
    expect(alive.turnHp).toBe(1);
    expect(g.queue).toEqual([alive]);
    expect(g.stats.minionsKilled).toBe(1);
    expect(g.stats.minions).toEqual([{ id: MINION.id, name: MINION.name, turns: 3 }]);
  });

  it('modifiche salvate: danni e uccisioni del mago, poteri pagati, carte grigie negli scarti', () => {
    const g = game();
    const m = g.add(MINION);
    const p = g.add(POWER2);
    const gone = N.applyDrafts(g, new Map([[m.uid, { hp: 0 }], [p.uid, { paid: true }], [999, { hp: 3 }]]), 'p2');
    expect(gone).toEqual([m, p]);
    expect(g.stats.mages.p2).toEqual({ damage: MINION_HP, powers: 1, kills: 1 });
    expect(g.queue.length).toBe(0);
    expect(g.stats.minionsKilled).toBe(1);
    expect(g.stats.powersPaid).toBe(1);
    // Nessun giocatore (carta da scegliere): nessuna statistica dei maghi
    const h = game();
    const m2 = h.add(MINION);
    N.applyDrafts(h, new Map([[m2.uid, { hp: MINION_HP - 1 }]]), null);
    expect(h.stats.mages).toEqual({});
    expect(m2.hp).toBe(MINION_HP - 1);
    // Cura: nessun danno negativo
    const k = game();
    const m3 = k.add(MINION);
    m3.hp = 1;
    N.applyDrafts(k, new Map([[m3.uid, { hp: 2 }]]), 'p1');
    expect(k.stats.mages.p1).toEqual({ damage: 0, powers: 0, kills: 0 });
  });

  it('minion a vita variabile: "?" finché non impostata, non muore a 0, +1 senza limite, poi vita massima', () => {
    const e = N.makeEntry(VARIABLE, 1, 2);
    expect([e.hp, e.turnHp, e.hpSet, e.bornTurn]).toEqual([0, null, false, 2]);
    expect(N.isVariableMinion(VARIABLE)).toBe(true);
    expect(N.hpUnset(e)).toBe(true);
    expect(N.isGone(e)).toBe(false);
    expect(N.hpCap(e, false)).toBe(Infinity);
    expect(N.hpCap(e, true)).toBe(Infinity);
    const g = game();
    g.queue.push(e);
    N.applyDrafts(g, new Map([[e.uid, { hp: 7 }]]), 'p1');
    expect([e.hp, e.turnHp, e.hpSet, e.hpMax]).toEqual([7, 7, true, 7]);
    expect(g.stats.mages.p1).toEqual({ damage: 0, powers: 0, kills: 0 });
    expect(N.hpUnset(e)).toBe(false);
    expect(N.hpMaxOf(e)).toBe(7);
    expect(N.hpCap(e, true)).toBe(7);
    e.hp = 5;
    e.turnHp = 6;
    expect(N.hpCap(e, false)).toBe(6);
    e.hp = 0;
    expect(N.isGone(e)).toBe(true);
    // Impostata a 0 la prima volta: resta "?"
    const z = N.makeEntry(VARIABLE, 2, 1);
    const g2 = game();
    g2.queue.push(z);
    N.applyDrafts(g2, new Map([[z.uid, { hp: 0 }]]), null);
    expect(N.hpUnset(z)).toBe(true);
    expect(g2.queue.length).toBe(1);
    // Minion normale: tetto = vita della carta e, nel turno giocatori, vita di inizio turno
    const n = N.makeEntry(MINION, 3, 1);
    n.hp = 1;
    n.turnHp = 2;
    expect(N.hpCap(n, true)).toBe(MINION_HP);
    expect(N.hpCap(n, false)).toBe(Math.min(MINION_HP, 2));
    n.turnHp = null;
    expect(N.hpCap(n, false)).toBe(1);
    expect(N.hasHp(n)).toBe(true);
    expect(N.hasHp(N.makeEntry(ATTACK, 4, 1))).toBe(false);
  });

  it('statistiche: statCard su statistiche vecchie, partita nuova, carta negli scarti, voce per uid', () => {
    const st: Partial<Statistiche> = { minionsKilled: 0, minions: [] };
    N.statCard(st, 'powersPaid', { id: 'X' });
    expect(must(st.cards, 'elenchi delle statistiche').powersPaid).toEqual(['X']);
    expect(N.emptyStats(12).deckSize).toBe(12);
    const g = game();
    const e = g.add(cardByName(MINION.name));
    expect(N.entryByUid(g.queue, e.uid)).toBe(e);
    expect(N.entryByUid(g.queue, 999)).toBe(null);
    N.discardEntry(g, e);
    expect(g.discard).toEqual([MINION]);
    expect(g.queue.length).toBe(0);
  });
});
