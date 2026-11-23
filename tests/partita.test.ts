// Il modulo della partita (src/stato/partita.ts) con i dati veri, il caso e l'orologio fissati: nuovaPartita() dà sempre
// lo stesso stato; due partite di fila con lo stesso caso danno lo stesso risultato (anche dopo un'altra partita); ogni
// azione è un solo passo di undo; salvataggio → ripresa = stesso stato (save e readSave con un localStorage finto).
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { caricaCatalogo } from '../src/stato/catalogo.ts';
import { preferenze } from '../src/stato/preferenze.ts';
import * as P from '../src/stato/partita.ts';
import { SAVE_KEY, readSave, save } from '../src/stato/salvataggio.ts';
import { isDrawStep } from '../src/regole/turno-nemesi.ts';
import { cards, deckSetup, nemeses, products, seeded, must } from './aiuto.ts';
import type { Impostazioni } from '../src/tipi/partita.ts';

const { partita } = P;

// Caso e orologio come nelle prove del browser: Math.random ripetibile, Date.now che avanza di 1 s a ogni lettura
function fissa(seed: number): void {
  vi.spyOn(Math, 'random').mockImplementation(seeded(seed));
  let now = 1700000000000;
  vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
}

// localStorage finto (in Node non c'è)
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

const scelte = (nemesis: string, players: number): Impostazioni => ({ players, nemesis, battleMode: true, mergeCollection: true });

// Un passo di gioco con le sole azioni del modulo (come i tocchi dell'app): restituisce il nome dell'azione
function passo(i: number): string {
  if (P.awaitingTurnCard()) { P.pescaCartaTurno(); return 'pesca carta turno'; }
  if (!partita.resolving) {
    const cur = P.currentTurn();
    if (cur && P.isPairCard(cur.kind) && !cur.player) { P.scegliGiocatoreCoppia(P.pairOptions(cur.kind)[i % 2]); return 'scelta'; }
    const m = partita.queue.find(e => e.data.type === 'Minion' && !P.hpUnset(e) && Number(e.hp) > 0);
    if (i % 3 === 0 && m) { P.salvaModifiche(new Map([[m.uid, { hp: Number(m.hp) - 1 }]])); return 'salva modifiche'; }
    if (i % 7 === 0 && partita.deck.length > 2) { P.scartaCimaDelMazzo(); return 'scarta dal mazzo'; }
    P.fineTurnoGiocatore();
    return 'fine turno';
  }
  if (isDrawStep(partita)) { P.pescaCarta(); return 'pesca'; }
  const a = must(partita.queue[partita.currentIndex], 'carta da risolvere');
  if (P.hpUnset(a)) { P.cambiaVitaMinion(a, 5, true); return 'vita'; }
  if (i % 5 === 0) { P.cambiaVita('nemesis', Math.max(0, partita.nemesisLife - 2)); return 'vita nemesi'; }
  P.risolviCarta();
  return 'risolvi';
}

// Una partita intera da nuovaPartita(): le fotografie dopo ogni azione, fino a `n` azioni o al turno giocatori dopo
// almeno `n` azioni (così la ripresa non cade nel bug noto del passo Pesca)
function gioca(nemesis: string, players: number, seed: number, n: number): string[] {
  fissa(seed);
  preferenze.settings = scelte(nemesis, players);
  P.nuovaPartita();
  const out = [JSON.stringify(P.snapshot())];
  for (let i = 0; i < n || partita.resolving; i++) {
    if (partita.deck.length === 0 && P.isVictory()) break;
    const before = partita.undoStack.length;
    const what = passo(i);
    // Un'azione = un solo passo di undo
    expect(partita.undoStack.length, `${what} (passo ${i})`).toBe(before + 1);
    out.push(what + ' ' + JSON.stringify(P.snapshot()));
  }
  return out;
}

describe('stato/partita.ts: la partita in corso', () => {
  beforeAll(() => {
    caricaCatalogo({ cards, nemeses, deckSetup, products, nemesisArt: {} });
    preferenze.collection = new Set(Object.keys(products));
  });
  beforeEach(() => { vi.stubGlobal('localStorage', localStorageFinto()); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('nuovaPartita() dà sempre lo stesso stato con lo stesso caso, anche dopo un\'altra partita', () => {
    fissa(7);
    preferenze.settings = scelte('Maggoth', 4);
    P.nuovaPartita();
    const first = JSON.stringify(P.snapshot());
    expect(partita.queue).toEqual([]);
    expect(partita.undoStack).toEqual([]);
    expect(partita.turn).toBe(0);
    expect(partita.nemesisLife).toBe(45);
    // Un'altra partita giocata in mezzo (altra nemesi, altri giocatori), poi di nuovo da zero
    gioca('Rageborne', 2, 3, 40);
    expect(partita.undoStack.length).toBeGreaterThan(0);
    vi.restoreAllMocks();
    fissa(7);
    preferenze.settings = scelte('Maggoth', 4);
    P.nuovaPartita();
    expect(JSON.stringify(P.snapshot())).toBe(first);
    expect(partita.undoStack).toEqual([]);
  });

  it('due partite di fila con lo stesso caso danno lo stesso risultato (anche con un\'altra partita in mezzo)', () => {
    const a = gioca('Maggoth', 4, 11, 120);
    vi.restoreAllMocks();
    const b = gioca('Maggoth', 4, 11, 120);
    vi.restoreAllMocks();
    gioca('Carapace Queen', 3, 5, 60);
    vi.restoreAllMocks();
    const c = gioca('Maggoth', 4, 11, 120);
    expect(a.length).toBeGreaterThan(100);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('un\'azione = un solo passo di undo, anche per la finestra del mazzo dei turni e la fine della partita', () => {
    gioca('Fenrix', 4, 21, 80); // dentro: ogni azione aggiunge un passo
    const steps = partita.undoStack.length;
    const before = P.snapshot();
    // Finestra del mazzo dei turni: le modifiche si scrivono senza undo, il passo è uno alla chiusura
    const d = { left: partita.turnOrder.left.slice().reverse(), known: partita.turnOrder.left.map(() => true), drawn: partita.turnOrder.drawn.slice(),
      picks: {}, pairNext: P.emptyPairNext(partita.turnOrder.pairNext), history: partita.turnOrder.history.slice(), waiting: false };
    P.applicaBozzaTurni(d);
    expect(partita.undoStack.length).toBe(steps);
    P.aggiungiPassoUndo(before);
    expect(partita.undoStack.length).toBe(steps + 1);
    // Fine della partita (Vittoria / Sconfitta): solo l'ora di fine, senza undo
    P.segnaFinePartita();
    expect(partita.undoStack.length).toBe(steps + 1);
    expect(partita.stats.endedAt).not.toBe(null);
  });

  it('salvataggio → ripresa = stesso stato (save e readSave, poi il ripristino da zero)', () => {
    gioca('The Wailing', 4, 27, 90);
    expect(partita.resolving).toBe(false);
    expect(partita.turn).toBeGreaterThan(0);
    const snap = JSON.stringify(P.snapshot());
    const undo = JSON.stringify(partita.undoStack);
    save();
    const text = must(localStorage.getItem(SAVE_KEY), 'salvataggio scritto');
    // Si gioca un'altra partita (che salva a ogni azione), poi si rimette il salvataggio di prima e lo si riprende
    gioca('Maggoth', 2, 99, 30);
    localStorage.setItem(SAVE_KEY, text);
    const saved = must(readSave(), 'salvataggio');
    preferenze.settings = saved.settings;
    P.applicaRipristino(P.preparaRipristino(saved.state).game);
    P.impostaUndo(saved.undo || []);
    expect(JSON.stringify(P.snapshot())).toBe(snap);
    expect(JSON.stringify(partita.undoStack)).toBe(undo);
  });

  it('Modalità test: all\'uscita tornano le scelte di prima e la partita riparte da zero', () => {
    fissa(1);
    preferenze.settings = scelte('Maggoth', 4);
    P.nuovaPartita();
    const vera = JSON.stringify(preferenze.settings);
    P.iniziaProva({ id: 'x', name: 'prova', pairs: null, turnCards: null });
    preferenze.settings = scelte('Rageborne', 2);
    P.esciDalTest();
    expect(JSON.stringify(preferenze.settings)).toBe(vera);
    expect(partita.testRun).toBe(null);
    expect(partita.deck).toEqual([]);
    expect(partita.undoStack).toEqual([]);
  });
});
