// regole/salvataggio.ts: fotografia della partita (salvataggio nel browser e undo) e ripristino, anche dai formati vecchi.
// Riceve `g`, la partita (tipo Partita in tipi/partita.ts) e, per il ripristino, `ctx` (ContestoRipristino qui sotto):
// le carte per id, gli uid nuovi, i giocatori, le nemesi (vita iniziale), il caso e le carte del mazzo dei turni.
// Restituisce oggetti nuovi; non cambia `g` né la fotografia.
// Dipende da: regole/mazzo-turni.ts, regole/turno-nemesi.ts, regole/vite.ts, regole/json.ts, tipi/.
// Usato da: stato/salvataggio.ts (snapshot, restore, save, readSave), test in tests/salvataggio.test.ts.
//
// Formato della fotografia: Fotografia in tipi/salvataggio.ts (il salvataggio è { version, settings, state, undo }).
// Lettura dei salvataggi senza i campi più recenti (FotografiaLetta): maxTierDrawn = Tier più alto tra coda e scarti;
// vite = valori iniziali; stats da zero (mazzo iniziale = tutte le carte); turnHp = hp; bornTurn = turn; hpMax (minion
// a vita variabile già impostata) = la più alta tra vita e vita di inizio turno; mazzo dei turni: restoreTurnOrder.

import { restoreTurnOrder, emptyPairNext } from './mazzo-turni.ts';
import type { Caso } from './caso.ts';
import { emptyStats, isVariableMinion, makeEntry } from './turno-nemesi.ts';
import { GRAVEHOLD_LIFE, nemesisStartLife } from './vite.ts';
import { isRecord, jsonCopy } from './json.ts';
import type { Carta, Nemesi } from '../tipi/dati.ts';
import type { CartaTurno, Impostazioni, Partita, VoceInGioco } from '../tipi/partita.ts';
import type { Fotografia, FotografiaLetta, Salvataggio, SalvataggioValido } from '../tipi/salvataggio.ts';

// Quello che serve al ripristino oltre alla fotografia
export interface ContestoRipristino {
  cardsById: ReadonlyMap<string, Carta>;   // carte di cards.json per id
  newUid: () => number;                    // uid nuovo per ogni carta in gioco
  players: number;                         // giocatori della partita
  nemeses: readonly Nemesi[];              // nemesis.json (vita iniziale della nemesi)
  nemesisName: string | null;              // nemesi della partita
  random: Caso;                            // caso (solo per il mazzo dei turni dei salvataggi vecchi)
  cards: () => CartaTurno[];               // carte del mazzo dei turni per un giro nuovo
}

// Cosa mostrare dopo il ripristino
export interface VistaRipristino {
  viewed: 'draw' | number | null;          // 'draw' = passo Pesca, uid della carta da risolvere, null = turno giocatori
  lastDrawnUid: number | null;             // uid della carta appena pescata
  anchor: { uid: number; align: 'center' | 'anchor' } | null; // carta più recente da mostrare nel turno giocatori
}

// Esito del controllo di un salvataggio letto dal browser
export type StatoSalvataggio = 'ok' | 'other-version' | null;

// Fotografia (solo dati semplici: le carte come id)
export function snapshotGame(g: Partita): Fotografia {
  return {
    turn: g.turn,
    deck: g.deck.map(c => c.id),
    discard: g.discard.map(c => c.id),
    queue: g.queue.map(e => ({ id: e.data.id, tokens: e.tokens, hp: e.hp, turnHp: e.turnHp, isNew: !!e.isNew, paid: !!e.paid, bornTurn: e.bornTurn,
      ...(isVariableMinion(e.data) ? { hpSet: !!e.hpSet, hpMax: typeof e.hpMax === 'number' ? e.hpMax : null } : {}) })),
    resolving: g.resolving,
    currentIndex: g.currentIndex,
    newIndex: g.newIndex,
    maxTierDrawn: g.maxTierDrawn,
    graveLife: g.graveLife,
    nemesisLife: g.nemesisLife,
    stats: jsonCopy(g.stats),
    turnOrder: { left: g.turnOrder.left.slice(), drawn: g.turnOrder.drawn.slice(), round: g.turnOrder.round, wild: g.turnOrder.wild || null,
      picks: jsonCopy(g.turnOrder.picks || {}),
      pairNext: emptyPairNext(g.turnOrder.pairNext),
      history: jsonCopy(g.turnOrder.history || []),
      known: g.turnOrder.left.map((k, i) => !!(g.turnOrder.known && g.turnOrder.known[i])), waiting: !!g.turnOrder.waiting }
  };
}

// Ripristino. Prima si leggono tutte le carte: una carta sconosciuta è un errore (Error "Carta sconosciuta: id") prima
// di creare qualcosa. Restituisce { game, view }:
// - game: i campi della partita (da scrivere nello stato);
// - view: cosa mostrare (VistaRipristino).
// Nel turno nemesi currentIndex si limita all'ultima carta della coda (bug noto in CONTESTO, sezione 6: al passo Pesca
// con carte in coda si torna all'ultima carta da risolvere). Il caso (random) si usa solo per il mazzo dei turni.
export function restoreGame(s: FotografiaLetta, ctx: ContestoRipristino): { game: Partita; view: VistaRipristino } {
  const get = (id: string): Carta => {
    const card = ctx.cardsById.get(id);
    if (!card) throw new Error('Carta sconosciuta: ' + id);
    return card;
  };
  const deck = s.deck.map(get);
  const discard = s.discard.map(get);
  const queue: VoceInGioco[] = s.queue.map(q => {
    const data = get(q.id);
    return Object.assign(makeEntry(data, ctx.newUid(), s.turn), {
      tokens: q.tokens, hp: q.hp, turnHp: q.turnHp === undefined ? q.hp : q.turnHp, isNew: !!q.isNew, paid: !!q.paid,
      bornTurn: typeof q.bornTurn === 'number' ? q.bornTurn : s.turn
    }, isVariableMinion(data) ? { hpSet: !!q.hpSet,
      hpMax: typeof q.hpMax === 'number' ? q.hpMax : (q.hpSet ? Math.max(q.hp || 0, q.turnHp || 0) : undefined) } : {});
  });
  // Tier come numero, come nel Math.max di JavaScript (null vale 0)
  const maxTierDrawn = typeof s.maxTierDrawn === 'number' ? s.maxTierDrawn
    : Math.max(0, ...queue.map(e => Number(e.data.tier || 0)), ...discard.map(c => Number(c.tier || 0)));
  const graveLife = typeof s.graveLife === 'number' ? s.graveLife : GRAVEHOLD_LIFE;
  const nemesisLife = typeof s.nemesisLife === 'number' ? s.nemesisLife : nemesisStartLife(ctx.nemeses, ctx.nemesisName);
  const stats = Object.assign(emptyStats(deck.length + queue.length + discard.length), s.stats ? jsonCopy(s.stats) : {});
  stats.minions = Array.isArray(stats.minions) ? stats.minions : [];
  stats.cards = Object.assign(emptyStats(0).cards, stats.cards || {});
  stats.tierAt = Object.assign({}, stats.tierAt || {});
  stats.mages = stats.mages && typeof stats.mages === 'object' ? stats.mages : {};
  const view: VistaRipristino = { viewed: null, lastDrawnUid: null, anchor: null };
  let resolving: boolean;
  let currentIndex: number;
  let newIndex: number;
  if (s.resolving && queue.length === 0 && deck.length > 0) {
    resolving = true;
    currentIndex = 0;
    newIndex = -1;
    view.viewed = 'draw';
  } else if (s.resolving && queue.length > 0) {
    resolving = true;
    currentIndex = Math.max(0, Math.min(s.currentIndex, queue.length - 1));
    newIndex = s.newIndex >= 0 ? Math.min(s.newIndex, queue.length - 1) : -1;
    if (newIndex >= 0) view.lastDrawnUid = queue[newIndex].uid;
    view.viewed = queue[currentIndex].uid;
  } else {
    resolving = false;
    currentIndex = 0;
    newIndex = -1;
    if (queue.length) view.anchor = { uid: queue[queue.length - 1].uid, align: queue.length === 1 ? 'center' : 'anchor' };
  }
  const turnOrder = restoreTurnOrder(s.turnOrder, { players: ctx.players, resolving, turn: s.turn,
    random: ctx.random, cards: ctx.cards });
  const game: Partita = { deck, discard, turn: s.turn, queue, maxTierDrawn, graveLife, nemesisLife, stats, resolving,
    currentIndex, newIndex, turnOrder };
  return { game, view };
}

// Salvataggio che si può riprendere: un oggetto con le scelte e una partita con la coda (controllo leggero: il resto
// della fotografia si legge con i default di restoreGame)
export function isResumableSave(saved: unknown): saved is SalvataggioValido {
  return isRecord(saved) && isRecord(saved.state) && !!saved.settings && Array.isArray(saved.state.queue);
}

// Salvataggio letto dal browser (già convertito da JSON): 'ok' se si può riprendere, 'other-version' se è di un'altra
// versione del formato (si cancella: per esempio quelli di prima della v210, con gli id vecchi delle carte), null se
// manca o non è valido
export function checkSave(saved: unknown, version: number): StatoSalvataggio {
  // Qualsiasi valore (anche non un oggetto) senza la versione giusta è di un'altra versione
  if (saved) {
    const savedVersion = typeof saved === 'object' && 'version' in saved ? saved.version : undefined;
    if (savedVersion !== version) return 'other-version';
  }
  if (isResumableSave(saved)) return 'ok';
  return null;
}

// Salvataggio da scrivere nel browser
export function buildSave(version: number, settings: Impostazioni, state: Fotografia, undo: FotografiaLetta[]): Salvataggio {
  return { version, settings, state, undo };
}
