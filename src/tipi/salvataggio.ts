// tipi/salvataggio.ts: il formato del salvataggio nel browser e dell'undo (fotografia della partita), quello scritto
// oggi e quello che si legge, cioè anche i formati vecchi con i campi mancanti; lo stato completo della partita in
// corso con uid, undo (fotografie) e Modalità test (StatoPartita).
// Livello 0 (tipi/). Dipende da: tipi/partita.ts. Usato da: regole/salvataggio.ts, regole/mazzo-turni.ts, stato/
// (partita, salvataggio), ui/.

import type { CartaTurno, Impostazioni, MemoriaCoppie, Partita, ProvaInCorso, SceltaCoppia, Statistiche,
  TurnoStoria } from './partita.ts';

// --- Formato scritto oggi ---

// Una carta in gioco nella fotografia (la carta come id, niente uid)
export interface VoceFotografia {
  id: string;                    // id della carta di cards_nemesis.json
  tokens: number | null;         // token del potere
  hp: number | null;             // vita del minion
  turnHp: number | null;         // vita a inizio turno giocatori
  isNew: boolean;                // carta appena pescata
  paid: boolean;                 // potere pagato
  bornTurn: number;              // turno nemesi di entrata
  hpSet?: boolean;               // solo minion a vita variabile: vita impostata
  hpMax?: number | null;         // solo minion a vita variabile: vita massima (null se non impostata)
}

// Mazzo dei turni nella fotografia
export interface MazzoTurniFotografia {
  left: CartaTurno[];            // mazzo dalla cima
  drawn: CartaTurno[];           // scarti dei turni
  round: number;                 // giri cominciati
  wild: number | null;           // giocatore wild (3 giocatori)
  picks: Record<number, SceltaCoppia>; // giocatori delle carte 1/2 e 3/4
  pairNext: MemoriaCoppie;       // memoria delle coppie
  history: TurnoStoria[];        // turni del giro
  known: boolean[];              // carte note del mazzo
  waiting: boolean;              // turno annullato in attesa (salvataggi vecchi)
}

// Fotografia della partita (stato del salvataggio e ogni passo di undo)
export interface Fotografia {
  turn: number;                  // turni nemesi giocati
  deck: string[];                // mazzo nemesi (id, si pesca dalla fine)
  discard: string[];             // scarti nemesi (id)
  queue: VoceFotografia[];       // carte in gioco
  resolving: boolean;            // turno nemesi in corso
  currentIndex: number;          // carta da risolvere
  newIndex: number;              // carta appena pescata (-1 = nessuna)
  maxTierDrawn: number;          // Tier più alto pescato
  graveLife: number;             // vita di Gravehold
  nemesisLife: number;           // vita della nemesi
  stats: Statistiche;            // statistiche
  turnOrder: MazzoTurniFotografia; // mazzo dei turni
}

// Salvataggio nel browser (localStorage, chiave SAVE_KEY)
export interface Salvataggio {
  version: number;               // versione del formato (SAVE_VERSION; un'altra versione si cancella)
  settings: Impostazioni;        // scelte della partita
  state: Fotografia;             // partita
  undo: FotografiaLetta[];       // passi di undo (dal più vecchio; dopo una ripresa anche quelli letti)
}

// --- Formati letti (anche vecchi) ---

// Carta in gioco letta: i campi aggiunti negli anni possono mancare
export interface VoceLetta {
  id: string;                    // id della carta
  tokens: number | null;         // token del potere
  hp: number | null;             // vita del minion
  turnHp?: number | null;        // mancante: uguale a hp
  isNew?: boolean;               // mancante: false
  paid?: boolean;                // mancante: false
  bornTurn?: number;             // mancante: il turno della fotografia
  hpSet?: boolean;               // mancante: false
  hpMax?: number | null;         // mancante: ricostruita da hp e turnHp
}

// Statistiche lette: possono mancare del tutto o in parte
export type StatisticheLette = Partial<Statistiche>;

// Mazzo dei turni letto: possono mancare i campi più recenti; picks a stringhe nei salvataggi vecchi
export interface MazzoTurniLetto {
  left?: CartaTurno[];           // mazzo
  drawn?: CartaTurno[];          // scarti dei turni
  round?: number;                // mancante: dai turni nemesi
  wild?: number | null;          // mancante con 3 giocatori: a caso
  picks?: Record<number, SceltaCoppia | string>; // stringa = giocatore scelto (formato vecchio)
  pairNext?: Partial<MemoriaCoppie>; // mancante: ricostruita dagli scarti
  history?: Partial<TurnoStoria>[];  // mancante: un turno per carta negli scarti
  known?: boolean[];             // mancante: nessuna carta nota
  waiting?: boolean;             // turno annullato in attesa della carta turno (solo salvataggi vecchi)
}

// Fotografia letta (salvataggio o undo, anche di formati vecchi)
export interface FotografiaLetta {
  turn: number;                  // turni nemesi giocati
  deck: string[];                // mazzo nemesi
  discard: string[];             // scarti nemesi
  queue: VoceLetta[];            // carte in gioco
  resolving: boolean;            // turno nemesi in corso
  currentIndex: number;          // carta da risolvere
  newIndex: number;              // carta appena pescata
  maxTierDrawn?: number;         // mancante: dal Tier più alto tra coda e scarti
  graveLife?: number;            // mancante: 30
  nemesisLife?: number;          // mancante: vita iniziale della nemesi
  stats?: StatisticheLette;      // mancante: da zero
  turnOrder?: MazzoTurniLetto;   // mancante: giro nuovo
}

// Salvataggio letto dal browser, prima del controllo (checkSave)
export interface SalvataggioLetto {
  version?: number;              // versione del formato
  settings?: Impostazioni;       // scelte della partita
  state?: FotografiaLetta;       // partita
  undo?: FotografiaLetta[];      // passi di undo
}

// Salvataggio che si può riprendere (dopo checkSave)
export interface SalvataggioValido {
  version: number;               // versione del formato
  settings: Impostazioni;        // scelte della partita
  state: FotografiaLetta;        // partita
  undo?: FotografiaLetta[];      // passi di undo
}

// Lo stato della partita in corso (stato/partita.ts): i campi di gioco più quello che serve a salvarli e annullarli
export interface StatoPartita extends Partita {
  nextUid: number;               // prossimo uid per una carta in gioco (continua tra le partite: un uid non torna mai)
  undoStack: FotografiaLetta[];  // passi di undo (fotografie prima di ogni azione, dal più vecchio)
  testRun: ProvaInCorso | null;  // Modalità test in corso
}
