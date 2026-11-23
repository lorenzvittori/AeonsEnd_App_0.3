// Test della fase A (npm test, Vitest): i moduli si caricano senza effetti e il mazzo nemesi rispetta deck-setup.json.
// I test veri delle regole arrivano con la fase B (regole pure con i loro test).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { G } from '../src/stato/condivise.js';
import { buildDeck, deckPlan, deckSetupRow, deckShortfall } from '../src/regole/mazzo.js';

const ROOT = join(import.meta.dirname, '..');
const json = name => JSON.parse(readFileSync(join(ROOT, 'public', name), 'utf8'));

describe('moduli di src/', () => {
  const files = [];
  (function walk(dir) { readdirSync(dir).forEach(f => { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js') && f !== 'main.js') files.push(p); }); })(join(ROOT, 'src'));

  it.each(files.map(f => relative(ROOT, f)))('%s si importa senza DOM ed esporta avvio()', async rel => {
    const mod = await import('../' + rel.split('\\').join('/'));
    if (!rel.endsWith('condivise.js')) expect(typeof mod.avvio).toBe('function');
  });
});

describe('mazzo nemesi (dati veri)', () => {
  beforeAll(() => {
    G.allCards = json('cards.json');
    G.nemeses = json('nemesis.json');
    G.deckSetup = json('deck-setup.json');
    G.products = json('products.json');
    G.collection = new Set(Object.keys(G.products));
  });

  const playable = () => G.nemeses.filter(n => n.boxCode && n.battle !== null
    && G.allCards.some(c => c.category === 'Specific' && c.nemesis === n.name));

  it('per ogni nemesi giocabile e 2/3/4 giocatori: Basic e Upgraded come deck-setup.json (o mazzo corto con avviso)', () => {
    expect(playable().length).toBeGreaterThan(10);
    for (const n of playable()) {
      for (const players of [2, 3, 4]) {
        G.settings = { players, nemesis: n.name, battleMode: true, mergeCollection: true };
        const row = deckSetupRow();
        const deck = buildDeck();
        let want = 0;
        for (const t of [1, 2, 3]) {
          const count = kind => deckPlan.find(p => p.tier === t && p.kind === kind).count;
          expect(count('basic')).toBeLessThanOrEqual(row.basic[t]);
          expect(count('upgraded')).toBeLessThanOrEqual(row.upgradedBasic[t]);
          want += row.basic[t] + row.upgradedBasic[t];
          const specific = G.allCards.filter(c => c.category === 'Specific' && c.nemesis === n.name && c.inNemesisDeck === true && c.tier === t).length;
          expect(count('specific')).toBe(specific);
        }
        const have = deckPlan.filter(p => p.kind !== 'specific').reduce((s, p) => s + p.count, 0);
        expect(deckShortfall()).toEqual(have < want ? { want, have } : null);
        expect(deck.length).toBe(deckPlan.reduce((s, p) => s + p.count, 0));
        // Si pesca dalla fine: in cima (fine dell'array) il Tier 1, in fondo il Tier 3
        const tiers = deck.map(c => c.tier);
        expect(tiers).toEqual([...tiers].sort((a, b) => b - a));
      }
    }
  });
});
