// Moduli di src/: si caricano senza DOM; quelli avviati da main.ts esportano avvio(), le regole (src/regole/) no e sono
// pure (il controllo vero della purezza è in tools/check-moduli.mjs, npm run check); il caso (regole/caso.ts); il
// collegamento stato/partita.ts usa le regole con lo stato condiviso G.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { G } from '../src/stato/condivise.ts';
import { buildDeck, deckSetupRow, deckShortfall } from '../src/stato/partita.ts';
import * as partita from '../src/stato/partita.ts';
import { shuffle, pickRandom } from '../src/regole/caso.ts';
import { isRecord } from '../src/regole/json.ts';
import { cards, deckSetup, nemeses, products, seeded, must } from './aiuto.ts';

const ROOT = join(import.meta.dirname, '..');
const TIERS = [1, 2, 3] as const;

describe('moduli di src/', () => {
  const files: string[] = [];
  (function walk(dir: string) {
    readdirSync(dir).forEach(f => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.ts$/.test(f) && f !== 'main.ts' && !p.includes(join('src', 'tipi'))) files.push(p);
    });
  })(join(ROOT, 'src'));
  const rel = (f: string) => relative(ROOT, f).split(sep).join('/');
  // Moduli avviati da main (elenco MODULI): devono esportare avvio()
  const mainCode = readFileSync(join(ROOT, 'src', 'main.ts'), 'utf8');
  const listed = new Set(must(/const MODULI(?:: [^=]+)? = \[([^\]]*)\]/.exec(mainCode), 'elenco MODULI in main.ts')[1].split(',').map(s => s.trim()));
  const started = new Set([...mainCode.matchAll(/import \* as (\w+) from '\.\/([^']+)'/g)].filter(m => listed.has(m[1])).map(m => 'src/' + m[2]));

  it('main avvia i moduli dell\'app (almeno 20)', () => {
    expect(started.size).toBeGreaterThan(20);
  });

  it('niente file .js in src/', () => {
    const js: string[] = [];
    (function walk(dir: string) {
      readdirSync(dir).forEach(f => { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js')) js.push(rel(p)); });
    })(join(ROOT, 'src'));
    expect(js).toEqual([]);
  });

  it.each(files.map(rel))('%s si importa senza DOM', async name => {
    const mod: unknown = await import('../' + name);
    if (!isRecord(mod)) throw new Error('modulo non caricato: ' + name);
    if (name.startsWith('src/regole/')) expect(mod.avvio, 'le regole non hanno codice di avvio').toBeUndefined();
    else if (started.has(name)) expect(typeof mod.avvio, 'avviato da main').toBe('function');
  });

  it('src/regole/ non nomina document, window, localStorage, G, Math.random, Date (fuori dai commenti)', () => {
    const regole = files.filter(f => rel(f).startsWith('src/regole/'));
    expect(regole.length).toBe(7);
    for (const f of regole) {
      const code = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const bad of [/\bdocument\b/, /\bwindow\b/, /\blocalStorage\b/, /\bG\./, /Math\.random/, /\bDate\b/, /from '\.\.\/(?!tipi\/)/]) {
        expect(bad.test(code), `${rel(f)}: ${bad}`).toBe(false);
      }
      // Intestazione: cosa contiene, cosa riceve, da chi è usato
      const head = readFileSync(f, 'utf8').split('\n').slice(0, 20).join('\n');
      expect(head, rel(f)).toMatch(/^\/\/ regole\//);
      expect(head, rel(f)).toMatch(/Ricev/);
      expect(head, rel(f)).toMatch(/Usato da/);
    }
  });

  it('ogni file di src/ ha l\'intestazione: cosa contiene, da chi dipende, chi lo usa', () => {
    const all = [...files, join(ROOT, 'src', 'main.ts')];
    for (const f of all) {
      const head = readFileSync(f, 'utf8').split('\n').slice(0, 12).join('\n');
      const name = rel(f).replace(/^src\//, '');
      expect(head.startsWith('// ' + name + ':'), rel(f) + ': prima riga "// <file>: cosa contiene"').toBe(true);
      expect(/Dipende da|Non dipende da niente/.test(head), rel(f) + ': da chi dipende').toBe(true);
      expect(/Usato da/.test(head), rel(f) + ': chi lo usa').toBe(true);
    }
  });
});

describe('caso (regole/caso.ts)', () => {
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

describe('stato/partita.ts: regole con lo stato della partita (dati veri)', () => {
  beforeAll(() => {
    G.allCards = cards;
    G.nemeses = nemeses;
    G.deckSetup = deckSetup;
    G.products = products;
    G.collection = new Set(Object.keys(G.products));
  });

  it('mazzo per le scelte della partita: righe di deck-setup.json, plan e ordine dei Tier', () => {
    for (const players of [2, 3, 4]) {
      G.settings = { players, nemesis: 'Maggoth', battleMode: true, mergeCollection: true };
      const row = must(deckSetupRow(), 'riga del Deck Setup');
      const deck = buildDeck();
      for (const t of TIERS) {
        const count = (kind: string) => must(partita.deckPlan.find(p => p.tier === t && p.kind === kind), 'piano').count;
        expect(count('basic')).toBe(row.basic[t]);
        expect(count('upgraded')).toBe(row.upgradedBasic[t]);
      }
      expect(deckShortfall()).toBe(null);
      expect(deck.length).toBe(partita.deckPlan.reduce((s, p) => s + p.count, 0));
      const tiers = deck.map(c => c.tier);
      expect(tiers).toEqual([...tiers].sort((a, b) => Number(b) - Number(a)));
    }
  });
});
