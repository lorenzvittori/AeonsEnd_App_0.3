// dati/collezione.js: Collezione: wave e prodotti posseduti (salvata nel browser).
// Fase A del passaggio a Vite: codice spostato da script.js così com'era. Al caricamento il modulo dichiara solo
// funzioni e costanti; il codice che prima girava al caricamento è in avvio(), chiamata da main.js nell'ordine di prima.

import { G } from '../stato/condivise.js';
import { I18N_IT } from '../ui/testi.js';

// --- Collezione: wave possedute e, per ogni wave, scatola base e mini espansioni (scelte nella schermata "La mia
// collezione", salvate nel browser). Un prodotto ha per id il suo codice di products.json: "4" = scatola base della
// wave 4, "4.1" = Shattered Dreams... (v210; prima "<wave>|base" / "<wave>|<mini espansione>", convertiti all'avvio).
// Le nemesi e le carte Basic / Upgraded si usano solo se il loro prodotto (boxCode) è nella collezione.
export const COLLECTION_KEY = 'aeonsend-app-0.2-collection';

// Set di codici prodotto

// Wave di un codice prodotto: la parte prima del punto ("4.1" -> "4")
export function waveOfCode(code) {
  return code === null || code === undefined ? null : String(code).split('.')[0];
}

export function isMiniCode(code) {
  return code !== null && code !== undefined && String(code).includes('.');
}

export function productName(code) {
  return G.products[code] || String(code);
}

export function waveOfNemesis(info) {
  return waveOfCode(info.boxCode);
}

export function productOfNemesis(info) {
  return info.boxCode;
}

// Tutti i prodotti per wave, nell'ordine delle wave: [{ wave, products: [{ id, name, isBase }] }]
export function collectionCatalog() {
  const codes = Object.keys(G.products);
  const waves = codes.filter(c => !isMiniCode(c)).sort((a, b) => Number(a) - Number(b));
  return waves.map(wave => ({
    wave,
    products: [{ id: wave, name: I18N_IT.baseBox, isBase: true },
      ...codes.filter(c => isMiniCode(c) && waveOfCode(c) === wave).sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1]))
        .map(c => ({ id: c, name: productName(c), isBase: false }))]
  }));
}

// Chiave della collezione salvata prima della v210 ("4 - The New Age|Shattered Dreams") -> codice ("4.1"); null se
// non si trova. Le chiavi già nuove restano come sono.
export function convertCollectionKey(id) {
  id = String(id);
  if (!id.includes('|')) return Object.prototype.hasOwnProperty.call(G.products, id) ? id : null;
  const [wavePart, name] = id.split('|');
  const m = /^(\d+)/.exec(wavePart.trim());
  if (!m) return null;
  const wave = m[1];
  if (name === 'base') return Object.prototype.hasOwnProperty.call(G.products, wave) ? wave : null;
  return Object.keys(G.products).find(c => waveOfCode(c) === wave && G.products[c] === name) || null;
}

// Per ora (v199) nella collezione si possono scegliere solo la wave 1 e la wave 4, con le loro mini espansioni; le
// altre wave si vedono ma sono disattivate e non restano nella collezione
export const COLLECTION_WAVES = [1, 4];

export function collectionWaveEnabled(wave) {
  return COLLECTION_WAVES.includes(parseInt(String(wave), 10));
}

export function loadCollection() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLLECTION_KEY));
    if (Array.isArray(saved)) {
      // Chiavi di prima della v210 convertite nei codici prodotto e risalvate (la collezione non si perde)
      const converted = saved.map(convertCollectionKey).filter(Boolean);
      G.collection = new Set(converted.filter(id => collectionWaveEnabled(waveOfCode(id))));
      if (saved.some(id => String(id).includes('|'))) saveCollection();
      return;
    }
  } catch (err) { /* collezione illeggibile: si riparte da quella predefinita */ }
  // Nuovi utenti (v194): collezione vuota; nel menu iniziale compare "Inserisci collezione"
  G.collection = new Set();
}

export function saveCollection() {
  try { localStorage.setItem(COLLECTION_KEY, JSON.stringify([...G.collection])); } catch (err) { console.warn(err); }
}

export function ownsProduct(id) {
  return !G.collection || G.collection.has(id);
}

// Carta Basic / Upgraded ammessa: il suo prodotto (boxCode) è nella collezione (o non si sa di che prodotto è)
export function cardAllowed(card) {
  return !card.boxCode || ownsProduct(card.boxCode);
}

// (v210-v213: le nemesi con un minion a vita variabile nel mazzo non si potevano giocare; dalla v214 sì: il minion entra
// in gioco con la vita "?" e la si imposta nella finestra della vita, vedi makeEntry / hpUnset)

// Un boss si può scegliere solo se ha un prodotto e una battaglia, le sue carte sono nel progetto e il suo prodotto è
// nella collezione
export function isPlayable(info) {
  return !!info.boxCode && info.battle !== null && ownsProduct(productOfNemesis(info))
    && G.allCards.some(c => c.category === 'Specific' && c.nemesis === info.name);
}

// Codice eseguito all'avvio (prima: al caricamento di script.js), nell'ordine di prima
export function avvio() {
  G.collection = null;
}
