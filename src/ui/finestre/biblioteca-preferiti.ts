// ui/finestre/biblioteca-preferiti.ts: le carte preferite della Biblioteca, in un solo posto. Ogni carta preferita è una
// chiave (regole/biblioteca.ts, chiaveCarta) salvata in localStorage; chi cambia una preferita avvisa chi ascolta, così
// tutte le stelle (griglia, carosello, zoom) si aggiornano subito. Il database delle carte non si tocca.
// Livello 4 (finestre). Dipende da: regole/biblioteca.ts (leggiPreferiti). Usato da: ui/finestre/biblioteca.ts,
// ui/finestre/biblioteca-stella.ts, ui/finestre/biblioteca-zoom.ts.

import { leggiPreferiti } from '../../regole/biblioteca.ts';

const CHIAVE_PREFERITI = 'aeonsend-app-0.2-library-favorites';

// Letto una volta (poi resta in memoria); se il browser nega lo storage, le preferite valgono per questa apertura
let insieme: Set<string> | null = null;
const ascoltatori = new Set<() => void>();

function leggi(): Set<string> {
  if (insieme === null) {
    let testo: string | null = null;
    try {
      testo = localStorage.getItem(CHIAVE_PREFERITI);
    } catch {
      // Storage negato: nessuna preferita salvata
    }
    insieme = new Set(leggiPreferiti(testo));
  }
  return insieme;
}

export function preferita(chiave: string): boolean {
  return leggi().has(chiave);
}

export function preferite(): ReadonlySet<string> {
  return leggi();
}

// Aggiunge o toglie la carta dalle preferite (senza conferma), salva e avvisa tutti
export function alternaPreferita(chiave: string): void {
  const insiemeAttuale = leggi();
  if (insiemeAttuale.has(chiave)) insiemeAttuale.delete(chiave);
  else insiemeAttuale.add(chiave);
  try {
    localStorage.setItem(CHIAVE_PREFERITI, JSON.stringify([...insiemeAttuale]));
  } catch {
    // Senza storage la scelta vale per questa apertura soltanto
  }
  for (const avvisa of [...ascoltatori]) avvisa();
}

// Chi ascolta riceve un avviso a ogni cambio; la funzione restituita smette di ascoltare
export function ascoltaPreferite(avvisa: () => void): () => void {
  ascoltatori.add(avvisa);
  return () => { ascoltatori.delete(avvisa); };
}
