// stato/preferenze.ts: le preferenze, cioè quello che sopravvive tra una partita e l'altra: la collezione (prodotti
// posseduti), le scelte della partita (giocatori, nemesi, opzioni del mazzo) e le opzioni ricordate nel browser
// ("Modalità battaglia", "Unisci", carte turno 1/2 e 3/4) e la lingua dell'interfaccia.
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
export const preferenze: Preferenze = { collection: null, settings: { players: 2, nemesis: null } };

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

// Lingua dell'interfaccia: preferenza del browser. Senza scelta salvata vale la lingua del browser (it* = italiano, tutto
// il resto = inglese): lo stesso per chi ha un salvataggio di partita vecchio, che la lingua non la contiene. Cambiarla
// salva e ricarica l'app (ui/finestre/opzioni.ts): i testi si scelgono una volta sola, all'avvio (ui/testi.ts).
export type Lingua = 'it' | 'en';
export const LINGUE: readonly Lingua[] = ['it', 'en'];
export const LANGUAGE_KEY = 'aeonsend-app-0.2-language';

export function eLingua(valore: unknown): valore is Lingua {
  return valore === 'it' || valore === 'en';
}

// La lingua per le lingue preferite del browser (navigator.languages, o navigator.language): vale la prima
export function linguaDelBrowser(preferite: readonly string[] | string | null | undefined): Lingua {
  const prima = typeof preferite === 'string' ? preferite : (preferite && preferite[0]) || '';
  return /^it/i.test(prima) ? 'it' : 'en';
}

// La scelta salvata se c'è (e vale), altrimenti quella del browser
export function linguaScelta(salvata: unknown, browser: readonly string[] | string | null | undefined): Lingua {
  return eLingua(salvata) ? salvata : linguaDelBrowser(browser);
}

export function lingua(): Lingua {
  let salvata: string | null = null;
  // Senza finestra (i test in Node) non c'è niente da leggere: Node avvisa a ogni accesso a localStorage
  try { if (typeof window !== 'undefined') salvata = localStorage.getItem(LANGUAGE_KEY); } catch (err) { /* nessuna scelta salvata */ }
  let browser: readonly string[] | string | undefined;
  try { browser = navigator.languages && navigator.languages.length ? navigator.languages : navigator.language; } catch (err) { /* inglese */ }
  return linguaScelta(salvata, browser);
}

export function setLingua(scelta: Lingua): void {
  try { localStorage.setItem(LANGUAGE_KEY, scelta); } catch (err) { console.warn(err); }
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
