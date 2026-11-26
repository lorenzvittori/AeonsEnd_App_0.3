// Aiuti comuni ai test (npm test, Vitest): i dati veri di public/ (già controllati e tipizzati da
// src/dati/controllo.ts), un caso ripetibile e le collezioni.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { waveOfCode } from '../src/regole/mazzo-nemesi.ts';
import { checkCards, checkDeckSetup, checkNemeses, checkProducts } from '../src/dati/controllo.ts';
import { parseJson } from '../src/regole/json.ts';
import type { Carta, DatiRegole } from '../src/tipi/dati.ts';

const ROOT = join(import.meta.dirname, '..');

// Contenuto di un file JSON di public/, da controllare
export const readJson = (name: string): unknown => parseJson(readFileSync(join(ROOT, 'public', name), 'utf8'));

export const cards = checkCards(readJson('cards_nemesis.json')).value;
export const nemeses = checkNemeses(readJson('nemesis.json')).value;
export const deckSetup = checkDeckSetup(readJson('deck-setup.json'));
export const products = checkProducts(readJson('products.json')).value;
export const db: DatiRegole = { cards, nemeses, deckSetup };
export const cardsById = new Map(cards.map(c => [c.id, c]));

// Valore che nel test c'è di sicuro (carta trovata, riga del Deck Setup...): se manca il test fallisce con il motivo
export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error('manca: ' + what);
  return value;
}

// Caso ripetibile (mulberry32): stessa semente = stessa sequenza in [0, 1)
export function seeded(seed: number): () => number {
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
export const appWaves = new Set(Object.keys(products).filter(c => ['1', '4'].includes(String(waveOfCode(c)))));

export function cardByName(name: string): Carta {
  const found = cards.filter(c => c.name === name);
  if (found.length !== 1) throw new Error(`nome ${name}: ${found.length} carte`);
  return found[0];
}
