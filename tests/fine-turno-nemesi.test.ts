// La fine del turno nemesi da tutte le strade (src/stato/partita.ts): un minion portato a 0 dalla scheda che chiude la
// risoluzione estrae la carta turno come risolviCarta e pescaCarta; un minion non appena pescato lascia il turno nemesi
// in corso; il tutto è un solo passo di undo.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { caricaCatalogo } from '../src/stato/catalogo.ts';
import { preferenze } from '../src/stato/preferenze.ts';
import * as P from '../src/stato/partita.ts';
import { isDrawStep } from '../src/regole/turno-nemesi.ts';
import { cards, deckSetup, nemeses, products, seeded, must } from './aiuto.ts';
import type { VoceInGioco } from '../src/tipi/partita.ts';

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

// Un passo di gioco senza uccidere minion: si ferma (restituisce false) quando serve decidere
function avanza(): void {
  if (P.awaitingTurnCard()) { P.pescaCartaTurno(); return; }
  if (!partita.resolving) {
    const cur = P.currentTurn();
    if (cur && P.isPairCard(cur.kind) && !cur.player) P.scegliGiocatoreCoppia(P.pairOptions(cur.kind)[0]);
    else P.fineTurnoGiocatore();
    return;
  }
  if (isDrawStep(partita)) { P.pescaCarta(); return; }
  const a = must(partita.queue[partita.currentIndex], 'carta da risolvere');
  if (P.hpUnset(a)) P.cambiaVitaMinion(a, 5, true);
  else P.risolviCarta();
}

// Si gioca finché la carta appena pescata è un minion con vita nota (turno nemesi, passo "carta nuova")
function finoAlMinionPescato(): VoceInGioco {
  for (let i = 0; i < 2000; i++) {
    const nuova = partita.resolving && partita.newIndex >= 0 ? partita.queue[partita.newIndex] : null;
    if (nuova && nuova.data.type === 'Minion' && !P.hpUnset(nuova)) return nuova;
    avanza();
  }
  throw new Error('nessun minion pescato');
}

const storia = () => JSON.stringify(partita.turnOrder);

describe('fine del turno nemesi da tutte le strade', () => {
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

  it('minion appena pescato portato a 0 dalla scheda: il turno nemesi finisce e si estrae la carta turno', () => {
    const minion = finoAlMinionPescato();
    const turn = partita.turn;
    const prima = storia();
    const passi = partita.undoStack.length;
    P.cambiaVitaMinion(minion, 0, false);
    expect(partita.resolving).toBe(partita.turn !== turn);
    expect(storia()).not.toBe(prima);
    expect(partita.queue).not.toContain(minion);
    expect(partita.discard).toContain(minion.data);
    expect(partita.undoStack.length).toBe(passi + 1);
  });

  it('stessa carta turno che esce con la fine normale del turno nemesi (risolviCarta sul minion appena pescato)', () => {
    const minion = finoAlMinionPescato();
    const snap = P.snapshot();
    const caso = seeded(99);
    vi.spyOn(Math, 'random').mockImplementation(caso);
    P.risolviCarta();
    const normale = storia();
    const resolvingNormale = partita.resolving;
    // Si torna alla stessa fotografia e si uccide il minion dalla scheda: stesso mazzo dei turni
    P.applicaRipristino(P.preparaRipristino(snap).game);
    vi.spyOn(Math, 'random').mockImplementation(seeded(99));
    const dopoRipristino = must(partita.queue[partita.newIndex], 'minion di nuovo pescato');
    expect(dopoRipristino.data.id).toBe(minion.data.id);
    P.cambiaVitaMinion(dopoRipristino, 0, false);
    expect(storia()).toBe(normale);
    expect(partita.resolving).toBe(resolvingNormale);
  });

  it('minion non appena pescato a 0 con altre carte da pescare: il turno nemesi continua (passo Pesca)', () => {
    finoAlMinionPescato();
    P.risolviCarta(); // il minion resta in gioco, torna il turno giocatori
    // Si va al turno nemesi dopo: il minion è la prima carta da risolvere
    for (let i = 0; i < 200 && !(partita.resolving && partita.newIndex < 0); i++) avanza();
    const minion = must(partita.queue.find(e => e.data.type === 'Minion' && !P.hpUnset(e)), 'minion in coda');
    // Si risolvono le carte prima del minion, poi si porta il minion a 0 quando è l'ultima della coda
    while (partita.queue[partita.currentIndex] !== minion && partita.resolving) avanza();
    expect(partita.resolving).toBe(true);
    const turn = partita.turn;
    const prima = storia();
    const passi = partita.undoStack.length;
    P.cambiaVitaMinion(minion, 0, false);
    expect(partita.resolving).toBe(true);
    expect(partita.turn).toBe(turn);
    expect(storia()).toBe(prima);
    expect(partita.queue).not.toContain(minion);
    expect(partita.undoStack.length).toBe(passi + 1);
  });
});
