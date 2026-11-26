// Il momento della schermata "partita" e le sue varianti (src/ui/partita-variante.ts, variantePartita): turno
// giocatori, turno nemesi, passo Pesca e "Crea mazzo", con e senza modifiche non salvate, e la carta guardata nel turno
// nemesi ("Torna alla carta da risolvere"). La partita è quella vera, cambiata dalle sue azioni (src/stato/partita.ts),
// con caso e orologio fissati. Il disegno delle zone (data-turno, pulsante, zona 6) si prova nel browser
// (tools/confronto/README.md).
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { caricaCatalogo } from '../src/stato/catalogo.ts';
import { preferenze } from '../src/stato/preferenze.ts';
import * as P from '../src/stato/partita.ts';
import { isDrawStep, makeEntry } from '../src/regole/turno-nemesi.ts';
import { DRAW_UID, ui } from '../src/ui/pagina.ts';
import { viewCard } from '../src/ui/schermate/turno-nemesi.ts';
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
  return { deckBuilding: false, drafts: new Map<number, BozzaCarta>(), viewedUid: null, ...cambi };
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
      expect(v.carteGrandi).toBe('coda');
      expect(v.annullaModifiche).toBe(false);
    }
  });

  it('turno giocatori senza modifiche: "Pesca carta turno", poi "Fine turno"', () => {
    let v = variante(partita, uiDi());
    expect(v).toEqual({ momento: 'giocatori', carteGrandi: 'coda', azione: 'pesca-carta-turno',
      testo: T.drawTurnCard, annullaModifiche: false });
    // Esce un giocatore: si resta nel turno giocatori
    finoA(() => !partita.resolving && !P.awaitingTurnCard());
    v = variante(partita, uiDi());
    expect(v.momento).toBe('giocatori');
    expect(v.azione).toBe('fine-turno');
    expect(v.testo).toBe(T.endTurn);
    // Il turno finisce: il turno dopo è da pescare (finestra "Pesca nuovo turno"), il pulsante torna "Pesca carta turno"
    P.fineTurnoGiocatore();
    v = variante(partita, uiDi());
    expect(v.azione).toBe('pesca-carta-turno');
    expect(v.testo).toBe(T.drawTurnCard);
  });

  it('turno giocatori con modifiche non salvate: "Salva modifiche" e "Annulla modifiche"', () => {
    const v = variante(partita, uiDi({ drafts: conModifiche() }));
    expect(v).toEqual({ momento: 'giocatori', carteGrandi: 'coda', azione: 'salva-modifiche',
      testo: T.saveChanges, annullaModifiche: true });
  });

  it('turno nemesi: carosello, niente zona 6, il pulsante risolve la carta di turno (le modifiche non contano)', () => {
    finoA(turnoNemesiConCarte);
    const active = must(partita.queue[partita.currentIndex], 'carta da risolvere');
    for (const drafts of [new Map<number, BozzaCarta>(), conModifiche()]) {
      const v = variante(partita, uiDi({ drafts, viewedUid: active.uid }));
      expect(v).toEqual({ momento: 'nemesi', carteGrandi: 'carosello', azione: 'risolvi',
        testo: actionText(active, false, T), annullaModifiche: false });
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
  });

  it('passo Pesca: carta coperta e "Pesca", anche se un\'altra carta risulta guardata (le carte piccole non si toccano)', () => {
    finoA(() => isDrawStep(partita) && partita.queue.length > 0);
    let v = variante(partita, uiDi({ viewedUid: DRAW_UID }));
    expect(v).toEqual({ momento: 'pesca', carteGrandi: 'carta-coperta', azione: 'pesca',
      testo: T.ctaDraw, annullaModifiche: false });
    v = variante(partita, uiDi({ viewedUid: partita.queue[0].uid, drafts: conModifiche() }));
    expect(v).toEqual({ momento: 'pesca', carteGrandi: 'carta-coperta', azione: 'pesca',
      testo: T.ctaDraw, annullaModifiche: false });
  });

  it('carta appena pescata: "Metti in gioco" (o "Effetto risolto" per un attacco), mai "Torna alla carta"', () => {
    finoA(() => partita.resolving && partita.newIndex >= 0);
    const drawn = partita.queue[partita.newIndex];
    for (const viewedUid of [drawn.uid, partita.queue[0].uid]) {
      const v = variante(partita, uiDi({ viewedUid }));
      expect(v.momento).toBe('nemesi');
      expect(v.azione).toBe('risolvi');
      expect(v.testo).toBe(actionText(drawn, true, T));
    }
  });

  it('passo Pesca e carta pescata: un tocco sulla fascia piccola non cambia carta mostrata né pulsante', () => {
    for (const quando of [() => isDrawStep(partita) && partita.queue.length > 1, () => partita.resolving && partita.newIndex >= 0 && partita.queue.length > 1]) {
      finoA(quando);
      const main = isDrawStep(partita) ? DRAW_UID : partita.queue[partita.newIndex].uid;
      ui.viewedUid = main;
      const altra = must(partita.queue.find(e => e.uid !== main), 'altra carta');
      const prima = variante(partita, ui);
      viewCard(altra.uid);
      expect(ui.viewedUid).toBe(main);
      expect(variante(partita, ui)).toEqual(prima);
    }
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
    expect(variantePartita(partita, uiDi(), EN).testo).toBe('End turn');
  });

  it('turno nemesi: Draw, Back to the card to resolve', () => {
    finoA(() => isDrawStep(partita) && partita.queue.length > 0);
    expect(variantePartita(partita, uiDi({ viewedUid: DRAW_UID }), EN).testo).toBe('Draw');
    // Al passo Pesca le carte piccole non si toccano: nessuna anteprima, resta "Draw"
    expect(variantePartita(partita, uiDi({ viewedUid: partita.queue[0].uid }), EN).testo).toBe('Draw');
    finoA(turnoNemesiConCarte);
    const other = must(partita.queue.find((e, i) => i !== partita.currentIndex), 'altra carta');
    expect(variantePartita(partita, uiDi({ viewedUid: other.uid }), EN).testo).toBe('Back to the card to resolve');
  });
});

// La carta appena pescata chiude il turno nemesi: il pulsante lo dice
describe('actionText(): carta appena pescata', () => {
  it('attacco: "Effetto risolto · Fine turno"; le altre carte: "Metti in gioco · Fine turno nemesi"', () => {
    const attack = must(cards.find(c => c.type === 'Attack'), 'un attacco');
    const power = must(cards.find(c => c.type === 'Power'), 'un potere');
    for (const T of [DIZIONARI.it, DIZIONARI.en]) {
      expect(actionText(makeEntry(attack, 1, 1), true, T)).toBe(T.ctaAttackEnd);
      expect(actionText(makeEntry(power, 2, 1), true, T)).toBe(T.ctaPutInPlayEnd);
      // un attacco già in coda (non appena pescato) resta "Effetto risolto"
      expect(actionText(makeEntry(attack, 1, 1), false, T)).toBe(T.ctaResolved);
    }
    expect(DIZIONARI.it.ctaAttackEnd).toBe('Effetto risolto · Fine turno');
  });
});
