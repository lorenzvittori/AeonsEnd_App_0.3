// Fine turno e pesca del turno dopo (src/stato/partita.ts): "Fine turno" dei giocatori o della nemesi non pesca la carta
// turno dopo ma lascia il turno da pescare (la finestra "Pesca nuovo turno" la pesca con pescaCartaTurno); a fine giro il
// mazzo dei turni si mescola; i punti vita tolti alla nemesi e dati a Gravehold nel turno di un giocatore vanno alle sue
// statistiche. Partita vera, con caso e orologio fissati.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { caricaCatalogo } from '../src/stato/catalogo.ts';
import { preferenze } from '../src/stato/preferenze.ts';
import * as P from '../src/stato/partita.ts';
import { isDrawStep } from '../src/regole/turno-nemesi.ts';
import { cards, deckSetup, nemeses, products, seeded, must } from './aiuto.ts';

const { partita } = P;

function localStorageFinto(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: k => (m.has(k) ? String(m.get(k)) : null),
    key: i => [...m.keys()][i] ?? null,
    removeItem: k => { m.delete(k); },
    setItem: (k, v) => { m.set(k, String(v)); }
  };
}

// Un passo di gioco come i pulsanti: pesca del turno, fine turno, risolvi, pesca
function avanza(): void {
  if (P.awaitingTurnCard()) { P.pescaCartaTurno(); return; }
  if (!partita.resolving) { P.fineTurnoGiocatore(); return; }
  if (isDrawStep(partita)) { P.pescaCarta(); return; }
  const a = must(partita.queue[partita.currentIndex], 'carta da risolvere');
  if (P.hpUnset(a)) P.cambiaVitaMinion(a, 5, true);
  else P.risolviCarta();
}

// Si gioca finché la condizione vale (al massimo 600 passi)
function finoA(cond: () => boolean): void {
  for (let i = 0; i < 600 && !cond(); i++) avanza();
  expect(cond()).toBe(true);
}

// Turno di un giocatore già pescato (2 giocatori: niente carte 1/2 e 3/4, il giocatore c'è sempre)
const turnoGiocatore = () => !partita.resolving && !P.awaitingTurnCard();

describe('fine turno e pesca del turno dopo', () => {
  beforeAll(() => {
    caricaCatalogo({ cards, nemeses, deckSetup, products, nemesisArt: {} });
    preferenze.collection = new Set(Object.keys(products));
  });
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageFinto());
    vi.spyOn(Math, 'random').mockImplementation(seeded(5));
    let now = 1700000000000;
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
    preferenze.settings = { players: 2, nemesis: 'Maggoth', battleMode: true, mergeCollection: true };
    P.nuovaPartita();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('"Fine turno" dei giocatori: il turno dopo è da pescare (un passo di undo), poi pescaCartaTurno lo pesca', () => {
    finoA(() => turnoGiocatore() && !P.turnRoundOver());
    const storia = partita.turnOrder.history.length;
    const scarti = partita.turnOrder.drawn.length;
    const passi = partita.undoStack.length;
    P.fineTurnoGiocatore();
    expect(P.awaitingTurnCard()).toBe(true);
    expect(P.currentTurn()).toBe(null);
    expect(partita.resolving).toBe(false);
    expect(partita.turnOrder.waiting).toBe(true);
    expect(partita.turnOrder.history.length).toBe(storia);
    expect(partita.turnOrder.drawn.length).toBe(scarti);
    expect(partita.undoStack.length).toBe(passi + 1);
    P.pescaCartaTurno();
    expect(P.awaitingTurnCard()).toBe(false);
    expect(partita.turnOrder.waiting).toBe(false);
    expect(partita.turnOrder.history.length).toBe(storia + 1);
    expect(partita.turnOrder.drawn.length).toBe(scarti + 1);
    expect(partita.undoStack.length).toBe(passi + 2);
    // Se è uscita la nemesi parte il turno nemesi
    expect(partita.resolving).toBe(P.currentTurnCard() === 'nemesis');
  });

  it('fine del turno nemesi: il turno dopo è da pescare', () => {
    finoA(() => partita.resolving);
    const storia = partita.turnOrder.history.length;
    finoA(() => !partita.resolving);
    expect(P.awaitingTurnCard()).toBe(true);
    expect(partita.turnOrder.history.length).toBe(storia);
  });

  it('ultimo turno del giro: "Fine turno" mescola il mazzo dei turni (giro nuovo, storia vuota) e il turno è da pescare', () => {
    finoA(() => P.currentTurn() !== null && P.turnRoundOver());
    const giro = partita.turnOrder.round;
    finoA(() => partita.turnOrder.round !== giro);
    expect(partita.turnOrder.round).toBe(giro + 1);
    expect(partita.turnOrder.history).toEqual([]);
    expect(partita.turnOrder.left.length).toBe(6);
    expect(P.awaitingTurnCard()).toBe(true);
    P.pescaCartaTurno();
    expect(partita.turnOrder.history.length).toBe(1);
    expect(partita.turnOrder.left.length).toBe(5);
  });

  it('turno da pescare e undo: la pesca si annulla e torna il turno da pescare', () => {
    finoA(() => turnoGiocatore() && !P.turnRoundOver());
    P.fineTurnoGiocatore();
    const prima = P.snapshot();
    P.pescaCartaTurno();
    const dopo = must(P.togliPassoUndo(), 'passo di undo');
    expect(dopo.turnOrder?.waiting).toBe(true);
    expect(JSON.stringify(dopo.turnOrder)).toBe(JSON.stringify(prima.turnOrder));
  });

  it('vita nel turno di un giocatore: punti tolti alla nemesi e dati a Gravehold vanno alle sue statistiche', () => {
    finoA(turnoGiocatore);
    const giocatore = must(P.turnCardPlayer(P.currentTurnCard()), 'giocatore del turno');
    const start = partita.nemesisLife;
    P.cambiaVita('nemesis', start - 4);
    P.cambiaVita('nemesis', start - 3); // un punto di cura: non è danno
    expect(P.mageStatsOf(giocatore).nemesisDamage).toBe(4);
    P.cambiaVita('grave', 25);
    expect(P.mageStatsOf(giocatore).graveHeal).toBe(0);
    P.cambiaVita('grave', 28);
    expect(P.mageStatsOf(giocatore).graveHeal).toBe(3);
    // Gravehold può scendere sotto 0
    P.cambiaVita('grave', -2);
    expect(partita.graveLife).toBe(-2);
    // Nel turno nemesi niente va alle statistiche dei maghi
    finoA(() => partita.resolving);
    const prima = JSON.stringify(partita.stats.mages);
    P.cambiaVita('nemesis', partita.nemesisLife - 2);
    expect(JSON.stringify(partita.stats.mages)).toBe(prima);
  });
});
