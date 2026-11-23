// dati/collezione.ts: collezione (wave e prodotti posseduti, salvata nel browser) e nemesi giocabili.
// Dipende da: regole/mazzo-nemesi.ts, stato/condivise.ts, ui/testi. Usato da: ui/schermate (menu, opzioni, collezione),
// stato/partita.ts (attraverso G.collection).

import * as Mazzo from '../regole/mazzo-nemesi.ts';
import { parseJson } from '../regole/json.ts';
import { G } from '../stato/condivise.ts';
import { I18N_IT } from '../ui/testi.ts';
import type { Carta, CodiceProdotto, Nemesi } from '../tipi/dati.ts';

// --- Collezione: wave possedute e, per ogni wave, scatola base e mini espansioni (scelte nella schermata "La mia
// collezione", salvate nel browser). Un prodotto ha per id il suo codice di products.json: "4" = scatola base della
// wave 4, "4.1" = Shattered Dreams... (le chiavi del formato vecchio "<wave>|base" / "<wave>|<mini espansione>" si
// convertono all'avvio). Le nemesi e le carte Basic / Upgraded si usano solo se il loro prodotto (boxCode) è nella
// collezione.
export const COLLECTION_KEY = 'aeonsend-app-0.2-collection';

// Un prodotto nel catalogo della schermata "La mia collezione"
export interface ProdottoCatalogo {
  id: CodiceProdotto;            // codice prodotto
  name: string;                  // nome mostrato
  isBase: boolean;               // scatola base della wave
}

// Wave di un codice prodotto: la parte prima del punto ("4.1" -> "4")
export function waveOfCode(code: CodiceProdotto | null | undefined): string | null {
  return Mazzo.waveOfCode(code);
}

export function isMiniCode(code: CodiceProdotto | null | undefined): boolean {
  return Mazzo.isMiniCode(code);
}

export function productName(code: CodiceProdotto): string {
  return G.products[code] || String(code);
}

export function waveOfNemesis(info: Nemesi): string | null {
  return waveOfCode(info.boxCode);
}

export function productOfNemesis(info: Nemesi): CodiceProdotto | null {
  return info.boxCode;
}

// Tutti i prodotti per wave, nell'ordine delle wave: [{ wave, products: [{ id, name, isBase }] }]
export function collectionCatalog(): { wave: string; products: ProdottoCatalogo[] }[] {
  const codes = Object.keys(G.products);
  const waves = codes.filter(c => !isMiniCode(c)).sort((a, b) => Number(a) - Number(b));
  return waves.map(wave => ({
    wave,
    products: [{ id: wave, name: I18N_IT.baseBox, isBase: true },
      ...codes.filter(c => isMiniCode(c) && waveOfCode(c) === wave).sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1]))
        .map(c => ({ id: c, name: productName(c), isBase: false }))]
  }));
}

// Chiave della collezione del formato vecchio ("4 - The New Age|Shattered Dreams") -> codice ("4.1"); null se non si
// trova. Le chiavi già nuove restano come sono.
export function convertCollectionKey(key: unknown): CodiceProdotto | null {
  const id = String(key);
  if (!id.includes('|')) return Object.prototype.hasOwnProperty.call(G.products, id) ? id : null;
  const [wavePart, name] = id.split('|');
  const m = /^(\d+)/.exec(wavePart.trim());
  if (!m) return null;
  const wave = m[1];
  if (name === 'base') return Object.prototype.hasOwnProperty.call(G.products, wave) ? wave : null;
  return Object.keys(G.products).find(c => waveOfCode(c) === wave && G.products[c] === name) || null;
}

// Per ora nella collezione si possono scegliere solo la wave 1 e la wave 4, con le loro mini espansioni; le altre wave
// si vedono ma sono disattivate e non restano nella collezione
export const COLLECTION_WAVES = [1, 4];

export function collectionWaveEnabled(wave: string | number | null): boolean {
  return COLLECTION_WAVES.includes(parseInt(String(wave), 10));
}

export function loadCollection(): void {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    const read = raw === null ? null : parseJson(raw);
    if (Array.isArray(read)) {
      const saved: unknown[] = read;
      // Chiavi del formato vecchio convertite nei codici prodotto e risalvate (la collezione non si perde)
      const converted = saved.map(convertCollectionKey).filter((id): id is CodiceProdotto => !!id);
      G.collection = new Set(converted.filter(id => collectionWaveEnabled(waveOfCode(id))));
      if (saved.some(id => String(id).includes('|'))) saveCollection();
      return;
    }
  } catch (err) { /* collezione illeggibile: si riparte da quella predefinita */ }
  // Nuovi utenti: collezione vuota; nel menu iniziale compare "Inserisci collezione"
  G.collection = new Set();
}

export function saveCollection(): void {
  try {
    // Collezione non ancora letta: niente da scrivere (errore in console, come sempre)
    if (!G.collection) throw new TypeError('collezione non ancora letta');
    localStorage.setItem(COLLECTION_KEY, JSON.stringify([...G.collection]));
  } catch (err) { console.warn(err); }
}

export function ownsProduct(id: CodiceProdotto): boolean {
  return Mazzo.ownsProduct(G.collection, id);
}

// Carta Basic / Upgraded ammessa: il suo prodotto (boxCode) è nella collezione (o non si sa di che prodotto è)
export function cardAllowed(card: { boxCode: CodiceProdotto | null }): boolean {
  return Mazzo.cardAllowed(G.collection, card);
}

// Un boss si può scegliere solo se ha un prodotto e una battaglia, le sue carte sono nel progetto e il suo prodotto è
// nella collezione. Un minion a vita variabile nel mazzo non lo impedisce: entra in gioco con la vita "?" e la si
// imposta nella finestra della vita (makeEntry / hpUnset)
export function isPlayable(info: Nemesi): boolean {
  return Mazzo.isPlayable({ cards: G.allCards }, G.collection, info);
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  G.collection = null;
}
