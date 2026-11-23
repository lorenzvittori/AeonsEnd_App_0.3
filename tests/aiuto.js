// Aiuti comuni ai test delle regole (npm test, Vitest): i dati veri di public/, un caso ripetibile e le collezioni.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { waveOfCode } from '../src/regole/mazzo-nemesi.js';

const ROOT = join(import.meta.dirname, '..');
export const readJson = name => JSON.parse(readFileSync(join(ROOT, 'public', name), 'utf8'));

export const cards = readJson('cards.json');
export const nemeses = readJson('nemesis.json');
export const deckSetup = readJson('deck-setup.json');
export const products = readJson('products.json');
export const db = { cards, nemeses, deckSetup };
export const cardsById = new Map(cards.map(c => [c.id, c]));

// Caso ripetibile (mulberry32): stessa semente = stessa sequenza in [0, 1)
export function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Collezioni: tutti i prodotti; solo le wave sceglibili oggi nell'app (1 e 4)
export const allProducts = new Set(Object.keys(products));
export const appWaves = new Set(Object.keys(products).filter(c => ['1', '4'].includes(waveOfCode(c))));

export function cardByName(name) {
  const found = cards.filter(c => c.name === name);
  if (found.length !== 1) throw new Error(`nome ${name}: ${found.length} carte`);
  return found[0];
}
