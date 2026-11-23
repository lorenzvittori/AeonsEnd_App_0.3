// dati/dati.js: Caricamento dei file JSON, caso (shuffle) e battaglia della nemesi.
// Fase A del passaggio a Vite: codice spostato da script.js così com'era. Al caricamento il modulo dichiara solo
// funzioni e costanti; il codice che prima girava al caricamento è in avvio(), chiamata da main.js nell'ordine di prima.

import { G } from '../stato/condivise.js';
import * as Caso from '../regole/caso.js';
import * as Mazzo from '../regole/mazzo-nemesi.js';

export async function loadJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Impossibile leggere ' + path + ' (' + res.status + ')');
  return res.json();
}

// Copia mescolata con il caso del browser (regole/caso.js)
export function shuffle(cards) {
  return Caso.shuffle(cards, Math.random);
}

// n carte a caso dalla lista
export function pickRandom(cards, n) {
  return Caso.pickRandom(cards, n, Math.random);
}

// La battaglia dipende dal boss scelto (colonna Expedition Battle di nemesis.json)
export function battleOf(nemesisName) {
  return Mazzo.battleOf({ nemeses: G.nemeses }, nemesisName);
}

// Codice eseguito all'avvio (prima: al caricamento di script.js), nell'ordine di prima
export function avvio() {
}
