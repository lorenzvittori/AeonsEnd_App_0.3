// Moduli di src/: si caricano senza DOM; quelli dell'app esportano avvio(), le regole (src/regole/) no e sono pure
// (il controllo vero della purezza è in tools/check-moduli.mjs, npm run check); il caso (regole/caso.js); il collegamento
// stato/partita.js usa le regole con lo stato condiviso G.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { G } from '../src/stato/condivise.js';
import { buildDeck, deckSetupRow, deckShortfall } from '../src/stato/partita.js';
import * as partita from '../src/stato/partita.js';
import { shuffle, pickRandom } from '../src/regole/caso.js';
import { readJson, seeded } from './aiuto.js';

const ROOT = join(import.meta.dirname, '..');

describe('moduli di src/', () => {
  const files = [];
  (function walk(dir) { readdirSync(dir).forEach(f => { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js') && f !== 'main.js') files.push(p); }); })(join(ROOT, 'src'));
  const rel = f => relative(ROOT, f).split(sep).join('/');

  it.each(files.map(rel))('%s si importa senza DOM', async name => {
    const mod = await import('../' + name);
    if (name.startsWith('src/regole/')) expect(mod.avvio, 'le regole non hanno codice di avvio').toBeUndefined();
    else if (!name.endsWith('condivise.js')) expect(typeof mod.avvio).toBe('function');
  });

  it('src/regole/ non nomina document, window, localStorage, G, Math.random, Date (fuori dai commenti)', () => {
    const regole = files.filter(f => rel(f).startsWith('src/regole/'));
    expect(regole.length).toBe(6);
    for (const f of regole) {
      const code = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const bad of [/\bdocument\b/, /\bwindow\b/, /\blocalStorage\b/, /\bG\./, /Math\.random/, /\bDate\b/, /from '\.\.\//]) {
        expect(bad.test(code), `${rel(f)}: ${bad}`).toBe(false);
      }
      // Intestazione: cosa contiene, cosa riceve, da chi è usato
      const head = readFileSync(f, 'utf8').split('\n').slice(0, 20).join('\n');
      expect(head, rel(f)).toMatch(/^\/\/ regole\//);
      expect(head, rel(f)).toMatch(/Ricev/);
      expect(head, rel(f)).toMatch(/Usato da/);
    }
  });
});

describe('caso (regole/caso.js)', () => {
  it('shuffle: copia mescolata, ripetibile con lo stesso caso; pickRandom: n carte diverse', () => {
    const list = Array.from({ length: 20 }, (_, i) => i);
    const a = shuffle(list, seeded(1));
    expect(a).not.toBe(list);
    expect(list).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(a.slice().sort((x, y) => x - y)).toEqual(list);
    expect(shuffle(list, seeded(1))).toEqual(a);
    expect(a).not.toEqual(list);
    const p = pickRandom(list, 5, seeded(2));
    expect(p.length).toBe(5);
    expect(new Set(p).size).toBe(5);
    expect(pickRandom(list, 50, seeded(2)).length).toBe(20);
    expect(pickRandom(list, 0, seeded(2))).toEqual([]);
  });
});

describe('stato/partita.js: regole con lo stato della partita (dati veri)', () => {
  beforeAll(() => {
    G.allCards = readJson('cards.json');
    G.nemeses = readJson('nemesis.json');
    G.deckSetup = readJson('deck-setup.json');
    G.products = readJson('products.json');
    G.collection = new Set(Object.keys(G.products));
  });

  it('mazzo per le scelte della partita: righe di deck-setup.json, plan e ordine dei Tier', () => {
    for (const players of [2, 3, 4]) {
      G.settings = { players, nemesis: 'Maggoth', battleMode: true, mergeCollection: true };
      const row = deckSetupRow();
      const deck = buildDeck();
      for (const t of [1, 2, 3]) {
        const count = kind => partita.deckPlan.find(p => p.tier === t && p.kind === kind).count;
        expect(count('basic')).toBe(row.basic[t]);
        expect(count('upgraded')).toBe(row.upgradedBasic[t]);
      }
      expect(deckShortfall()).toBe(null);
      expect(deck.length).toBe(partita.deckPlan.reduce((s, p) => s + p.count, 0));
      const tiers = deck.map(c => c.tier);
      expect(tiers).toEqual([...tiers].sort((a, b) => b - a));
    }
  });
});
