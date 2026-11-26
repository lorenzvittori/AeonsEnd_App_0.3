// stato/catalogo.ts: il catalogo, cioè i dati letti all'avvio (carte, nemesi, prodotti, Deck Setup, immagini delle
// nemesi) e le scelte possibili della pagina Nuova partita che ne derivano. Dopo l'avvio si legge soltanto: il resto
// dell'app vede `catalogo` in sola lettura; lo scrivono solo caricaCatalogo (avvio.ts) e impostaSceltePagina (menu).
// Non entra nel salvataggio né nell'undo.
// Dipende da: tipi/dati.ts. Usato da: stato/, dati/, ui/, avvio.ts, test.

import type { ArteNemesiTutte, Carta, DeckSetup, Nemesi, Prodotti } from '../tipi/dati.ts';

// Scelte possibili della pagina Nuova partita
export interface OpzioniInizio {
  players: number[];             // numeri di giocatori di deck-setup.json
  waves: string[];               // wave possedute (si aggiornano quando cambia la collezione)
}

// I dati letti all'avvio
export interface Catalogo {
  allCards: Carta[];             // cards_nemesis.json (con la miniatura)
  cardsById: Map<string, Carta>; // carte per id
  deckSetup: DeckSetup | null;   // deck-setup.json (null finché non è caricato)
  nemeses: Nemesi[];             // nemesis.json
  products: Prodotti;            // products.json
  nemesisArt: ArteNemesiTutte;   // immagini delle nemesi (vuoto se il file manca)
  startOptions: OpzioniInizio | null; // scelte possibili della pagina Nuova partita (null finché non c'è la pagina)
}

const dati: Catalogo = {
  allCards: [], cardsById: new Map(), deckSetup: null, nemeses: [], products: {}, nemesisArt: {}, startOptions: null
};

// Il catalogo, in sola lettura
export const catalogo: Readonly<Catalogo> = dati;

// Dati letti e controllati all'avvio (avvio.ts; nei test i JSON veri di public/)
export function caricaCatalogo(letti: { cards: Carta[]; deckSetup: DeckSetup; nemeses: Nemesi[]; products: Prodotti; nemesisArt: ArteNemesiTutte }): void {
  dati.nemesisArt = letti.nemesisArt;
  dati.products = letti.products;
  dati.allCards = letti.cards;
  dati.deckSetup = letti.deckSetup;
  dati.nemeses = letti.nemeses;
  dati.cardsById = new Map(letti.cards.map(c => [c.id, c]));
}

// Scelte possibili della pagina Nuova partita (ui/schermate/menu.ts, alla costruzione della pagina)
export function impostaSceltePagina(options: OpzioniInizio): void {
  dati.startOptions = options;
}
