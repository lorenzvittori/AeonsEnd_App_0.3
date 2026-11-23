// dati/dati.ts: lettura dei file JSON, caso del browser (shuffle) e battaglia della nemesi.
// Dipende da: regole/ (caso, mazzo-nemesi), stato/catalogo.ts. Usato da: avvio.ts, ui/.

import * as Caso from '../regole/caso.ts';
import * as Mazzo from '../regole/mazzo-nemesi.ts';
import { catalogo } from '../stato/catalogo.ts';

// Un file JSON di public/ (senza cache del browser). Il contenuto è `unknown`: lo controlla chi lo usa
// (dati/controllo.ts per i dati delle carte)
export async function loadJson(path: string): Promise<unknown> {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Impossibile leggere ' + path + ' (' + res.status + ')');
  const data: unknown = await res.json();
  return data;
}

// Copia mescolata con il caso del browser (regole/caso.ts)
export function shuffle<T>(cards: readonly T[]): T[] {
  return Caso.shuffle(cards, Math.random);
}

// n carte a caso dalla lista
export function pickRandom<T>(cards: readonly T[], n: number): T[] {
  return Caso.pickRandom(cards, n, Math.random);
}

// La battaglia dipende dal boss scelto (colonna Expedition Battle di nemesis.json)
export function battleOf(nemesisName: string | null): number | null {
  return Mazzo.battleOf({ nemeses: catalogo.nemeses }, nemesisName);
}

// Al caricamento non c'è niente da fare (main.ts chiama avvio() di ogni modulo)
export function avvio(): void {
}
