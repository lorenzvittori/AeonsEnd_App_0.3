// tipi/partita.ts: i tipi della partita in corso: carte in gioco, mazzo dei turni, statistiche, scelte della partita,
// la partita intera (Partita: i campi di gioco) e la Modalità test in corso (ProvaInCorso). Lo stato completo con uid e
// undo (StatoPartita) è in tipi/salvataggio.ts, perché l'undo è fatto di fotografie.
// Livello 0 (tipi/). Dipende da: tipi/dati.ts. Usato da: regole/, stato/, ui/, tipi/salvataggio.ts.

import type { Carta } from './dati.ts';

// --- Carte in gioco ---

// Una carta in gioco nella coda ("voce"): la carta di cards.json più il suo stato nella partita
export interface VoceInGioco {
  uid: number;                   // identificativo stabile della carta in gioco (anche con due copie della stessa carta)
  data: Carta;                   // la carta di cards.json
  tokens: number | null;         // token rimasti del potere (null per le altre carte)
  hp: number | null;             // vita attuale del minion (null per le altre carte; 0 = "?" per la vita variabile)
  turnHp: number | null;         // vita a inizio del turno giocatori: tetto del +1 (null: vita variabile non impostata)
  isNew: boolean;                // carta appena pescata, non ancora messa in gioco
  paid: boolean;                 // potere scartato pagando il costo in Æ (esce al prossimo turno nemesi)
  bornTurn: number;              // turno nemesi in cui la carta è entrata in gioco
  hpSet?: boolean;               // solo minion a vita variabile: vita già impostata dai giocatori
  hpMax?: number;                // solo minion a vita variabile: vita impostata la prima volta (tetto del +1)
}

// Modifica non ancora salvata di una carta nel turno giocatori ("Salva modifiche")
export interface BozzaCarta {
  hp?: number;                   // nuova vita del minion
  paid?: boolean;                // potere da scartare pagando
}

// --- Mazzo dei turni ---

// Un giocatore
export type Giocatore = 'p1' | 'p2' | 'p3' | 'p4';

// Carte con due giocatori possibili (4 giocatori, opzione "Carte turno 1/2 e 3/4")
export type CartaCoppia = 'p12' | 'p34';

// Una carta del mazzo dei turni: un giocatore, il wild (3 giocatori), una carta 1/2 o 3/4, la nemesi
export type CartaTurno = Giocatore | 'wild' | CartaCoppia | 'nemesis';

// Chi ha giocato una carta 1/2 o 3/4
export interface SceltaCoppia {
  player: Giocatore;             // il giocatore
  forced: boolean;               // obbligata dalla memoria delle coppie (true) o scelta (false)
}

// Memoria delle coppie: a chi tocca la prossima carta 1/2 e 3/4 (null = si sceglie)
export interface MemoriaCoppie {
  p12: Giocatore | null;         // 'p1' o 'p2'
  p34: Giocatore | null;         // 'p3' o 'p4'
}

// Un turno della storia del giro
export interface TurnoStoria {
  kind: CartaTurno;              // la carta pescata per il turno
  player: Giocatore | null;      // il giocatore di una carta 1/2 o 3/4 (null: nemesi, altre carte, o da scegliere)
  forced: boolean;               // giocatore obbligato dalla memoria delle coppie
  pos: number | null;            // posizione della carta negli scarti dei turni (null: non è più negli scarti)
}

// Scelte delle carte 1/2 e 3/4: posizione negli scarti dei turni -> giocatore
export type SceltePerPosizione = Record<number, SceltaCoppia>;

// Il mazzo dei turni della partita
export interface MazzoTurni {
  left: CartaTurno[];            // carte del mazzo, left[0] = la carta in cima
  known: boolean[];              // carte note (scoperte), parallelo a left
  drawn: CartaTurno[];           // scarti dei turni, nell'ordine in cui sono usciti
  round: number;                 // giri cominciati ("Turno N" della testata)
  wild?: number | null;          // giocatore (1-3) che è wild nel giro con 3 giocatori, altrimenti null
  picks: SceltePerPosizione;     // giocatori delle carte 1/2 e 3/4 negli scarti
  pairNext: MemoriaCoppie;       // memoria delle coppie
  history: TurnoStoria[];        // turni del giro (l'ultimo è il turno in corso)
  waiting: boolean;              // turno annullato in attesa della carta turno (solo salvataggi vecchi)
}

// Bozza della finestra del mazzo dei turni: copia modificabile del mazzo dei turni
export interface BozzaTurni {
  left: CartaTurno[];            // come MazzoTurni.left
  known: boolean[];              // come MazzoTurni.known
  drawn: CartaTurno[];           // come MazzoTurni.drawn
  picks: SceltePerPosizione;     // come MazzoTurni.picks
  waiting: boolean;              // come MazzoTurni.waiting
  pairNext: MemoriaCoppie;       // come MazzoTurni.pairNext
  history: TurnoStoria[];        // come MazzoTurni.history
  old?: boolean[];               // carte già note all'apertura della finestra (si spostano solo quando sono in cima)
}

// --- Statistiche ---

// Gruppi di carte uscite dal gioco contati nelle statistiche
export type GruppoStatistiche = 'minionsKilled' | 'powersPaid' | 'powersResolved' | 'attacksResolved';

// Un minion ucciso
export interface MinionUcciso {
  id: string;                    // id della carta
  name: string;                  // nome della carta
  turns: number;                 // turni nemesi passati in gioco
}

// Statistiche di un mago (giocatore)
export interface StatisticheMago {
  damage: number;                // danni fatti ai minion
  powers: number;                // poteri scartati pagando
  kills: number;                 // minion uccisi
}

// Statistiche della partita (finestra Statistiche della Vittoria)
export interface Statistiche {
  deckSize: number;              // carte nel mazzo nemesi a inizio partita
  minionsKilled: number;         // minion uccisi
  powersPaid: number;            // poteri scartati pagando Æ
  powersResolved: number;        // poteri risolti (all'ultimo token)
  aetherSpent: number;           // Æ spesi per scartare poteri
  attacksResolved: number;       // attacchi risolti
  minions: MinionUcciso[];       // minion uccisi, in ordine
  mages: Partial<Record<Giocatore, StatisticheMago>>; // statistiche per giocatore
  cards: Record<GruppoStatistiche, string[]>;          // id delle carte di ogni gruppo
  startedAt: number | null;      // istante di inizio partita (ms)
  tierAt: Record<number, number>;// istante della prima carta del Tier 2 e 3 (ms)
  endedAt: number | null;        // istante della fine della partita (ms)
}

// --- Scelte della partita ---

// Le scelte della partita (pagina Nuova partita)
export interface Impostazioni {
  players: number;               // numero di giocatori (1-4)
  nemesis: string | null;        // nome della nemesi (null: nessuna giocabile)
  battleMode?: boolean;          // "Modalità battaglia" (mancante = accesa)
  mergeCollection?: boolean;     // "Unisci le carte della collezione" (mancante = acceso)
}

// Le scelte che contano per il mazzo nemesi
export interface SceltePerMazzo {
  players: number;               // numero di giocatori
  nemesis: string | null;        // nome della nemesi
  battleMode?: boolean;          // "Modalità battaglia" (mancante = accesa)
  mergeCollection?: boolean;     // "Unisci" (mancante = acceso)
}

// Un mazzo per ognuno dei 9 mazzi di "Crea mazzo": quante carte vengono da quel Tier e quella categoria
export interface PianoMazzo {
  tier: 1 | 2 | 3;               // Tier
  kind: 'basic' | 'upgraded' | 'specific'; // categoria (in minuscolo, come le classi CSS)
  count: number;                 // carte prese
}

// Vita di Gravehold ('grave') o della nemesi ('nemesis')
export type TipoVita = 'grave' | 'nemesis';

// --- La partita ---

// I campi di gioco della partita (quelli che le regole leggono e scrivono)
export interface Partita {
  queue: VoceInGioco[];          // carte in gioco, dalla più vecchia
  deck: Carta[];                 // mazzo nemesi (si pesca dalla fine)
  discard: Carta[];              // scarti nemesi
  turn: number;                  // turni nemesi giocati
  resolving: boolean;            // turno nemesi in corso (VistaRisoluzione)
  currentIndex: number;          // posizione in coda della carta da risolvere
  newIndex: number;              // posizione della carta appena pescata (-1 = nessuna)
  maxTierDrawn: number;          // Tier più alto pescato finora
  graveLife: number;             // vita di Gravehold
  nemesisLife: number;           // vita della nemesi
  stats: Statistiche;            // statistiche
  turnOrder: MazzoTurni;         // mazzo dei turni
}

// Partita della Modalità test in corso (il salvataggio non scrive niente finché c'è)
export interface ProvaInCorso {
  prevSettings: Impostazioni;    // scelte della partita vera, rimesse all'uscita dal test
  id?: string;                   // id dello scenario
  name?: string;                 // nome dello scenario
  pairs?: boolean | null;        // carte 1/2 e 3/4 solo per lo scenario (null: come le preferenze)
  turnCards?: CartaTurno[] | null; // carte del mazzo dei turni solo per lo scenario (null: quelle normali)
}

