// stato/partita.ts: la partita in corso. È l'unico modulo che la possiede e la cambia: il resto dell'app vede
// `partita` in sola lettura (tipo Readonly; npm run check controlla che fuori da qui nessuno ne assegni i campi) e la
// cambia chiamando le azioni qui sotto. Le regole di gioco (src/regole/) restano pure: qui le si chiama passando lo
// stato, il caso (Math.random) e l'ora (Date.now).
// Livello 1 (stato/). Dipende da: regole/, stato/preferenze.ts, stato/catalogo.ts, stato/salvataggio.ts
// (scriviPartita), tipi/. Usato da: ui/ (lettura e azioni), dati/rete.ts, avvio.ts, main.ts, test.
//
// Il giro di ogni azione (act, la stessa di sempre):
//   1. fotografia per l'undo (snapshot → undoStack, al massimo UNDO_LIMIT passi);
//   2. modifica della partita (le regole);
//   3. salvataggio nel browser (stato/salvataggio.ts, save: niente nella Modalità test, prima del primo turno nemesi o
//      nella pagina scheletri/);
//   4. ridisegno: lo fa la schermata che ha chiamato l'azione, subito dopo, perché prima prepara le sue animazioni
//      (carta che vola negli scarti, carta che si gira, blocco del pulsante) e poi ridisegna (render).
// Un'azione = un passo di undo. Fanno eccezione, e lo dicono: la finestra del mazzo dei turni (applicaBozzaTurni scrive
// senza undo a ogni modifica, aggiungiPassoUndo aggiunge un solo passo alla chiusura) e la fine della partita
// (segnaFinePartita: solo l'ora di fine, senza undo).
//
// Partita da zero: campiDaZero() è l'unico punto che costruisce i campi di una partita vuota; lo usano nuovaPartita()
// (Nuova partita, Ricomincia, cambio dei giocatori in "Crea mazzo", avvio), applicaRipristino() (ripresa, undo,
// scenari della Modalità test) ed esciDalTest(). nextUid non riparte: gli uid non tornano mai, così le carte della
// partita di prima ancora nella pagina (animazioni) non si confondono con quelle nuove.

import * as Mazzo from '../regole/mazzo-nemesi.ts';
import * as Turni from '../regole/mazzo-turni.ts';
import * as Nemesi from '../regole/turno-nemesi.ts';
import * as Vite from '../regole/vite.ts';
import * as Salv from '../regole/salvataggio.ts';
import { GRAVEHOLD_LIFE } from '../regole/vite.ts';
import { jsonCopy } from '../regole/json.ts';
import { catalogo } from './catalogo.ts';
import { preferenze, turnPairsSaved } from './preferenze.ts';
import { scriviPartita } from './salvataggio.ts';
import type { Carta, DatiRegole, RigaDeckSetup } from '../tipi/dati.ts';
import type { BozzaCarta, BozzaTurni, CartaTurno, Giocatore, GruppoStatistiche, MazzoTurni, Partita, PianoMazzo,
  ProvaInCorso, SceltePerMazzo, Statistiche, StatisticheMago, TipoVita, TurnoStoria, VoceInGioco } from '../tipi/partita.ts';
import type { Fotografia, FotografiaLetta, StatoPartita } from '../tipi/salvataggio.ts';

// Regole senza stato, usate così come sono
export { isPairCard, pairOptions, emptyPairNext, pickOf, otherOfPair, historyFromPile, predictedPairPlayers, takeFromTurnPile } from '../regole/mazzo-turni.ts';
export { aetherCost, isVariableMinion, hpUnset, hpMaxOf, hpCap } from '../regole/turno-nemesi.ts';
export { GRAVEHOLD_LIFE };

// Passi di undo conservati al massimo
export const UNDO_LIMIT = 300;

// --- Lo stato ---

// I campi di gioco di una partita vuota: niente carte, vite iniziali di Gravehold (la nemesi a 0 finché non c'è un
// mazzo), statistiche da zero, mazzo dei turni da cominciare
function campiDaZero(): Partita {
  return { queue: [], deck: [], discard: [], turn: 0, resolving: false, currentIndex: 0, newIndex: -1, maxTierDrawn: 0,
    graveLife: GRAVEHOLD_LIFE, nemesisLife: 0, stats: Nemesi.emptyStats(0), turnOrder: Turni.newTurnOrder() };
}

const stato: StatoPartita = { ...campiDaZero(), nextUid: 1, undoStack: [], testRun: null };

// La partita in corso, in sola lettura (si cambia con le funzioni di questo modulo)
export const partita: Readonly<StatoPartita> = stato;

// --- Partita nuova, fotografia, ripristino, undo ---

// Nuova partita con le scelte correnti: da zero, poi vite iniziali, mazzo nuovo (Math.random), statistiche con l'ora
// di inizio. Finito "Crea mazzo" si aspetta "Pesca carta turno"
export function nuovaPartita(): void {
  Object.assign(stato, campiDaZero());
  stato.undoStack = [];
  stato.nemesisLife = nemesisStartLife();
  stato.deck = buildDeck();
  // Il mazzo dei turni parte pieno e mescolato, con tutte le carte coperte, come dopo un giro. Il giro resta 0 (niente
  // "Turno N" nella testata e "Pesca carta turno" finché non si pesca): solo il mazzo è quello di un giro mescolato
  stato.turnOrder = { ...Turni.shuffleTurnOrder(stato.turnOrder, preferenze.settings.players,
    turnOrderCards(preferenze.settings.players), Math.random), round: 0 };
  stato.stats = Nemesi.emptyStats(stato.deck.length);
  stato.stats.startedAt = Date.now();
}

// Fotografia della partita (solo dati semplici, così si può salvare nel browser; formato in regole/salvataggio.ts)
export function snapshot(): Fotografia {
  return Salv.snapshotGame(stato);
}

// Prima parte del ripristino: si leggono tutte le carte della fotografia (anche dei formati vecchi) senza cambiare la
// partita; una carta sconosciuta è un errore e la partita resta com'è. Gli uid nuovi si prendono da nextUid
export function preparaRipristino(s: FotografiaLetta): ReturnType<typeof Salv.restoreGame> {
  return Salv.restoreGame(s, { cardsById: catalogo.cardsById, newUid: () => stato.nextUid++,
    players: preferenze.settings.players, nemeses: catalogo.nemeses, nemesisName: preferenze.settings.nemesis,
    random: Math.random, cards: () => turnOrderCards(preferenze.settings.players) });
}

// Seconda parte: la partita diventa quella letta (da zero più i campi della fotografia); undo e Modalità test restano
export function applicaRipristino(game: Partita): void {
  Object.assign(stato, campiDaZero(), {
    deck: game.deck, discard: game.discard, turn: game.turn, queue: game.queue, maxTierDrawn: game.maxTierDrawn,
    graveLife: game.graveLife, nemesisLife: game.nemesisLife, stats: game.stats, resolving: game.resolving,
    currentIndex: game.currentIndex, newIndex: game.newIndex, turnOrder: game.turnOrder
  });
}

// Passi di undo di una partita ripresa (quelli del salvataggio) o di una partita da zero ([])
export function impostaUndo(steps: FotografiaLetta[]): void {
  stato.undoStack = steps;
}

// Aggiunge un passo di undo (lo stato prima di un'azione), tenendone al massimo UNDO_LIMIT
export function pushUndo(state: FotografiaLetta): void {
  stato.undoStack.push(state);
  if (stato.undoStack.length > UNDO_LIMIT) stato.undoStack.shift();
}

// L'ultimo passo di undo, tolto dall'elenco (undefined se non ce ne sono)
export function togliPassoUndo(): FotografiaLetta | undefined {
  return stato.undoStack.pop();
}

// Salvataggio della partita nel browser (stato/salvataggio.ts: niente nella Modalità test, prima del primo turno nemesi
// o nella pagina scheletri/)
export function save(): void {
  scriviPartita(stato);
}

// Ogni azione che cambia la partita: prima si salva lo stato per l'undo, poi si fa l'azione, poi si salva la partita
// (il ridisegno lo fa chi chiama, vedi in cima)
export function act<T>(action: () => T): T {
  pushUndo(snapshot());
  const result = action();
  save();
  return result;
}

// --- Modalità test ---

// Inizio (o nuovo inizio) di uno scenario: la prima volta si ricordano le scelte della partita vera
export function iniziaProva(info: Omit<ProvaInCorso, 'prevSettings'>): void {
  if (!stato.testRun) stato.testRun = { prevSettings: jsonCopy(preferenze.settings) };
  Object.assign(stato.testRun, info);
}

// Uscita dal test (menu iniziale): tornano le scelte di prima e la partita di test si butta (partita da zero, senza
// mazzo: "Riprendi partita" ricarica quella salvata, "Nuova partita" ne fa una nuova)
export function esciDalTest(): void {
  if (!stato.testRun) return;
  preferenze.settings = stato.testRun.prevSettings;
  stato.testRun = null;
  Object.assign(stato, campiDaZero());
  stato.undoStack = [];
}

// --- Mazzo nemesi ---

// Dati per le regole del mazzo nemesi (deck-setup.json deve essere già caricato)
export function rulesDb(): DatiRegole {
  if (!catalogo.deckSetup) throw new Error('deck-setup.json non è ancora caricato');
  return { cards: catalogo.allCards, nemeses: catalogo.nemeses, deckSetup: catalogo.deckSetup };
}

export function deckSetupRow(s: SceltePerMazzo = preferenze.settings): RigaDeckSetup | null { return Mazzo.deckSetupRow(rulesDb(), s); }
export function ownedUpgradedInWave(wave: string | null): boolean { return Mazzo.ownedUpgradedInWave(rulesDb(), preferenze.collection, wave); }
export function mergeLockedWave(s: SceltePerMazzo = preferenze.settings): string | null { return Mazzo.mergeLockedWave(rulesDb(), preferenze.collection, s); }
export function mergeActive(s: SceltePerMazzo = preferenze.settings): boolean { return Mazzo.mergeActive(rulesDb(), preferenze.collection, s); }
export function deckPool(category: 'Basic' | 'Upgraded', tier: number, s: SceltePerMazzo = preferenze.settings): Carta[] { return Mazzo.deckPool(rulesDb(), preferenze.collection, category, tier, s); }
export function deckShortfall(s: SceltePerMazzo = preferenze.settings): Mazzo.MazzoCorto | null { return Mazzo.deckShortfall(rulesDb(), preferenze.collection, s); }

// Ultimo mazzo creato: quante carte vengono da ognuno dei 9 mazzi (schermata "Crea mazzo")
export let deckPlan: PianoMazzo[] = [];

// Mazzo nemesi per le scelte della partita (vuoto se nessuna nemesi giocabile)
export function buildDeck(): Carta[] {
  const built = Mazzo.buildDeck(rulesDb(), preferenze.collection, preferenze.settings, Math.random);
  deckPlan = built.plan;
  return built.deck;
}

// Vita iniziale della nemesi della partita (regole/vite.ts)
export function nemesisStartLife(): number {
  return Vite.nemesisStartLife(catalogo.nemeses, preferenze.settings.nemesis);
}

// Statistiche di una partita nuova (regole/turno-nemesi.ts)
export function emptyStats(deckSize: number): Statistiche {
  return Nemesi.emptyStats(deckSize);
}

// Statistiche di un giocatore in questa partita (a zero dove mancano)
export function mageStatsOf(kind: Giocatore): StatisticheMago {
  return Object.assign(Nemesi.emptyMage(), stato.stats.mages[kind]);
}

// --- Mazzo dei turni ---

// Opzione "Carte turno 1/2 e 3/4": quella del browser (stato/preferenze.ts), o quella dello scenario della Modalità test
// se la sceglie (testRun.pairs)
export function turnPairsOn(): boolean {
  if (stato.testRun && typeof stato.testRun.pairs === 'boolean') return stato.testRun.pairs;
  return turnPairsSaved();
}

// Carte del mazzo dei turni per un giro nuovo (lo scenario della Modalità test può avere le sue: testRun.turnCards)
export function turnOrderCards(players: number): CartaTurno[] {
  if (stato.testRun && stato.testRun.turnCards) return stato.testRun.turnCards.slice();
  return Turni.turnOrderCards(players, () => turnPairsOn());
}

export function playerKinds(): Giocatore[] { return Turni.playerKinds(preferenze.settings.players); }

export function awaitingTurnCard(): boolean { return Turni.awaitingTurnCard(stato.turnOrder, stato.resolving); }

export function turnRoundOver(): boolean { return Turni.turnRoundOver(stato.turnOrder); }

export function currentTurn(order: Pick<MazzoTurni, 'history' | 'waiting'> = stato.turnOrder): TurnoStoria | null { return Turni.currentTurn(order); }
export function currentTurnCard(): CartaTurno | null { const cur = currentTurn(); return cur ? cur.kind : null; }
export function historyPlayer(entry: TurnoStoria | null | undefined): Giocatore | null { return Turni.historyPlayer(entry, stato.turnOrder.wild); }
// Il wild si legge sempre dal mazzo dei turni della partita, anche con la bozza della finestra
export function turnCardPlayer(kind: CartaTurno | null, i?: number, order: Pick<MazzoTurni, 'history' | 'waiting' | 'picks'> = stato.turnOrder): Giocatore | null {
  return Turni.turnCardPlayer(kind, i, order, stato.turnOrder.wild);
}

// Mazzo dei turni mescolato per un giro nuovo
export function shuffleTurnOrder(): void {
  stato.turnOrder = Turni.shuffleTurnOrder(stato.turnOrder, preferenze.settings.players, turnOrderCards(preferenze.settings.players), Math.random);
}

// Carta dalla cima del mazzo dei turni (pick: salvataggi vecchi). Le carte del giro nuovo si leggono solo a mazzo vuoto
export function drawTurnCard(pick?: (card: CartaTurno) => boolean): CartaTurno {
  const r = Turni.drawTurnCard(stato.turnOrder, { players: preferenze.settings.players, pick, random: Math.random,
    cards: () => turnOrderCards(preferenze.settings.players) });
  stato.turnOrder = r.order;
  return r.card;
}

// Fine di un turno (dei giocatori o della nemesi): la carta del turno dopo non si pesca qui ma nella finestra "Pesca nuovo
// turno" (pescaCartaTurno); intanto il turno è in attesa. All'ultimo turno del giro il mazzo dei turni si mescola (giro nuovo)
export function closeTurn(): void {
  if (turnRoundOver()) shuffleTurnOrder(); else stato.turnOrder.waiting = true;
}

// Pesca della carta turno (primo turno del giro o turno dopo): se è la nemesi parte subito il turno nemesi
export function drawNextTurn(): void {
  if (drawTurnCard() === 'nemesis') nemesisTurn();
}

// La barra dei turni disegnata per un attimo con un altro mazzo dei turni (anteprima della finestra del mazzo dei
// turni): durante draw() turnOrder è `order`, poi torna quello vero. Non è una modifica della partita (niente undo né
// salvataggio)
export function conMazzoTurni<T>(order: MazzoTurni, draw: () => T): T {
  const real = stato.turnOrder;
  try {
    stato.turnOrder = order;
    return draw();
  } finally {
    stato.turnOrder = real;
  }
}

// --- Carte in gioco e turno nemesi (da chiamare dentro un'azione) ---

export function makeEntry(data: Carta): VoceInGioco { return Nemesi.makeEntry(data, stato.nextUid++, stato.turn); }
export function entryByUid(uid: number | null): VoceInGioco | null { return Nemesi.entryByUid(stato.queue, uid); }
export function statCard(group: GruppoStatistiche, data: Carta): void { Nemesi.statCard(stato.stats, group, data); }
export function countMinionKilled(entry: VoceInGioco): void { Nemesi.countMinionKilled(stato.stats, entry, stato.turn); }
export function countPowerPaid(entry: VoceInGioco): void { Nemesi.countPowerPaid(stato.stats, entry); }
export function discardEntry(entry: VoceInGioco): void { Nemesi.discardEntry(stato, entry); }
export function discardGone(entry: VoceInGioco): void { Nemesi.discardGone(stato, entry); }
export function drawFromDeck(): Carta | null { return Nemesi.drawFromDeck(stato); }
export function isVictory(): boolean { return Nemesi.isVictory(stato); }

// Un nuovo turno nemesi: la carta pescata nel turno precedente non è più "nuova"; coda vuota: si va subito alla carta da
// pescare (o, se non c'è niente da pescare, il turno finisce) (regole/turno-nemesi.ts)
export function startResolution(): void { Nemesi.startResolution(stato); }

// Ritorno alla VistaCoda
export function endResolution(): void { Nemesi.endResolution(stato); }

export function nemesisTurn(): void { Nemesi.nemesisTurn(stato); }

// Logica del pulsante principale: agisce sulla carta da risolvere in base al suo tipo; restituisce cosa è successo, per
// l'animazione: 'token', 'discard', 'next', 'play'
export function resolveCurrent(): Nemesi.Effetto { return Nemesi.resolveCurrent(stato); }

// Fine del turno di un giocatore: danno e cura del turno si azzerano (la vita attuale diventa il riferimento), le carte
// grigie (poteri pagati, minion a 0) vanno negli scarti, poi il turno dopo è da pescare (closeTurn)
export function endPlayerTurn(): void {
  Nemesi.endPlayerTurnCards(stato);
  closeTurn();
}

// Fine del turno nemesi: il turno dopo è da pescare (closeTurn); ultima carta del giro: mazzo dei turni mischiato
export function afterNemesisTurn(): void {
  closeTurn();
}

// Dopo un minion eliminato nel turno nemesi: gli indici della risoluzione seguono la coda
export function removeWhileResolving(entry: VoceInGioco): void {
  Nemesi.removeWhileResolving(stato, entry);
}

// --- Azioni (ognuna un passo di undo, poi il salvataggio; il ridisegno lo fa chi chiama) ---

// Pesca della carta turno nella finestra "Pesca nuovo turno" (dopo "Fine turno" o a inizio giro): il turno dopo dal mazzo
// dei turni; se è la nemesi parte il turno nemesi
export function pescaCartaTurno(): void {
  act(drawNextTurn);
}

// "Fine turno" di un giocatore: il turno dopo è da pescare (pescaCartaTurno)
export function fineTurnoGiocatore(): void {
  act(endPlayerTurn);
}

// Scelta del giocatore per la carta 1/2 o 3/4 del turno in corso
export function scegliGiocatoreCoppia(player: Giocatore): void {
  act(() => { Turni.choosePairPlayer(stato.turnOrder, player); });
}

// "Pesca" nel turno nemesi: la carta in cima entra in gioco come nuova (anche il tempo del Tier nelle statistiche); a
// mazzo vuoto (non si rimescola) il turno nemesi finisce e si estrae il turno dopo. Restituisce la carta pescata (null
// a mazzo vuoto)
export function pescaCarta(): Nemesi.CartaPescata | null {
  return act(() => {
    const drawn = Nemesi.drawNewCard(stato, () => stato.nextUid++, () => Date.now());
    if (!stato.resolving) afterNemesisTurn();
    return drawn;
  });
}

// Pulsante principale sulla carta da risolvere; a fine turno nemesi si estrae il turno dopo. Restituisce l'effetto
export function risolviCarta(): Nemesi.Effetto {
  return act(() => {
    const result = resolveCurrent();
    if (!stato.resolving) afterNemesisTurn();
    return result;
  });
}

// Vita di Gravehold o della nemesi (finestra della vita). Nel turno di un giocatore i punti tolti alla nemesi e quelli dati
// a Gravehold vanno alle sue statistiche (il wild conta per il giocatore che è wild nel giro)
export function cambiaVita(kind: TipoVita, value: number): void {
  act(() => {
    const before = kind === 'grave' ? stato.graveLife : stato.nemesisLife;
    Vite.setLife(stato, kind, value);
    Nemesi.countLifeChange(stato.stats, kind, before, value, stato.resolving ? null : turnCardPlayer(currentTurnCard()));
  });
}

// Vita di un minion confermata nel turno nemesi (scheda della carta). La prima impostazione della vita di un minion a
// vita variabile (unset) è anche la sua vita massima; a 0 (vita normale) il minion esce subito dalla coda
export function cambiaVitaMinion(entry: VoceInGioco, value: number, unset: boolean): void {
  act(() => {
    entry.hp = value;
    if (unset && value > 0) { entry.hpSet = true; entry.turnHp = value; entry.hpMax = value; }
    if (value <= 0 && !unset) {
      // turno nemesi: esce subito; turno giocatori: resta grigio fino al turno nemesi (isGone)
      if (stato.resolving) {
        removeWhileResolving(entry);
        // L'ultima carta del turno nemesi (o quella appena pescata): il turno finisce come in risolviCarta
        if (!stato.resolving) afterNemesisTurn();
      }
    }
  });
}

// "Salva modifiche" del turno giocatori: tutte le bozze diventano definitive. Statistiche dei maghi: tutto va al
// giocatore del turno in corso (il wild conta per il giocatore che è wild nel giro). Restituisce le carte uscite
export function salvaModifiche(drafts: ReadonlyMap<number, BozzaCarta>): VoceInGioco[] {
  return act(() => Nemesi.applyDrafts(stato, drafts, turnCardPlayer(currentTurnCard())));
}

// Pesca a mano dal mazzo nemesi verso gli scarti (menu del mazzo)
export function scartaCimaDelMazzo(): void {
  act(() => { const top = stato.deck.pop(); if (top) stato.discard.push(top); });
}

// Finestra del mazzo dei turni: ogni modifica si scrive subito, senza passo di undo (il passo è uno solo per tutta la
// visita, aggiunto alla chiusura con aggiungiPassoUndo)
export function applicaBozzaTurni(d: BozzaTurni): void {
  Turni.applyTurnDraft(stato.turnOrder, d);
  save();
}

// Un passo di undo aggiunto dopo (lo stato `before` fotografato all'apertura della finestra del mazzo dei turni)
export function aggiungiPassoUndo(before: FotografiaLetta): void {
  pushUndo(before);
  save();
}

// Fine del tempo di partita (statistiche): l'ultima volta che si arriva alla Vittoria o alla Sconfitta. Senza undo
export function segnaFinePartita(): void {
  stato.stats.endedAt = Date.now();
  save();
}
