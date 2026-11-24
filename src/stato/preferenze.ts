// stato/preferenze.ts: le preferenze, cioè quello che sopravvive tra una partita e l'altra: la collezione (prodotti
// posseduti), le scelte della partita (giocatori, nemesi, opzioni del mazzo) e le opzioni ricordate nel browser
// ("Modalità battaglia", "Unisci", carte turno 1/2 e 3/4).
// Le scelte (settings) entrano anche nel salvataggio della partita; la Modalità test le sostituisce finché dura e le
// rimette all'uscita (stato/partita.ts). La collezione si legge e si scrive nel browser in dati/collezione.ts.
// Livello 1 (stato/). Dipende da: tipi/. Usato da: stato/ (partita, salvataggio), dati/, ui/.

import type { CodiceProdotto } from '../tipi/dati.ts';
import type { Impostazioni } from '../tipi/partita.ts';

export interface Preferenze {
  collection: Set<CodiceProdotto> | null; // collezione (prodotti posseduti); null finché non è letta
  settings: Impostazioni;        // scelte della partita
}

// Valori di prima della lettura: la collezione si legge con la pagina iniziale (dati/collezione.ts, loadCollection) e
// le scelte si scrivono con lei (ui/schermate/menu.ts, buildStartPage)
export const preferenze: Preferenze = { collection: null, settings: { players: 2, nemesis: null, includeUpgraded: true } };

// Opzioni del mazzo ("Modalità battaglia", "Unisci le carte della collezione"): preferenza del browser, ricordata tra
// le partite e copiata nelle scelte della partita (settings). Mancanti = attive
export const DECK_OPTIONS_KEY = 'aeonsend-app-0.2-deck-options';

export function loadDeckOptions(): { battleMode: boolean; mergeCollection: boolean } {
  let saved: unknown = null;
  try { saved = JSON.parse(localStorage.getItem(DECK_OPTIONS_KEY) || 'null'); } catch (err) { /* predefinite */ }
  const off = (key: string) => typeof saved === 'object' && saved !== null && key in saved && Reflect.get(saved, key) === false;
  return { battleMode: !off('battleMode'), mergeCollection: !off('mergeCollection') };
}

export function saveDeckOptions(): void {
  try {
    localStorage.setItem(DECK_OPTIONS_KEY, JSON.stringify({ battleMode: preferenze.settings.battleMode !== false, mergeCollection: preferenze.settings.mergeCollection !== false }));
  } catch (err) { console.warn(err); }
}

// Opzione "Carte turno 1/2 e 3/4" (preferenza del browser, vale dal prossimo giro). Lo scenario della Modalità test può
// sceglierla solo per sé (testRun.pairs): quella in vigore la dice turnPairsOn di stato/partita.ts
export const TURN_PAIRS_KEY = 'aeonsend-app-0.2-turn-pairs';

export function turnPairsSaved(): boolean {
  try { return localStorage.getItem(TURN_PAIRS_KEY) !== 'off'; } catch (err) { return true; }
}

export function setTurnPairs(on: boolean): void {
  try { localStorage.setItem(TURN_PAIRS_KEY, on ? 'on' : 'off'); } catch (err) { console.warn(err); }
}
