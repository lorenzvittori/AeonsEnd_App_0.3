// ui/ridisegno.ts: gli agganci verso l'alto. Un modulo di un livello basso (componente, finestra, schermata) che dopo
// un'azione deve far succedere qualcosa che decide il coordinatore (ridisegnare l'app, andare al menu iniziale,
// mostrare la fine della partita...) chiama una di queste funzioni invece di importare il modulo che lo fa: così gli
// import vanno solo verso il basso. I gestori li registra ui/navigazione.ts all'avvio (registraAgganci); ogni funzione
// li chiama subito (in modo sincrono), come la chiamata diretta di prima.
// Livello 2 (ui/ base). Non dipende da niente. Usato da: ui/componenti/, ui/finestre/, ui/schermate/; registrato da
// ui/navigazione.ts.

// Cosa serve a schermo dopo un'azione del turno nemesi già fatta nello stato: se la carta è stata scartata (vola negli
// scarti), la sua immagine (ghostSource), se era il passo della carta appena pescata, l'uid della carta, il turno e il
// giro di prima dell'azione
export interface DopoAzioneNemesi {
  scartata: boolean;
  ghostSource: HTMLElement | null;
  wasNewStep: boolean;
  uid: number;
  turnBefore: number;
  roundBefore: number;
}

// I gestori, uno per aggancio (vedi le funzioni sotto per il perché di ognuno)
export interface Agganci {
  dopoAzioneNemesi: (a: DopoAzioneNemesi) => void;
  ridisegna: () => void;
  menuIniziale: () => void;
  finePartita: (esito: 'victory' | 'defeat') => void;
  chiudiCreaMazzo: () => void;
  menuLaterale: (leave?: () => void) => void;
  ricominciaMazzo: () => void;
  ricominciaScenario: () => void;
  partitaDaScenario: () => void;
  turnoGiocatoriDaNemesi: (morphUid: number | null, fromNode?: HTMLElement | null) => void;
  turnoNemesi: () => void;
  vaiA: (schermata: 'menu' | 'nuova-partita') => void;
  riprendiPartita: () => void;
  aggiornaInizio: () => void;
  vita: (kind: 'grave' | 'nemesis') => void;
  statistiche: () => void;
  apriPescaTurno: () => void;
}

// Finché il coordinatore non li registra, chiamarli è un errore del programma
const mancante = (nome: string) => () => { throw new Error(`Aggancio ${nome} non registrato (ui/navigazione.ts, avvio)`); };

const gestori: Agganci = {
  dopoAzioneNemesi: mancante('dopoAzioneNemesi'),
  ridisegna: mancante('ridisegna'),
  menuIniziale: mancante('menuIniziale'),
  finePartita: mancante('finePartita'),
  chiudiCreaMazzo: mancante('chiudiCreaMazzo'),
  menuLaterale: mancante('menuLaterale'),
  ricominciaMazzo: mancante('ricominciaMazzo'),
  ricominciaScenario: mancante('ricominciaScenario'),
  partitaDaScenario: mancante('partitaDaScenario'),
  turnoGiocatoriDaNemesi: mancante('turnoGiocatoriDaNemesi'),
  turnoNemesi: mancante('turnoNemesi'),
  vaiA: mancante('vaiA'),
  riprendiPartita: mancante('riprendiPartita'),
  aggiornaInizio: mancante('aggiornaInizio'),
  vita: mancante('vita'),
  statistiche: mancante('statistiche'),
  apriPescaTurno: mancante('apriPescaTurno')
};

// Il coordinatore registra i gestori (tutti o una parte)
export function registraAgganci(a: Partial<Agganci>): void {
  Object.assign(gestori, a);
}

// Ridisegno di tutta l'app dopo un'azione (render del coordinatore): lo chiedono componenti, finestre e schermate
export function richiediRidisegno(): void {
  gestori.ridisegna();
}

// Menu iniziale ("Esci dalla partita" del menu laterale, "Menu iniziale" della Vittoria): è il coordinatore che mostra
// e nasconde la pagina iniziale
export function vaiAlMenuIniziale(): void {
  gestori.menuIniziale();
}

// Vittoria o Sconfitta: vite a 0 (box e finestra della vita), "Nemesi uccisa" del menu laterale. La finestra delle
// statistiche è allo stesso livello del menu laterale e sopra i box delle vite
export function mostraFinePartita(esito: 'victory' | 'defeat'): void {
  gestori.finePartita(esito);
}

// La schermata "Crea mazzo" si chiude subito (ripristino di una fotografia: ripresa, undo, scenari); il ripristino è un
// componente, la schermata sta sopra
export function chiudiCreaMazzo(): void {
  gestori.chiudiCreaMazzo();
}

// Menu laterale aperto da un'altra finestra (il pulsante Menu nella copia della testata del mazzo dei turni)
export function apriMenuLaterale(leave?: () => void): void {
  gestori.menuLaterale(leave);
}

// "Ricomincia la partita" del menu laterale durante "Crea mazzo" (la schermata sta sopra il menu)
export function ricominciaMazzo(): void {
  gestori.ricominciaMazzo();
}

// "Ricomincia lo scenario" del menu laterale nella Modalità test (le due finestre sono allo stesso livello)
export function ricominciaScenario(): void {
  gestori.ricominciaScenario();
}

// Uno scenario della Modalità test è partito: si lascia la pagina iniziale e si disegna la partita
export function vaiAllaPartitaDaScenario(): void {
  gestori.partitaDaScenario();
}

// Fine del turno nemesi: il turno giocatori entra con il suo passaggio animato (la carta appena messa in gioco si
// trasforma, le altre entrano da sinistra); il turno nemesi non accende il turno giocatori
export function passaAlTurnoGiocatori(morphUid: number | null, fromNode?: HTMLElement | null): void {
  gestori.turnoGiocatoriDaNemesi(morphUid, fromNode);
}

// Dopo una vita del minion portata a 0 dalla scheda nel turno nemesi: se l'azione ha chiuso il turno nemesi (o l'ha fatto
// ripartire) lo schermo fa lo stesso passaggio della fine normale; la scheda sta in un livello sotto la schermata
export function dopoAzioneNemesi(a: DopoAzioneNemesi): void {
  gestori.dopoAzioneNemesi(a);
}

// Inizio del turno nemesi a schermo, dopo che la partita è già passata al turno nemesi ("Fine turno" del turno
// giocatori): le carte grandi partono da quella che si stava guardando nel turno giocatori
export function passaAlTurnoNemesi(): void {
  gestori.turnoNemesi();
}

// Pesca del turno nella schermata del mazzo dei turni (dopo "Fine turno", o da "Pesca la prima carta turno")
export function apriPescaTurno(): void {
  gestori.apriPescaTurno();
}

// Menu iniziale ↔ Nuova partita ("Nuova partita" del menu, X della pagina Nuova partita): le due schermate stanno nella
// pagina iniziale e non si accendono a vicenda
export function vaiA(schermata: 'menu' | 'nuova-partita'): void {
  gestori.vaiA(schermata);
}

// "Riprendi partita" del menu iniziale: la ripresa porta dalla pagina iniziale alla partita
export function riprendiPartita(): void {
  gestori.riprendiPartita();
}

// La collezione è cambiata (La mia collezione, dalle Opzioni o dal menu): si ridisegnano le scelte della Nuova partita
// e il menu iniziale
export function aggiornaInizio(): void {
  gestori.aggiornaInizio();
}

// Tocco sul box della vita (componente): si apre la finestra della vita
export function apriFinestraVita(kind: 'grave' | 'nemesis'): void {
  gestori.vita(kind);
}

// "Statistiche in corso" del menu laterale: le statistiche della partita (la finestra sta nello stesso livello del menu)
export function apriStatistiche(): void {
  gestori.statistiche();
}
