// Mazzo nemesi (src/regole/mazzo-nemesi.js) sui dati veri di public/: Nemesis Deck Setup per ogni nemesi giocabile ×
// 2/3/4 giocatori × Modalità battaglia × Unisci, blocco di Unisci, mazzo corto, inNemesisDeck e Tier, nemesi giocabili.
// I numeri attesi si calcolano qui da deck-setup.json e cards.json, senza passare dalle funzioni provate.
import { describe, it, expect } from 'vitest';
import * as Mazzo from '../src/regole/mazzo-nemesi.ts';
import { db, cards, nemeses, deckSetup, seeded, allProducts, appWaves } from './aiuto.js';

const COMBOS = [
  { battleMode: true, mergeCollection: true },
  { battleMode: true, mergeCollection: false },
  { battleMode: false, mergeCollection: true },
  { battleMode: false, mergeCollection: false }
];

// Riga attesa di deck-setup.json: battaglia della nemesi (o 1 senza Modalità battaglia, con le Upgraded a 0)
function expectedRow(nemesis, players, battleMode) {
  const info = nemeses.find(n => n.name === nemesis);
  const battle = deckSetup.battles.find(b => b.battle === (battleMode ? info.battle : 1));
  const row = battle.players[String(players)];
  return { basic: row.basic, upgraded: battleMode ? row.upgradedBasic : { 1: 0, 2: 0, 3: 0 } };
}
// Carte ammesse per categoria e Tier: inNemesisDeck, collezione e, senza Unisci in vigore, wave della nemesi
function expectedPool(collection, nemesis, category, tier, merge) {
  const wave = Mazzo.waveOfCode(nemeses.find(n => n.name === nemesis).boxCode);
  return cards.filter(c => c.category === category && c.inNemesisDeck === true && c.tier === tier
    && (!c.boxCode || collection.has(c.boxCode)) && (merge || Mazzo.waveOfCode(c.boxCode) === wave));
}

// Controlla ogni nemesi giocabile con la collezione: restituisce quante combinazioni ha provato
function checkDeck(collection, label) {
  const playable = nemeses.filter(n => Mazzo.isPlayable(db, collection, n));
  expect(playable.length, `${label}: nessuna nemesi giocabile`).toBeGreaterThan(0);
  let seed = 1;
  let combos = 0;
  for (const info of playable) {
    for (const players of [2, 3, 4]) {
      for (const opts of COMBOS) {
        combos++;
        const s = { players, nemesis: info.name, ...opts };
        const where = `${label} · ${info.name} · ${players}G · battaglia ${opts.battleMode} · unisci ${opts.mergeCollection}`;
        const row = expectedRow(info.name, players, opts.battleMode);
        expect(Mazzo.deckSetupRow(db, s).basic, where).toEqual(row.basic);
        expect(Mazzo.deckSetupRow(db, s).upgradedBasic, where).toEqual(row.upgraded);
        // Blocco: con Modalità battaglia, Upgraded richieste e nessuna Upgraded della wave della nemesi nella collezione
        const wave = Mazzo.waveOfCode(info.boxCode);
        const wantsUp = [1, 2, 3].some(t => row.upgraded[t] > 0);
        const waveHasUp = cards.some(c => c.category === 'Upgraded' && c.inNemesisDeck === true && c.boxCode
          && Mazzo.waveOfCode(c.boxCode) === wave && collection.has(c.boxCode));
        const locked = opts.battleMode && wantsUp && !waveHasUp;
        expect(Mazzo.mergeLockedWave(db, collection, s), where + ' (blocco)').toBe(locked ? wave : null);
        const merge = opts.mergeCollection || locked;
        expect(Mazzo.mergeActive(db, collection, s), where + ' (unisci in vigore)').toBe(merge);

        const { deck, plan } = Mazzo.buildDeck(db, collection, s, seeded(seed++));
        let want = 0;
        let have = 0;
        let total = 0;
        for (const t of [1, 2, 3]) {
          const nB = Math.min(row.basic[t], expectedPool(collection, info.name, 'Basic', t, merge).length);
          const nU = Math.min(row.upgraded[t], expectedPool(collection, info.name, 'Upgraded', t, merge).length);
          const nS = cards.filter(c => c.category === 'Specific' && c.nemesis === info.name && c.inNemesisDeck === true && c.tier === t).length;
          want += row.basic[t] + row.upgraded[t];
          have += nB + nU;
          total += nB + nU + nS;
          const count = kind => plan.find(p => p.tier === t && p.kind === kind).count;
          expect(count('basic'), `${where}: Basic Tier ${t}`).toBe(nB);
          expect(count('upgraded'), `${where}: Upgraded Tier ${t}`).toBe(nU);
          expect(count('specific'), `${where}: Specific Tier ${t}`).toBe(nS);
          const inDeck = deck.filter(c => c.tier === t);
          expect(inDeck.filter(c => c.category === 'Basic').length, `${where}: Basic nel mazzo, Tier ${t}`).toBe(nB);
          expect(inDeck.filter(c => c.category === 'Upgraded').length, `${where}: Upgraded nel mazzo, Tier ${t}`).toBe(nU);
          expect(inDeck.filter(c => c.category === 'Specific').length, `${where}: Specific nel mazzo, Tier ${t}`).toBe(nS);
        }
        expect(deck.length, where + ' (carte totali)').toBe(total);
        // Solo carte del mazzo nemesi, della collezione (Basic/Upgraded) e, senza Unisci, della wave della nemesi
        for (const c of deck) {
          expect(c.inNemesisDeck, where).toBe(true);
          if (c.category === 'Specific') expect(c.nemesis, where).toBe(info.name);
          else {
            expect(!c.boxCode || collection.has(c.boxCode), where + ' (fuori collezione)').toBe(true);
            if (!merge) expect(Mazzo.waveOfCode(c.boxCode), where + ' (fuori dalla wave)').toBe(wave);
          }
        }
        expect(new Set(deck).size, where + ' (doppioni)').toBe(deck.length);
        // Si pesca dalla fine: in cima (fine dell'array) il Tier 1, all'inizio il Tier 3
        const tiers = deck.map(c => c.tier);
        expect(tiers, where + ' (ordine dei Tier)').toEqual(tiers.slice().sort((a, b) => b - a));
        // Avviso del mazzo corto
        expect(Mazzo.deckShortfall(db, collection, s), where + ' (mazzo corto)').toEqual(have < want ? { want, have } : null);
      }
    }
  }
  return combos;
}

describe('mazzo nemesi: Nemesis Deck Setup', () => {
  it('ogni nemesi giocabile × 2/3/4 × Modalità battaglia × Unisci, collezione completa', () => {
    expect(checkDeck(allProducts, 'tutta la collezione')).toBeGreaterThan(100);
  });

  it('wave 1 e 4 (quelle sceglibili oggi)', () => {
    checkDeck(appWaves, 'wave 1 e 4');
  });

  it('solo la scatola base della wave 1 (mazzo corto e blocco di Unisci)', () => {
    checkDeck(new Set(['1']), 'solo wave 1 base');
    // Almeno un caso di mazzo corto davvero provato
    const short = nemeses.filter(n => Mazzo.isPlayable(db, new Set(['1']), n))
      .some(n => [2, 3, 4].some(p => Mazzo.deckShortfall(db, new Set(['1']), { players: p, nemesis: n.name, battleMode: true, mergeCollection: true })));
    expect(short).toBe(true);
  });

  it('blocco di Unisci: battaglia con Upgraded e wave della nemesi senza Upgraded', () => {
    const collection = new Set(['1', '4']);
    const wave1 = nemeses.find(n => n.boxCode === '1' && n.battle >= 2 && Mazzo.isPlayable(db, collection, n));
    expect(wave1, 'serve una nemesi della wave 1 con battaglia ≥ 2').toBeTruthy();
    const s = { players: 2, nemesis: wave1.name, battleMode: true, mergeCollection: false };
    expect(cards.some(c => c.category === 'Upgraded' && c.inNemesisDeck && c.boxCode === '1'), 'la scatola base della wave 1 non ha Upgraded').toBe(false);
    expect(Mazzo.mergeLockedWave(db, collection, s)).toBe('1');
    expect(Mazzo.mergeActive(db, collection, s), 'Unisci resta in vigore anche se spento').toBe(true);
    expect(Mazzo.ownedUpgradedInWave(db, collection, '1')).toBe(false);
    expect(Mazzo.ownedUpgradedInWave(db, collection, '4')).toBe(true);
    // Senza Modalità battaglia niente blocco (nessuna Upgraded richiesta)
    expect(Mazzo.mergeLockedWave(db, collection, { ...s, battleMode: false })).toBe(null);
    expect(Mazzo.mergeActive(db, collection, { ...s, battleMode: false })).toBe(false);
    // Le Upgraded del mazzo arrivano dalla wave 4
    const { deck } = Mazzo.buildDeck(db, collection, s, seeded(7));
    const ups = deck.filter(c => c.category === 'Upgraded');
    expect(ups.length).toBeGreaterThan(0);
    ups.forEach(c => expect(Mazzo.waveOfCode(c.boxCode)).toBe('4'));
  });

  it('inNemesisDeck e Tier: nessuna carta fuori dal mazzo nemesi nei mazzi possibili', () => {
    for (const cat of ['Basic', 'Upgraded']) {
      for (const t of [1, 2, 3]) {
        const pool = Mazzo.deckPool(db, allProducts, cat, t, { players: 2, nemesis: 'Rageborne', battleMode: true, mergeCollection: true });
        expect(pool.length).toBeGreaterThan(0);
        pool.forEach(c => { expect(c.inNemesisDeck).toBe(true); expect(c.tier).toBe(t); expect(c.category).toBe(cat); });
      }
    }
  });

  it('mazzo ripetibile con lo stesso caso; senza riga (nemesi inesistente) mazzo vuoto', () => {
    const s = { players: 3, nemesis: nemeses.find(n => Mazzo.isPlayable(db, allProducts, n)).name, battleMode: true, mergeCollection: true };
    const a = Mazzo.buildDeck(db, allProducts, s, seeded(42)).deck.map(c => c.id);
    const b = Mazzo.buildDeck(db, allProducts, s, seeded(42)).deck.map(c => c.id);
    expect(a).toEqual(b);
    expect(Mazzo.buildDeck(db, allProducts, s, seeded(43)).deck.map(c => c.id)).not.toEqual(a);
    expect(Mazzo.buildDeck(db, allProducts, { ...s, nemesis: 'Nessuna' }, seeded(1))).toEqual({ deck: [], plan: [] });
    expect(Mazzo.deckShortfall(db, allProducts, { ...s, nemesis: 'Nessuna' })).toBe(null);
    expect(Mazzo.deckSetupRow(db, { ...s, nemesis: 'Nessuna' })).toBe(null);
  });

  it('opzioni mancanti = Modalità battaglia e Unisci accese', () => {
    const s = { players: 4, nemesis: 'Maggoth' };
    expect(Mazzo.deckSetupRow(db, s)).toEqual(Mazzo.deckSetupRow(db, { ...s, battleMode: true }));
    expect(Mazzo.mergeActive(db, allProducts, s)).toBe(true);
  });
});

describe('nemesi giocabili e codici prodotto', () => {
  it('prodotto, battaglia, carte Specific e collezione', () => {
    expect(nemeses.filter(n => Mazzo.isPlayable(db, new Set(), n)).length).toBe(0);
    const playable = nemeses.filter(n => Mazzo.isPlayable(db, allProducts, n));
    for (const n of playable) {
      expect(n.boxCode, n.name).toBeTruthy();
      expect(n.battle, n.name).not.toBe(null);
      expect(cards.some(c => c.category === 'Specific' && c.nemesis === n.name), n.name).toBe(true);
    }
    // Le Promo (boxCode null) non sono mai giocabili
    nemeses.filter(n => !n.boxCode).forEach(n => expect(Mazzo.isPlayable(db, allProducts, n), n.name).toBe(false));
    // collection null (tutto ammesso) = collezione completa
    expect(nemeses.filter(n => Mazzo.isPlayable(db, null, n)).map(n => n.name)).toEqual(playable.map(n => n.name));
    // Con la sola wave 4 solo nemesi della wave 4
    const w4 = new Set(['4', '4.1', '4.2', '4.3']);
    nemeses.filter(n => Mazzo.isPlayable(db, w4, n)).forEach(n => expect(w4.has(n.boxCode), n.name).toBe(true));
    // Le 7 nemesi di The New Age e le 7 della wave 1 sono giocabili con la collezione completa
    ['Maggoth', 'Arachnos', 'Ageless Walker', 'Fenrix', 'The Wailing', 'The Wanderer', 'Necroswarm', 'Rageborne',
      'Crooked Mask', 'Horde-Crone', 'Blight Lord', 'Wayward One', 'Carapace Queen', 'Prince of Gluttons']
      .forEach(name => expect(playable.some(n => n.name === name), name).toBe(true));
    expect(Mazzo.battleOf(db, 'Maggoth')).toBe(nemeses.find(n => n.name === 'Maggoth').battle);
    expect(Mazzo.battleOf(db, 'Nessuna')).toBe(null);
  });

  it('wave, mini espansioni, prodotti posseduti', () => {
    expect(Mazzo.waveOfCode('4.1')).toBe('4');
    expect(Mazzo.waveOfCode('4')).toBe('4');
    expect(Mazzo.waveOfCode(null)).toBe(null);
    expect(Mazzo.isMiniCode('4.1')).toBe(true);
    expect(Mazzo.isMiniCode('4')).toBe(false);
    expect(Mazzo.ownsProduct(null, '9')).toBe(true);
    expect(Mazzo.ownsProduct(new Set(['4']), '9')).toBe(false);
    expect(Mazzo.cardAllowed(new Set(['4']), { boxCode: '1' })).toBe(false);
    expect(Mazzo.cardAllowed(new Set(['4']), { boxCode: null })).toBe(true);
  });
});
