// ui/finestre/test.ts: la Modalità test: schermata con l'elenco degli scenari (dal menu iniziale), scenari (SCENARI,
// trasformati in una fotografia da buildScenarioState), avvio e nuovo avvio di uno scenario, uscita dal test.
// Isolata dalla partita vera: niente salvataggio (save() non scrive con testRun), la partita salvata e "Riprendi
// partita" restano com'erano. Uno scenario partito lascia la pagina iniziale con l'aggancio vaiAllaPartitaDaScenario.
// Durante lo scenario c'è il pannello "Regolazioni" (colori e misure, test-regolazioni.ts), che sparisce con l'uscita.
// Livello 4 (ui/finestre/). Dipende da: stato/ (partita, catalogo, preferenze), dati/rete.ts, regole/json.ts, ui/ base
// (testi, pagina, dom, ridisegno), ui/componenti (animazioni, dialoghi, ripristino, scarti). Usato da: schermata menu
// iniziale, navigazione (Esci dal test, Ricomincia lo scenario), main.ts (app.startScenario, app.SCENARI).

import { T } from '../testi.ts';
import { aetherCost, emptyPairNext, emptyStats, esciDalTest, impostaUndo, iniziaProva, isVariableMinion, makeEntry,
  partita } from '../../stato/partita.ts';
import { closeAllModals, showToast, updateInert } from '../componenti/dialoghi.ts';
import { closeDiscard } from '../componenti/scarti.ts';
import { prefetchDeckImages } from '../../dati/rete.ts';
import { jsonCopy } from '../../regole/json.ts';
import type { Carta } from '../../tipi/dati.ts';
import type { CartaTurno, Giocatore, MemoriaCoppie, SceltaCoppia, StatisticheMago } from '../../tipi/partita.ts';
import type { FotografiaLetta, VoceLetta } from '../../tipi/salvataggio.ts';
import { catalogo } from '../../stato/catalogo.ts';
import { preferenze } from '../../stato/preferenze.ts';
import { pulsantePrincipale, startLayer, ui } from '../pagina.ts';
import { clearTransition } from '../componenti/animazioni.ts';
import { el, icon, query } from '../dom.ts';
import { richiediRidisegno, vaiAllaPartitaDaScenario } from '../ridisegno.ts';
import { restore } from '../componenti/ripristino.ts';
import { avviaRegolazioni, terminaRegolazioni } from './test-regolazioni.ts';

// --- Modalità test --------------------------------------------------------------------------------------------------
// Dal menu iniziale ("Test") si sceglie uno scenario: la partita parte già in un momento preciso, senza giocarla fino
// lì. Isolata dalla partita vera: niente salvataggio (save() non scrive con testRun), la partita salvata e "Riprendi
// partita" non cambiano; la collezione non conta (le carte le sceglie lo scenario); le preferenze (dorso, sfondo,
// opzioni del mazzo, carte 1/2 e 3/4) non si toccano: lo scenario può solo sostituirle finché dura (testRun.pairs,
// testRun.turnCards). L'undo funziona come in partita.
//
// SCENARI: i dati di ogni scenario, tutti qui. Campi:
//   id, name, desc            identificatore, nome e riga di descrizione (schermata Test)
//   players, nemesis          giocatori e nemesi (nome come in nemesis.json)
//   phase                     'players' (turno giocatori) o 'nemesis' (turno nemesi: con la coda vuota si parte pronti a
//                             pescare, altrimenti dalla prima carta della coda da risolvere)
//   deck                      mazzo nemesi DALLA CIMA (la prima è la prossima pescata)
//   queue                     carte già in gioco, dalla più vecchia: nome o { name, hp, tokens, hpSet, bornTurn }
//   discard                   pila degli scarti (dalla prima scartata)
//   (carte per NOME; { name, boxCode } quando il nome è di più carte, per esempio Sunder "1" e "4")
//   turnOrder                 { left: dalla cima, drawn: scarti dei turni (l'ultima è il turno in corso), round, wild,
//                             picks: { pos: { player, forced } }, pairNext: { p12, p34 } } con 'p1'..'p4', 'wild',
//                             'nemesis', 'p12', 'p34' (picks e pairNext: carte 1/2 e 3/4)
//   turnCards                 (facoltativo) carte del mazzo dei turni per i giri nuovi, al posto di quelle normali
//   pairs                     (facoltativo) carte 1/2 e 3/4 attive o no solo per lo scenario
//   turn, maxTier             turni nemesi giocati e Tier più alto già uscito (per la scritta "Tier N")
//   graveLife, nemesisLife    (facoltativi) vite di Gravehold e della nemesi
//   stats                     (facoltativo) { startedMinAgo, tierMinAgo: { 2, 3 }, minionsKilled: [{ name, turns }],
//                             powersPaid, powersResolved, attacksResolved (nomi), mages: { p1: { damage, powers, kills } } }
// Per aggiungere uno scenario basta un oggetto in più qui sotto (CONTESTO_SVILUPPO.md, sezione 9).
// Una carta di uno scenario: il nome, o { name, boxCode } quando il nome è di più carte
export type CartaScenario = string | { name: string; boxCode?: string };

// Una carta in gioco di uno scenario: il nome, o il nome con lo stato
export type VoceScenario = string | { name: string; boxCode?: string; hp?: number; tokens?: number; hpSet?: boolean; bornTurn?: number };

// Uno scenario della Modalità test (campi descritti qui sopra)
export interface Scenario {
  id: string;
  name: string;
  desc: string;
  players: number;
  nemesis: string;
  phase: 'players' | 'nemesis';
  deck?: CartaScenario[];
  queue?: VoceScenario[];
  discard?: CartaScenario[];
  turnOrder?: { left?: CartaTurno[]; drawn?: CartaTurno[]; round?: number; wild?: number | null;
    picks?: Record<number, SceltaCoppia>; pairNext?: Partial<MemoriaCoppie> };
  turnCards?: CartaTurno[];
  pairs?: boolean;
  turn?: number;
  maxTier?: number;
  graveLife?: number;
  nemesisLife?: number;
  stats?: {
    startedMinAgo?: number;
    tierMinAgo?: Record<number, number>;
    minionsKilled?: { name: string; turns?: number }[];
    powersPaid?: CartaScenario[];
    powersResolved?: CartaScenario[];
    attacksResolved?: CartaScenario[];
    mages?: Partial<Record<Giocatore, StatisticheMago>>;
  };
}

export const SCENARI: Scenario[] = [
  {
    id: 'turn-deck', name: T.testScenari.turnDeck.name,
    desc: T.testScenari.turnDeck.desc,
    players: 2, nemesis: 'Maggoth', phase: 'nemesis', turn: 1, maxTier: 1,
    deck: ['Hissing Acid', { name: 'Sunder', boxCode: '4' }, 'Thunderous Tempest', 'Drillbeak Wurm', 'Rend', 'Morbid Gyre'],
    turnCards: ['nemesis', 'nemesis', 'nemesis', 'nemesis', 'nemesis', 'nemesis'],
    turnOrder: { left: ['nemesis', 'nemesis', 'nemesis', 'nemesis', 'nemesis'], drawn: ['nemesis'], round: 1 }
  },
  {
    id: 'variable-hp', name: T.testScenari.variableHp.name,
    desc: T.testScenari.variableHp.desc,
    players: 2, nemesis: 'Carapace Queen', phase: 'nemesis', turn: 1, maxTier: 3,
    deck: ['Maggot Engine', 'Mindguzzler', 'Broodwomb', 'Hatch'],
    turnOrder: { left: ['p1', 'nemesis', 'p2', 'p1', 'p2'], drawn: ['nemesis'], round: 1 }
  },
  {
    id: 'tier', name: T.testScenari.tier.name,
    desc: T.testScenari.tier.desc,
    players: 2, nemesis: 'Maggoth', phase: 'nemesis', turn: 3, maxTier: 1,
    queue: ['Drillbeak Wurm'],
    deck: ['Volcanic Zala', 'Crushing Storm', 'Eliminate', 'Gore'],
    turnOrder: { left: ['nemesis', 'p1', 'p2', 'p1', 'p2'], drawn: ['nemesis'], round: 1 }
  },
  {
    id: 'full-queue', name: T.testScenari.fullQueue.name,
    desc: T.testScenari.fullQueue.desc,
    players: 2, nemesis: 'Arachnos', phase: 'players', turn: 4, maxTier: 3,
    queue: ['Volcanic Zala', { name: 'Carriode Colony', hp: 3 }, { name: 'Blind Enigma', hp: 2 },
      'Morbid Gyre', 'Eye of Nothing', 'Chaos Orb', 'The End', { name: 'Spirit Snare', tokens: 5 },
      { name: 'Woven Sky', tokens: 7 }, 'Bleed Static'],
    deck: ['Gore', 'Eliminate'],
    turnOrder: { left: ['nemesis', 'p2', 'p1', 'nemesis', 'p2'], drawn: ['p1'], round: 2 }
  },
  {
    id: 'victory', name: T.testScenari.victory.name,
    desc: T.testScenari.victory.desc,
    players: 2, nemesis: 'Maggoth', phase: 'players', turn: 9, maxTier: 3,
    queue: [{ name: 'Drillbeak Wurm', hp: 1 }],
    deck: ['Morbid Gyre'],
    turnOrder: { left: ['nemesis', 'p2', 'p1', 'nemesis', 'p2'], drawn: ['p1'], round: 3 },
    stats: { startedMinAgo: 45, tierMinAgo: { 2: 28, 3: 10 } }
  },
  {
    id: 'pairs', name: T.testScenari.pairs.name,
    desc: T.testScenari.pairs.desc,
    players: 4, nemesis: 'Maggoth', phase: 'players', turn: 1, maxTier: 1, pairs: true,
    queue: ['Carriode Colony'],
    deck: ['Drillbeak Wurm', 'Rend', 'Disorient', 'Blind Enigma'],
    // Il 4 ha scelto la 3/4, quindi la prossima 3/4 tocca al 3; nessuno per la 1/2: si sceglie
    turnOrder: { left: ['p12', 'nemesis', 'p34', 'p12', 'nemesis'], drawn: ['p34'], picks: { 0: { player: 'p4', forced: false } },
      pairNext: { p12: null, p34: 'p3' }, round: 1 }
  },
  {
    id: 'pair-memory', name: T.testScenari.pairMemory.name,
    desc: T.testScenari.pairMemory.desc,
    players: 4, nemesis: 'Maggoth', phase: 'players', turn: 3, maxTier: 1, pairs: true,
    queue: ['Carriode Colony'],
    deck: ['Drillbeak Wurm', 'Rend', 'Disorient', 'Blind Enigma'],
    turnOrder: { left: ['p12', 'nemesis', 'p34', 'p12', 'nemesis'], drawn: ['p34'], picks: { 0: { player: 'p3', forced: false } },
      pairNext: { p12: 'p2', p34: 'p4' }, round: 2 }
  },
  {
    id: 'wild-round', name: T.testScenari.wildRound.name,
    desc: T.testScenari.wildRound.desc,
    players: 3, nemesis: 'Maggoth', phase: 'players', turn: 4, maxTier: 2,
    queue: [{ name: 'Volcanic Zala', hp: 6 }],
    deck: ['Gore', 'Eliminate', 'Crushing Storm'],
    turnOrder: { left: [], drawn: ['p1', 'nemesis', 'p2', 'nemesis', 'p3', 'wild'], round: 2, wild: 2 }
  },
  {
    id: 'full-stats', name: T.testScenari.fullStats.name,
    desc: T.testScenari.fullStats.desc,
    players: 2, nemesis: 'Maggoth', phase: 'players', turn: 8, maxTier: 3,
    queue: [{ name: 'Jagged One', hp: 9, bornTurn: 5 }, { name: 'Chaos Orb', tokens: 1, bornTurn: 7 }],
    discard: ['Drillbeak Wurm', 'Rend', 'Carriode Colony', 'Disorient', 'Morbid Gyre', 'Blind Enigma', 'Eye of Nothing',
      'Aether Shock', 'Woven Sky'],
    deck: ['Gore', 'Eliminate', 'Crushing Storm', 'Gnashing Maw'],
    turnOrder: { left: ['nemesis', 'p2', 'p1'], drawn: ['p2', 'nemesis', 'p1'], round: 3 },
    stats: {
      startedMinAgo: 52, tierMinAgo: { 2: 31, 3: 9 },
      minionsKilled: [{ name: 'Drillbeak Wurm', turns: 1 }, { name: 'Carriode Colony', turns: 3 }, { name: 'Blind Enigma', turns: 2 }],
      powersPaid: ['Morbid Gyre', 'Eye of Nothing'], powersResolved: ['Woven Sky'],
      attacksResolved: ['Rend', 'Disorient', 'Aether Shock'],
      mages: { p1: { damage: 14, powers: 1, kills: 2 }, p2: { damage: 9, powers: 1, kills: 1 } }
    }
  },
  {
    id: 'empty-deck', name: T.testScenari.emptyDeck.name,
    desc: T.testScenari.emptyDeck.desc,
    players: 2, nemesis: 'Maggoth', phase: 'players', turn: 11, maxTier: 3,
    queue: [{ name: 'Volcanic Zala', hp: 4 }],
    deck: [],
    turnOrder: { left: ['nemesis', 'p2', 'p1', 'nemesis'], drawn: ['p1', 'p2'], round: 4 }
  },
  {
    id: 'low-lives', name: T.testScenari.lowLives.name,
    desc: T.testScenari.lowLives.desc,
    players: 2, nemesis: 'Maggoth', phase: 'players', turn: 6, maxTier: 2,
    queue: [{ name: 'Volcanic Zala', hp: 6 }],
    deck: ['Gore', 'Eliminate', 'Crushing Storm'],
    turnOrder: { left: ['nemesis', 'p2', 'p1', 'nemesis'], drawn: ['p1', 'p2'], round: 2 },
    graveLife: 3, nemesisLife: 3
  }
];

// Carta di uno scenario: nome (o { name, boxCode }); errore se non c'è o se il nome è di più carte
export function scenarioCard(ref: CartaScenario): Carta {
  const name = typeof ref === 'string' ? ref : ref.name;
  const box = typeof ref === 'object' && ref.boxCode !== undefined ? String(ref.boxCode) : null;
  const found = catalogo.allCards.filter(c => c.name === name && (box === null || c.boxCode === box));
  if (!found.length) throw new Error(T.testCardMissing(box ? `${name} (${box})` : name));
  if (found.length > 1) throw new Error(T.testCardAmbiguous(name));
  return found[0];
}

// Fotografia della partita (stesso formato di snapshot) costruita dai dati dello scenario; la applica restore()
export function buildScenarioState(sc: Scenario): FotografiaLetta {
  const now = Date.now();
  const ago = (m: number) => now - m * 60000;
  const turnNo = sc.turn || 0;
  const deckCards = (sc.deck || []).map(scenarioCard);
  const queueCards = (sc.queue || []).map(ref => ({ ref: typeof ref === 'string' ? { name: ref } : ref, data: scenarioCard(ref) }));
  const discardCards = (sc.discard || []).map(scenarioCard);
  const st = sc.stats || {};
  const ids = (list: CartaScenario[] | undefined) => (list || []).map(n => scenarioCard(n).id);
  const killed = (st.minionsKilled || []).map(m => ({ id: scenarioCard(m.name).id, name: m.name, turns: m.turns || 0 }));
  const paid = ids(st.powersPaid);
  const stats = Object.assign(emptyStats(deckCards.length + queueCards.length + discardCards.length), {
    minionsKilled: killed.length, powersPaid: paid.length, powersResolved: (st.powersResolved || []).length,
    attacksResolved: (st.attacksResolved || []).length,
    aetherSpent: paid.reduce((sum, id) => { const card = catalogo.cardsById.get(id); return sum + (card ? aetherCost(card) : 0); }, 0),
    minions: killed, mages: jsonCopy(st.mages || {}),
    cards: { minionsKilled: killed.map(m => m.id), powersPaid: paid, powersResolved: ids(st.powersResolved),
      attacksResolved: ids(st.attacksResolved) },
    startedAt: ago(st.startedMinAgo || 0), tierAt: {}, endedAt: null
  });
  Object.entries(st.tierMinAgo || {}).forEach(([tier, m]) => { stats.tierAt[Number(tier)] = ago(m); });
  const order = sc.turnOrder || { left: [], drawn: [] };
  const queue: VoceLetta[] = queueCards.map(({ ref, data }) => {
    const base = makeEntry(data);
    const hp = ref.hp !== undefined ? ref.hp : base.hp;
    return { id: data.id, tokens: ref.tokens !== undefined ? ref.tokens : base.tokens, hp,
      turnHp: ref.hp !== undefined ? ref.hp : base.turnHp, isNew: false, paid: false,
      bornTurn: ref.bornTurn !== undefined ? ref.bornTurn : Math.max(0, turnNo - 1),
      ...(isVariableMinion(data) ? { hpSet: !!ref.hpSet } : {}) };
  });
  return {
    turn: turnNo,
    deck: deckCards.slice().reverse().map(c => c.id), // si pesca dalla fine: la prima dell'elenco va in fondo all'array
    discard: discardCards.map(c => c.id),
    queue,
    resolving: sc.phase === 'nemesis',
    currentIndex: 0,
    newIndex: -1,
    maxTierDrawn: sc.maxTier || 0,
    // Vite dello scenario (se mancano: valori iniziali, li mette restore)
    ...(typeof sc.graveLife === 'number' ? { graveLife: sc.graveLife } : {}),
    ...(typeof sc.nemesisLife === 'number' ? { nemesisLife: sc.nemesisLife } : {}),
    stats,
    turnOrder: { left: (order.left || []).slice(), drawn: (order.drawn || []).slice(), round: order.round || 1,
      wild: order.wild || null, picks: jsonCopy(order.picks || {}), known: (order.left || []).map(() => false),
      waiting: false, pairNext: emptyPairNext(order.pairNext) }
  };
}

// Avvia (o riavvia) uno scenario. Restituisce null se è partito, altrimenti il motivo (per esempio una carta che manca)
export function startScenario(sc: Scenario | null | undefined): string | null {
  if (!catalogo.allCards.length || !sc) return T.testNotReady;
  let state: FotografiaLetta;
  try {
    state = buildScenarioState(sc);
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  iniziaProva({ id: sc.id, name: sc.name, pairs: typeof sc.pairs === 'boolean' ? sc.pairs : null,
    turnCards: Array.isArray(sc.turnCards) ? sc.turnCards.slice() : null });
  clearTransition();
  closeAllModals();
  closeDiscard();
  closeTestScreen();
  preferenze.settings = { players: sc.players, nemesis: sc.nemesis, battleMode: true, mergeCollection: true };
  impostaUndo([]);
  ui.drafts.clear();
  ui.deckBuilding = false;
  ui.deckShown = null;
  ui.deckDark = false;
  ui.pairMinimized = null;
  ui.trackShuffle = false;
  ui.lastDrawnUid = null;
  ui.tierBanner = null;
  ui.victoryKey = '';
  restore(state);
  avviaRegolazioni();
  vaiAllaPartitaDaScenario();
  richiediRidisegno();
  prefetchDeckImages();
  pulsantePrincipale.focus({ preventScroll: true });
  return null;
}

// Fine del test (menu iniziale): tornano le scelte di prima della pagina iniziale e la partita di test si butta
// (stato/partita.ts, esciDalTest): "Riprendi partita" ricarica quella salvata, "Nuova partita" ne fa una nuova
export function endTest(): void {
  terminaRegolazioni();
  esciDalTest();
}

export function restartScenario(): void {
  const run = partita.testRun;
  const sc = run && SCENARI.find(s => s.id === run.id);
  const problem = startScenario(sc);
  if (problem) showToast(problem);
}

// Schermata Test (dal menu iniziale): elenco degli scenari, nome e una riga di descrizione
export function closeTestScreen(): void {
  const layer = document.querySelector('.test-screen');
  const x = layer && query(layer, '.collection-head .ae-icon-button', HTMLElement);
  if (layer && !x) throw new TypeError('pulsante di chiusura della schermata Test mancante');
  if (x) x.click();
}

export function openTestScreen(trigger?: HTMLElement | null): void {
  const layer = el('div', 'collection-screen options-screen test-screen');
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-label', T.testTitle);
  const head = el('div', 'collection-head');
  const close = () => {
    layer.remove();
    startLayer.inert = false;
    updateInert();
    if (trigger && trigger.isConnected && !startLayer.hidden) trigger.focus({ preventScroll: true });
  };
  const x = el('button', 'ae-icon-button');
  x.type = 'button';
  x.setAttribute('aria-label', T.close);
  x.appendChild(icon('close'));
  x.addEventListener('click', close);
  head.append(el('h2', 'collection-title', T.testTitle), x);
  const body = el('div', 'collection-body');
  body.appendChild(el('p', 'start-note', T.testHint));
  SCENARI.forEach(sc => {
    const item = el('button', 'options-item test-scenario');
    item.type = 'button';
    item.dataset.scenario = sc.id;
    const error = el('span', 'test-scenario-error');
    error.hidden = true;
    item.append(el('span', 'options-item-label', sc.name), el('span', 'options-item-note', sc.desc), error);
    item.addEventListener('click', () => {
      const problem = startScenario(sc);
      if (problem) {
        error.textContent = T.testFailed(problem);
        error.hidden = false;
      }
    });
    body.appendChild(item);
  });
  layer.append(head, body);
  layer.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  document.body.appendChild(layer);
  startLayer.inert = true;
  const first = query(body, '.test-scenario', HTMLElement);
  if (first) first.focus();
}

// Al caricamento non c'è niente da fare (main.ts chiama avvio() di ogni modulo)
export function avvio(): void {
}
