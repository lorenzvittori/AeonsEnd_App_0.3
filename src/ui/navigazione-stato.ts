// ui/navigazione-stato.ts: lo stato della navigazione, senza DOM: dove si è (schermataAttuale) e cosa chiude il tasto
// Indietro (cosaChiudeIndietro). Lo stato è solo quello che la partita non sa già: la pagina iniziale aperta e in quale
// modo (inizio); "Crea mazzo" (ui.deckBuilding) e il turno (partita.resolving) si leggono da dove stanno. File di
// supporto di navigazione.ts, che mostra e nasconde i blocchi della pagina di conseguenza; senza DOM si prova nei test.
// Livello 2 (ui/ base). Dipende da: stato/partita.ts (lettura), ui/pagina.ts (ui). Usato da: ui/navigazione.ts, ui/schermate/mazzo-turni.ts (impostaMazzoTurniAperto),
// tests/navigazione.test.ts.

import { partita } from '../stato/partita.ts';
import { ui } from './pagina.ts';

// Le schermate dell'app
export type Schermata = 'menu' | 'nuova-partita' | 'crea-mazzo' | 'turno-giocatori' | 'turno-nemesi' | 'mazzo-turni';

// Pagina iniziale (#start): aperta nel menu iniziale o nella pagina Nuova partita, oppure chiusa (null: si è nella
// partita)
export type Inizio = 'menu' | 'nuova-partita' | null;

// All'apertura dell'app la pagina iniziale è aperta (index.html la mostra) nel menu iniziale
let inizio: Inizio = 'menu';

export function paginaIniziale(): Inizio {
  return inizio;
}

// La pagina iniziale si apre (in un modo) o si chiude: lo chiama il coordinatore insieme al blocco #start
export function impostaInizio(modo: Inizio): void {
  inizio = modo;
}

// Il mazzo dei turni aperto (la schermata ui/schermate/mazzo-turni.ts lo segna all'apertura e alla chiusura)
let mazzoTurniAperto = false;

export function impostaMazzoTurniAperto(aperto: boolean): void {
  mazzoTurniAperto = aperto;
}

// La schermata in primo piano: la pagina iniziale se è aperta, il mazzo dei turni se è aperto, altrimenti "Crea mazzo"
// (prima del primo turno giocatori) o il turno in corso della partita
export function schermataAttuale(): Schermata {
  if (inizio !== null) return inizio;
  if (mazzoTurniAperto) return 'mazzo-turni';
  if (ui.deckBuilding) return 'crea-mazzo';
  return partita.resolving ? 'turno-nemesi' : 'turno-giocatori';
}

// I livelli aperti sopra la schermata, dal più alto: finestre (pila di ui/componenti/dialoghi.ts), Annulla sospeso,
// "Pesca carta" sotto il mazzo, schermate La mia collezione / Opzioni / Test, pila degli scarti
export interface Livelli {
  finestre: number;              // finestre aperte
  annullaSospeso: boolean;       // pulsante Annulla sospeso (dopo l'undo dal menu)
  pescaCarta: boolean;           // "Pesca carta" sotto il mazzo in alto
  schermiCollezione: number;     // La mia collezione, Opzioni, Modalità test (una sopra l'altra)
  scarti: boolean;               // pila degli scarti aperta
}

// Cosa chiude Indietro: il livello più in alto; senza livelli, dalla pagina Nuova partita si torna al menu iniziale;
// null = niente da chiudere (il primo Indietro avvisa, il secondo esce dall'app)
export type ChiusuraIndietro = 'finestra' | 'annulla-sospeso' | 'pesca-carta' | 'collezione' | 'scarti' | 'menu' | null;

export function cosaChiudeIndietro(l: Livelli, schermata: Schermata = schermataAttuale()): ChiusuraIndietro {
  if (l.finestre > 0) return 'finestra';
  if (l.annullaSospeso) return 'annulla-sospeso';
  if (l.pescaCarta) return 'pesca-carta';
  if (l.schermiCollezione > 0) return 'collezione';
  if (l.scarti) return 'scarti';
  if (schermata === 'nuova-partita') return 'menu';
  return null;
}
