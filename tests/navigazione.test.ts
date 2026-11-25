// La navigazione senza la pagina (src/ui/navigazione-stato.ts): schermataAttuale() nei casi principali, con la partita
// vera cambiata dalle sue azioni (src/stato/partita.ts) e la pagina iniziale aperta o chiusa come fa il coordinatore
// (impostaInizio), e cosa chiude il tasto Indietro con e senza finestre aperte (cosaChiudeIndietro). I blocchi della
// pagina mostrati e nascosti (ui/navigazione.ts) si provano nel browser (tools/confronto/README.md).
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { caricaCatalogo } from '../src/stato/catalogo.ts';
import { preferenze } from '../src/stato/preferenze.ts';
import * as P from '../src/stato/partita.ts';
import { isDrawStep } from '../src/regole/turno-nemesi.ts';
import { isResumableSave } from '../src/regole/salvataggio.ts';
import { ui } from '../src/ui/pagina.ts';
import { cosaChiudeIndietro, impostaInizio, paginaIniziale, schermataAttuale } from '../src/ui/navigazione-stato.ts';
import type { Livelli } from '../src/ui/navigazione-stato.ts';
import { parseJson } from '../src/regole/json.ts';
import { cards, deckSetup, nemeses, products, seeded, must } from './aiuto.ts';

const { partita } = P;

// Caso e orologio fissati, come nelle prove del browser
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

// "Inizia partita" come lo fa il coordinatore (startGame): partita nuova, "Crea mazzo", poi la pagina iniziale si chiude
function iniziaPartita(nemesis: string, players: number): void {
  preferenze.settings = { players, nemesis, battleMode: true, mergeCollection: true };
  P.nuovaPartita();
  ui.deckBuilding = true;
  impostaInizio(null);
}

// Turno giocatori → turno nemesi con le azioni della partita (come "Pesca carta turno" e "Fine turno")
function finoAlTurnoNemesi(): void {
  for (let i = 0; i < 20 && !partita.resolving; i++) {
    if (P.awaitingTurnCard()) P.pescaCartaTurno();
    else {
      const cur = P.currentTurn();
      if (cur && P.isPairCard(cur.kind) && !cur.player) P.scegliGiocatoreCoppia(P.pairOptions(cur.kind)[0]);
      else P.fineTurnoGiocatore();
    }
  }
}

// Turno nemesi → turno giocatori (risolvi, pesca)
function finoAlTurnoGiocatori(): void {
  for (let i = 0; i < 40 && partita.resolving; i++) {
    if (isDrawStep(partita)) { P.pescaCarta(); continue; }
    const a = must(partita.queue[partita.currentIndex], 'carta da risolvere');
    if (P.hpUnset(a)) P.cambiaVitaMinion(a, 5, true);
    else P.risolviCarta();
  }
}

describe('schermataAttuale()', () => {
  beforeAll(() => {
    caricaCatalogo({ cards, nemeses, deckSetup, products, nemesisArt: {} });
    preferenze.collection = new Set(Object.keys(products));
  });
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageFinto());
    // come all'apertura dell'app: pagina iniziale nel menu, nessun "Crea mazzo"
    impostaInizio('menu');
    ui.deckBuilding = false;
    fissa(3);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('avvio: il menu iniziale (anche con la prima partita da zero già pronta)', () => {
    P.nuovaPartita();
    expect(paginaIniziale()).toBe('menu');
    expect(schermataAttuale()).toBe('menu');
  });

  it('Nuova partita: dal menu alla pagina Nuova partita e ritorno', () => {
    impostaInizio('nuova-partita');
    expect(schermataAttuale()).toBe('nuova-partita');
    impostaInizio('menu');
    expect(schermataAttuale()).toBe('menu');
  });

  it('Inizia partita: "Crea mazzo", poi il turno giocatori', () => {
    iniziaPartita('Maggoth', 2);
    expect(schermataAttuale()).toBe('crea-mazzo');
    // fine di "Crea mazzo" (finishDeckBuild)
    ui.deckBuilding = false;
    expect(schermataAttuale()).toBe('turno-giocatori');
  });

  it('turno giocatori → turno nemesi → turno giocatori, con le azioni della partita', () => {
    iniziaPartita('Maggoth', 2);
    ui.deckBuilding = false;
    finoAlTurnoNemesi();
    expect(partita.resolving).toBe(true);
    expect(schermataAttuale()).toBe('turno-nemesi');
    finoAlTurnoGiocatori();
    expect(partita.resolving).toBe(false);
    expect(schermataAttuale()).toBe('turno-giocatori');
  });

  it('pagina iniziale aperta sopra la partita (Esci dalla partita): il menu, qualunque sia il turno', () => {
    iniziaPartita('Maggoth', 2);
    ui.deckBuilding = false;
    finoAlTurnoNemesi();
    impostaInizio('menu');
    expect(schermataAttuale()).toBe('menu');
  });

  it('ripresa di un salvataggio (main v228): il turno della fotografia, a pagina iniziale chiusa', () => {
    const saved = parseJson(readFileSync(join(import.meta.dirname, 'dati', 'salvataggio-main-v228.json'), 'utf8'));
    if (!isResumableSave(saved)) throw new Error('salvataggio di main v228 non valido');
    // come resumeSavedGame: scelte del salvataggio, ripristino (ui/componenti/ripristino.ts chiude "Crea mazzo"), undo
    preferenze.settings = saved.settings;
    ui.deckBuilding = true;
    const { game } = P.preparaRipristino(saved.state);
    P.applicaRipristino(game);
    ui.deckBuilding = false;
    P.impostaUndo(Array.isArray(saved.undo) ? saved.undo : []);
    expect(schermataAttuale()).toBe('menu');
    impostaInizio(null);
    expect(schermataAttuale()).toBe(partita.resolving ? 'turno-nemesi' : 'turno-giocatori');
    expect(partita.turn).toBeGreaterThan(0);
  });

  it('Modalità test: lo scenario porta alla partita; uscendo si torna al menu iniziale con la partita da zero', () => {
    const prima = preferenze.settings;
    // uno scenario nel turno nemesi: una partita giocata fino al turno nemesi, fotografata e ripristinata come scenario
    iniziaPartita('Maggoth', 2);
    ui.deckBuilding = false;
    finoAlTurnoNemesi();
    const foto = P.snapshot();
    impostaInizio('menu');
    preferenze.settings = prima;
    P.iniziaProva({ id: 'prova', name: 'Prova', pairs: null, turnCards: null });
    preferenze.settings = { players: 2, nemesis: 'Maggoth', battleMode: true, mergeCollection: true };
    P.applicaRipristino(P.preparaRipristino(foto).game);
    impostaInizio(null);
    expect(partita.testRun).not.toBe(null);
    expect(schermataAttuale()).toBe('turno-nemesi');
    // "Esci dal test" (openStart: esciDalTest, poi la pagina iniziale nel menu)
    P.esciDalTest();
    impostaInizio('menu');
    expect(partita.testRun).toBe(null);
    expect(partita.resolving).toBe(false);
    expect(schermataAttuale()).toBe('menu');
    // la pagina iniziale chiusa mostrerebbe il turno giocatori di una partita vuota
    impostaInizio(null);
    expect(schermataAttuale()).toBe('turno-giocatori');
  });
});

describe('tasto Indietro (cosaChiudeIndietro)', () => {
  const niente: Livelli = { finestre: 0, annullaSospeso: false, pescaCarta: false, schermiCollezione: 0, scarti: false };

  it('senza finestre: nel menu iniziale e nei turni non chiude niente (avviso, poi uscita); dalla Nuova partita torna al menu', () => {
    expect(cosaChiudeIndietro(niente, 'menu')).toBe(null);
    expect(cosaChiudeIndietro(niente, 'turno-giocatori')).toBe(null);
    expect(cosaChiudeIndietro(niente, 'turno-nemesi')).toBe(null);
    expect(cosaChiudeIndietro(niente, 'crea-mazzo')).toBe(null);
    expect(cosaChiudeIndietro(niente, 'nuova-partita')).toBe('menu');
  });

  it('con le finestre aperte chiude prima quella in cima, anche sopra la pagina Nuova partita', () => {
    expect(cosaChiudeIndietro({ ...niente, finestre: 2 }, 'turno-giocatori')).toBe('finestra');
    expect(cosaChiudeIndietro({ ...niente, finestre: 1 }, 'nuova-partita')).toBe('finestra');
    expect(cosaChiudeIndietro({ ...niente, finestre: 1, scarti: true, schermiCollezione: 1 }, 'menu')).toBe('finestra');
  });

  it('nel mazzo dei turni (schermata aperta come finestra) Indietro la chiude, come con ogni finestra', () => {
    expect(cosaChiudeIndietro({ ...niente, finestre: 1 }, 'mazzo-turni')).toBe('finestra');
    expect(cosaChiudeIndietro({ ...niente, finestre: 2 }, 'mazzo-turni')).toBe('finestra');
    expect(cosaChiudeIndietro(niente, 'mazzo-turni')).toBeNull();
  });

  it('schermataAttuale() senza il mazzo dei turni aperto non lo restituisce', () => {
    expect(schermataAttuale()).not.toBe('mazzo-turni');
  });

  it("l'ordine dei livelli: finestre, Annulla sospeso, Pesca carta, collezione e Opzioni, scarti", () => {
    expect(cosaChiudeIndietro({ ...niente, annullaSospeso: true, pescaCarta: true, scarti: true }, 'turno-giocatori')).toBe('annulla-sospeso');
    expect(cosaChiudeIndietro({ ...niente, pescaCarta: true, scarti: true }, 'turno-giocatori')).toBe('pesca-carta');
    expect(cosaChiudeIndietro({ ...niente, schermiCollezione: 2 }, 'menu')).toBe('collezione');
    expect(cosaChiudeIndietro({ ...niente, scarti: true }, 'turno-nemesi')).toBe('scarti');
  });

  it('il giro completo: Nuova partita con una finestra aperta, poi la pagina, poi il menu (niente da chiudere)', () => {
    impostaInizio('nuova-partita');
    const passi: (string | null)[] = [];
    let livelli: Livelli = { ...niente, finestre: 1 };
    for (let i = 0; i < 4; i++) {
      const what = cosaChiudeIndietro(livelli);
      passi.push(what);
      if (what === 'finestra') livelli = { ...livelli, finestre: livelli.finestre - 1 };
      else if (what === 'menu') impostaInizio('menu');
      else break;
    }
    expect(passi).toEqual(['finestra', 'menu', null]);
    expect(schermataAttuale()).toBe('menu');
  });
});
