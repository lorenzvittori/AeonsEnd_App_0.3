// Il momento della schermata "partita" e le sue varianti (src/ui/partita-variante.ts, variantePartita): turno
// giocatori, turno nemesi, passo Pesca e "Crea mazzo", con e senza modifiche non salvate, e la carta guardata nel turno
// nemesi ("Torna alla carta da risolvere"). La partita è quella vera, cambiata dalle sue azioni (src/stato/partita.ts),
// con caso e orologio fissati. Il disegno delle zone (data-turno, pulsante, zona 6) si prova nel browser
// (CONTESTO_SVILUPPO.md, sezione 9).
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { caricaCatalogo } from '../src/stato/catalogo.ts';
import { preferenze } from '../src/stato/preferenze.ts';
import * as P from '../src/stato/partita.ts';
import { isDrawStep } from '../src/regole/turno-nemesi.ts';
import { DRAW_UID } from '../src/ui/pagina.ts';
import { actionText, variantePartita } from '../src/ui/partita-variante.ts';
import type { UiPerVariante } from '../src/ui/partita-variante.ts';
import { DIZIONARI } from '../src/ui/testi.ts';
import type { BozzaCarta } from '../src/tipi/partita.ts';
import { cards, deckSetup, nemeses, products, seeded, must } from './aiuto.ts';

const { partita } = P;

function fissa(seed: number): void {
  vi.spyOn(Math, 'random').mockImplementation(seeded(seed));
  let now = 1700000000000;
  vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
}

// Stato dell'interfaccia che conta per le varianti (come ui di src/ui/pagina.ts)
function uiDi(cambi: Partial<UiPerVariante> = {}): UiPerVariante {
  return { deckBuilding: false, drafts: new Map<number, BozzaCarta>(), trackShuffle: false, viewedUid: null, holdUid: null, ...cambi };
}

// Modifiche non salvate su una carta (bozza della vita di un minion)
function conModifiche(): Map<number, BozzaCarta> {
  return new Map<number, BozzaCarta>([[1, { hp: 3 }]]);
}

// Un passo della partita, come il pulsante principale: carta turno, fine turno, risolvi, pesca
function passo(): void {
  if (!partita.resolving) {
    if (P.awaitingTurnCard()) { P.pescaCartaTurno(); return; }
    const cur = P.currentTurn();
    if (cur && P.isPairCard(cur.kind) && !cur.player) { P.scegliGiocatoreCoppia(P.pairOptions(cur.kind)[0]); return; }
    P.fineTurnoGiocatore();
    return;
  }
  if (isDrawStep(partita)) { P.pescaCarta(); return; }
  const a = must(partita.queue[partita.currentIndex], 'carta da risolvere');
  if (P.hpUnset(a)) P.cambiaVitaMinion(a, 5, true);
  else P.risolviCarta();
}

// Si gioca finché vale la condizione (al massimo 400 passi)
function finoA(cond: () => boolean): void {
  for (let i = 0; i < 400 && !cond(); i++) passo();
  expect(cond()).toBe(true);
}

// Turno nemesi con una carta da risolvere (non la carta appena pescata) e almeno un'altra carta in gioco
function turnoNemesiConCarte(): boolean {
  return partita.resolving && !isDrawStep(partita) && partita.newIndex < 0 && partita.queue.length > 1;
}

// Le prove si ripetono in italiano e in inglese: variantePartita riceve i testi come parametro
describe.each([['it', DIZIONARI.it], ['en', DIZIONARI.en]] as const)('variantePartita() in %s', (_lingua, T) => {
  const variante = (p: Parameters<typeof variantePartita>[0], ui: UiPerVariante) => variantePartita(p, ui, T);
  beforeAll(() => {
    caricaCatalogo({ cards, nemeses, deckSetup, products, nemesisArt: {} });
    preferenze.collection = new Set(Object.keys(products));
  });
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    fissa(5);
    preferenze.settings = { players: 2, nemesis: 'Maggoth', battleMode: true, mergeCollection: true };
    P.nuovaPartita();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('"Crea mazzo": cursore al posto del pulsante, stessa disposizione del turno giocatori', () => {
    for (const drafts of [new Map<number, BozzaCarta>(), conModifiche()]) {
      const v = variante(partita, uiDi({ deckBuilding: true, drafts }));
      expect(v.momento).toBe('crea-mazzo');
      expect(v.azione).toBe('cursore');
      expect(v.interattivi).toBe(true);
      expect(v.carteGrandi).toBe('coda');
      expect(v.annullaModifiche).toBe(false);
    }
  });

  it('turno giocatori senza modifiche: "Pesca carta turno", poi "Fine turno"', () => {
    let v = variante(partita, uiDi());
    expect(v).toEqual({ momento: 'giocatori', interattivi: true, carteGrandi: 'coda', azione: 'pesca-carta-turno',
      testo: T.drawTurnCard, annullaModifiche: false });
    // Esce un giocatore: si resta nel turno giocatori
    finoA(() => !partita.resolving && !P.awaitingTurnCard());
    v = variante(partita, uiDi());
    expect(v.momento).toBe('giocatori');
    expect(v.azione).toBe('fine-turno');
    expect([T.endTurn, T.endTurnShuffle]).toContain(v.testo);
    // Durante il mazzo dei turni mischiato: "Fine turno · Mischia mazzo"
    expect(variante(partita, uiDi({ trackShuffle: true })).testo).toBe(T.endTurnShuffle);
  });

  it('turno giocatori con modifiche non salvate: "Salva modifiche" e "Annulla modifiche"', () => {
    const v = variante(partita, uiDi({ drafts: conModifiche() }));
    expect(v).toEqual({ momento: 'giocatori', interattivi: true, carteGrandi: 'coda', azione: 'salva-modifiche',
      testo: T.saveChanges, annullaModifiche: true });
  });

  it('turno nemesi: carosello, niente zona 6, il pulsante risolve la carta di turno (le modifiche non contano)', () => {
    finoA(turnoNemesiConCarte);
    const active = must(partita.queue[partita.currentIndex], 'carta da risolvere');
    for (const drafts of [new Map<number, BozzaCarta>(), conModifiche()]) {
      const v = variante(partita, uiDi({ drafts, viewedUid: active.uid }));
      expect(v).toEqual({ momento: 'nemesi', interattivi: false, carteGrandi: 'carosello', azione: 'risolvi',
        testo: actionText(active, false, P.turnRoundOver(), T), annullaModifiche: false });
    }
    // Nessuna carta guardata ancora: si mostra quella da risolvere
    expect(variante(partita, uiDi()).azione).toBe('risolvi');
  });

  it('turno nemesi, si guarda un\'altra carta: "Torna alla carta da risolvere"', () => {
    finoA(turnoNemesiConCarte);
    const other = must(partita.queue.find((e, i) => i !== partita.currentIndex), 'altra carta');
    const v = variante(partita, uiDi({ viewedUid: other.uid }));
    expect(v.momento).toBe('nemesi');
    expect(v.azione).toBe('torna');
    expect(v.testo).toBe(T.backToActive);
    // Mentre la carta appena risolta resta in primo piano (holdUid) non è un'anteprima
    expect(variante(partita, uiDi({ viewedUid: other.uid, holdUid: other.uid })).azione).toBe('risolvi');
  });

  it('passo Pesca: carta coperta, "Pesca" o "Torna alla carta da pescare"', () => {
    finoA(() => isDrawStep(partita) && partita.queue.length > 0);
    let v = variante(partita, uiDi({ viewedUid: DRAW_UID }));
    expect(v).toEqual({ momento: 'pesca', interattivi: false, carteGrandi: 'carta-coperta', azione: 'pesca',
      testo: T.ctaDraw, annullaModifiche: false });
    v = variante(partita, uiDi({ viewedUid: partita.queue[0].uid, drafts: conModifiche() }));
    expect(v.momento).toBe('pesca');
    expect(v.azione).toBe('torna');
    expect(v.testo).toBe(T.backToDraw);
  });

  it('carta appena pescata: "Metti in gioco" (o "Effetto risolto" per un attacco)', () => {
    finoA(() => partita.resolving && partita.newIndex >= 0);
    const drawn = partita.queue[partita.newIndex];
    const v = variante(partita, uiDi({ viewedUid: drawn.uid }));
    expect(v.momento).toBe('nemesi');
    expect(v.azione).toBe('risolvi');
    expect(v.testo).toBe(actionText(drawn, true, P.turnRoundOver(), T));
  });

  it('è pura: non cambia la partita né lo stato dell\'interfaccia', () => {
    finoA(turnoNemesiConCarte);
    const u = uiDi({ drafts: conModifiche(), viewedUid: partita.queue[0].uid });
    const prima = JSON.stringify({ partita, u, drafts: [...u.drafts] });
    variante(partita, u);
    expect(JSON.stringify({ partita, u, drafts: [...u.drafts] })).toBe(prima);
  });
});

// I testi dei pulsanti principali in inglese (esatti: sono la scritta che si legge sul pulsante)
describe('variantePartita() in inglese: testo del pulsante principale', () => {
  const EN = DIZIONARI.en;
  beforeAll(() => {
    caricaCatalogo({ cards, nemeses, deckSetup, products, nemesisArt: {} });
    preferenze.collection = new Set(Object.keys(products));
  });
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    fissa(5);
    preferenze.settings = { players: 2, nemesis: 'Maggoth', battleMode: true, mergeCollection: true };
    P.nuovaPartita();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('turno giocatori: Draw turn card, Save changes, End turn', () => {
    expect(variantePartita(partita, uiDi(), EN).testo).toBe('Draw turn card');
    expect(variantePartita(partita, uiDi({ drafts: conModifiche() }), EN).testo).toBe('Save changes');
    finoA(() => !partita.resolving && !P.awaitingTurnCard());
    expect(['End turn · Draw turn card', 'End turn · Shuffle deck']).toContain(variantePartita(partita, uiDi(), EN).testo);
    expect(variantePartita(partita, uiDi({ trackShuffle: true }), EN).testo).toBe('End turn · Shuffle deck');
  });

  it('turno nemesi: Draw, Back to the card to draw / resolve', () => {
    finoA(() => isDrawStep(partita) && partita.queue.length > 0);
    expect(variantePartita(partita, uiDi({ viewedUid: DRAW_UID }), EN).testo).toBe('Draw');
    expect(variantePartita(partita, uiDi({ viewedUid: partita.queue[0].uid }), EN).testo).toBe('Back to the card to draw');
    finoA(turnoNemesiConCarte);
    const other = must(partita.queue.find((e, i) => i !== partita.currentIndex), 'altra carta');
    expect(variantePartita(partita, uiDi({ viewedUid: other.uid }), EN).testo).toBe('Back to the card to resolve');
  });
});
