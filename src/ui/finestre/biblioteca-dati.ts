// ui/finestre/biblioteca-dati.ts: i dati della Biblioteca nel browser. Le carte supply (cards_supply.json) e le meccaniche
// (mechanics.json) si leggono alla prima apertura e restano in memoria; la categoria scelta si salva in localStorage.
// Il percorso di immagini e miniature è relativo alla radice del sito (come per le nemesi, avvio.ts).
// Livello 4 (finestre). Dipende da: dati/dati.ts (lettura), dati/controllo.ts (controllo), tipi/dati.ts,
// regole/biblioteca.ts (preferenze), ui/pagina.ts (radice dei dati). Usato da: ui/finestre/biblioteca.ts.

import { DATA_ROOT } from '../pagina.ts';
import { loadJson } from '../../dati/dati.ts';
import { checkMechanics, checkSupplyCards, reportProblems } from '../../dati/controllo.ts';
import type { CartaSupply, Meccanica } from '../../tipi/dati.ts';
import { leggiPreferenzeBiblioteca } from '../../regole/biblioteca.ts';
import type { PreferenzeBiblioteca } from '../../regole/biblioteca.ts';

// Preferenze della Biblioteca nel browser (la categoria; il vecchio campo dell'ordinamento si ignora)
const CHIAVE_PREFERENZE = 'aeonsend-app-0.2-library';

// Le carte supply, lette la prima volta che si apre la Biblioteca (poi restano in memoria)
let cartePronte: CartaSupply[] | null = null;
let caricamento: Promise<CartaSupply[]> | null = null;

// Le meccaniche (mechanics.json), lette insieme alle carte. Se mancano o sono rotte, il filtro non ha voci
let meccanichePronte: Meccanica[] | null = null;
let caricamentoMeccaniche: Promise<Meccanica[]> | null = null;

// Le carte già lette (null finché non lo sono)
export function carteLette(): CartaSupply[] | null {
  return cartePronte;
}

export function meccanicheLette(): Meccanica[] {
  return meccanichePronte ?? [];
}

export function caricaCarte(): Promise<CartaSupply[]> {
  if (cartePronte) return Promise.resolve(cartePronte);
  if (!caricamento) {
    caricamento = loadJson(DATA_ROOT + 'cards_supply.json').then(dati => {
      const controllate = checkSupplyCards(dati);
      reportProblems(controllate.problems);
      cartePronte = controllate.value.map(c => ({ ...c, image: DATA_ROOT + c.image, thumb: DATA_ROOT + c.thumb }));
      return cartePronte;
    }).catch((err: unknown) => {
      caricamento = null;
      throw err;
    });
  }
  return caricamento;
}

// Mai rifiuta: un errore si scrive in console e il filtro meccaniche resta senza voci (la prossima apertura riprova)
export function caricaMeccaniche(): Promise<Meccanica[]> {
  if (meccanichePronte) return Promise.resolve(meccanichePronte);
  if (!caricamentoMeccaniche) {
    caricamentoMeccaniche = loadJson(DATA_ROOT + 'mechanics.json').then(dati => {
      const controllate = checkMechanics(dati);
      reportProblems(controllate.problems);
      meccanichePronte = controllate.value;
      return meccanichePronte;
    }).catch((err: unknown) => {
      caricamentoMeccaniche = null;
      console.error('Meccaniche non caricate, il filtro non si mostra:', err);
      return [];
    });
  }
  return caricamentoMeccaniche;
}

export function leggiPreferenze(): PreferenzeBiblioteca {
  let testo: string | null = null;
  try {
    testo = localStorage.getItem(CHIAVE_PREFERENZE);
  } catch {
    // Il browser può negare lo storage: si usano le predefinite
  }
  return leggiPreferenzeBiblioteca(testo);
}

export function salvaPreferenze(preferenze: PreferenzeBiblioteca): void {
  try {
    localStorage.setItem(CHIAVE_PREFERENZE, JSON.stringify(preferenze));
  } catch {
    // Senza storage la scelta vale per questa apertura soltanto
  }
}
