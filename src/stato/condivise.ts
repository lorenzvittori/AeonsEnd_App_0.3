// stato/condivise.ts: G, le variabili condivise tra moduli (provvisorio fino alla fase D, stato unico).
// Un modulo ES non può riassegnare un nome importato: le variabili assegnate da parti diverse del codice sono campi di G
// (G.queue, G.settings, ...). I valori veri si scrivono nelle avvio() dei moduli (stato/stato.ts per quasi tutti),
// nello stesso ordine di sempre; quelli qui sotto servono solo finché le avvio() non sono partite (test, prove).
// Dipende da: tipi/. Usato da: quasi tutti i moduli fuori da regole/ (le regole ricevono G come argomento).

import type { ArteNemesiTutte, Carta, CodiceProdotto, DeckSetup, Nemesi, Prodotti } from '../tipi/dati.ts';
import type { CartaTurno, Impostazioni, Partita } from '../tipi/partita.ts';
import type { FotografiaLetta } from '../tipi/salvataggio.ts';
import { newTurnOrder } from '../regole/mazzo-turni.ts';
import { emptyStats } from '../regole/turno-nemesi.ts';

// Partita della Modalità test in corso (save() non scrive niente finché c'è)
export interface ProvaInCorso {
  prevSettings: Impostazioni;    // scelte della partita vera, rimesse all'uscita dal test
  id?: string;                   // id dello scenario
  name?: string;                 // nome dello scenario
  pairs?: boolean | null;        // carte 1/2 e 3/4 solo per lo scenario (null: come le preferenze)
  turnCards?: CartaTurno[] | null; // carte del mazzo dei turni solo per lo scenario (null: quelle normali)
}

// Scelte possibili della pagina Nuova partita
export interface OpzioniInizio {
  players: number[];             // numeri di giocatori di deck-setup.json
  waves: string[];               // wave possedute
}

// Cursore del mazzo in fondo allo schermo durante "Crea mazzo" (ui/schermate/crea-mazzo.ts, buildDeckSlider)
export interface CursoreMazzo {
  box: HTMLElement;              // elemento del cursore
  lock(on: boolean): void;       // blocca o sblocca il trascinamento
  setProgress(p: number, instant?: boolean): void; // posizione 0-1
}

// Le variabili condivise
export interface Condivise extends Partita {
  allCards: Carta[];             // cards.json (con la miniatura)
  cardsById: Map<string, Carta>; // carte per id
  deckSetup: DeckSetup | null;   // deck-setup.json (null finché non è caricato)
  nemeses: Nemesi[];             // nemesis.json
  products: Prodotti;            // products.json
  nemesisArt: ArteNemesiTutte;   // immagini delle nemesi (vuoto se il file manca)
  collection: Set<CodiceProdotto> | null; // collezione (prodotti posseduti); null finché non è letta
  settings: Impostazioni;        // scelte della partita
  startOptions: OpzioniInizio | null; // scelte possibili della pagina Nuova partita
  nextUid: number;               // prossimo uid per una carta in gioco
  undoStack: FotografiaLetta[];  // passi di undo (fotografie prima di ogni azione)
  testRun: ProvaInCorso | null;  // Modalità test in corso
  cancelDraftsBtn: HTMLButtonElement | null; // "Annulla modifiche" del turno giocatori
  deckSlider?: CursoreMazzo | null; // cursore di "Crea mazzo" (manca finché non è creato)
  focusSignature?: string;       // firma del carosello del turno nemesi (manca finché non è disegnato)
  victoryKey?: string;           // partita per cui la Vittoria a mazzo vuoto è già mostrata (manca all'inizio)
  noSave?: boolean;              // pagina scheletri/: true = niente salvataggio
}

export const G: Condivise = {
  queue: [], deck: [], discard: [], turn: 0, resolving: false, currentIndex: 0, newIndex: -1, maxTierDrawn: 0,
  graveLife: 30, nemesisLife: 0, stats: emptyStats(0), turnOrder: newTurnOrder(),
  allCards: [], cardsById: new Map(), deckSetup: null, nemeses: [], products: {}, nemesisArt: {}, collection: null,
  settings: { players: 2, nemesis: null }, startOptions: null, nextUid: 1, undoStack: [], testRun: null, cancelDraftsBtn: null
};
