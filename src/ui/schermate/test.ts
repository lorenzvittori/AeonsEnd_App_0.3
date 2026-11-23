// ui/schermate/test.ts: Modalità test: scenari (partite che partono già in un momento preciso) e schermata Test.
// Dipende da: stato/ (condivise, stato, partita, salvataggio), dati/rete.ts, ui/testi.ts, ui/componenti (componenti,
// dialoghi, scarti), ui/schermate (opzioni, turno-nemesi). Usato da: menu iniziale (Test), menu laterale (Ricomincia lo
// scenario), prove degli operatori (app.SCENARI, app.startScenario).

import { G } from '../../stato/condivise.ts';
import { I18N_IT } from '../testi.ts';
import { emptyStats, nemesisBtn, resolveBtn, startLayer, ui } from '../../stato/stato.ts';
import { aetherCost, emptyPairNext, isVariableMinion, makeEntry } from '../../stato/partita.ts';
import { el, icon, query } from '../componenti/componenti.ts';
import { closeAllModals, showToast, updateInert } from '../componenti/dialoghi.ts';
import { closeDiscard } from '../componenti/scarti.ts';
import { closeStart } from './opzioni.ts';
import { clearTransition, restore } from '../../stato/salvataggio.ts';
import { render } from './turno-nemesi.js';
import { prefetchDeckImages } from '../../dati/rete.ts';
import { jsonCopy } from '../../regole/json.ts';
import type { Carta } from '../../tipi/dati.ts';
import type { CartaTurno, Giocatore, MemoriaCoppie, SceltaCoppia, StatisticheMago } from '../../tipi/partita.ts';
import type { FotografiaLetta, VoceLetta } from '../../tipi/salvataggio.ts';

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
    id: 'turn-deck', name: 'Carte sul mazzo dei turni',
    desc: 'Solo carte nemesi nel mazzo dei turni; in cima Hissing Acid, Sunder e Thunderous Tempest (riquadri e finestra)',
    players: 2, nemesis: 'Maggoth', phase: 'nemesis', turn: 1, maxTier: 1,
    deck: ['Hissing Acid', { name: 'Sunder', boxCode: '4' }, 'Thunderous Tempest', 'Drillbeak Wurm', 'Rend', 'Morbid Gyre'],
    turnCards: ['nemesis', 'nemesis', 'nemesis', 'nemesis', 'nemesis', 'nemesis'],
    turnOrder: { left: ['nemesis', 'nemesis', 'nemesis', 'nemesis', 'nemesis'], drawn: ['nemesis'], round: 1 }
  },
  {
    id: 'variable-hp', name: 'Minion a vita variabile',
    desc: 'Carapace Queen: in cima Maggot Engine e poi Mindguzzler, turno nemesi pronto a pescare',
    players: 2, nemesis: 'Carapace Queen', phase: 'nemesis', turn: 1, maxTier: 3,
    deck: ['Maggot Engine', 'Mindguzzler', 'Broodwomb', 'Hatch'],
    turnOrder: { left: ['p1', 'nemesis', 'p2', 'p1', 'p2'], drawn: ['nemesis'], round: 1 }
  },
  {
    id: 'tier', name: 'Cambio Tier',
    desc: 'La prossima carta è la prima di Tier 2, quella dopo la prima di Tier 3 (scritte "Tier 2" e "Tier 3")',
    players: 2, nemesis: 'Maggoth', phase: 'nemesis', turn: 3, maxTier: 1,
    queue: ['Drillbeak Wurm'],
    deck: ['Volcanic Zala', 'Crushing Storm', 'Eliminate', 'Gore'],
    turnOrder: { left: ['nemesis', 'p1', 'p2', 'p1', 'p2'], drawn: ['nemesis'], round: 1 }
  },
  {
    id: 'full-queue', name: 'Coda piena',
    desc: '10 carte in gioco: minion pieni e danneggiati, poteri da 1 a 4 segnalini, forzati a 5 e 7, non rimovibili',
    players: 2, nemesis: 'Arachnos', phase: 'players', turn: 4, maxTier: 3,
    queue: ['Volcanic Zala', { name: 'Carriode Colony', hp: 3 }, { name: 'Blind Enigma', hp: 2 },
      'Morbid Gyre', 'Eye of Nothing', 'Chaos Orb', 'The End', { name: 'Spirit Snare', tokens: 5 },
      { name: 'Woven Sky', tokens: 7 }, 'Bleed Static'],
    deck: ['Gore', 'Eliminate'],
    turnOrder: { left: ['nemesis', 'p2', 'p1', 'nemesis', 'p2'], drawn: ['p1'], round: 2 }
  },
  {
    id: 'victory', name: 'Vittoria',
    desc: 'Un minion con 1 di vita e una sola carta nel mazzo: uccidilo e finisci il mazzo per la Vittoria',
    players: 2, nemesis: 'Maggoth', phase: 'players', turn: 9, maxTier: 3,
    queue: [{ name: 'Drillbeak Wurm', hp: 1 }],
    deck: ['Morbid Gyre'],
    turnOrder: { left: ['nemesis', 'p2', 'p1', 'nemesis', 'p2'], drawn: ['p1'], round: 3 },
    stats: { startedMinAgo: 45, tierMinAgo: { 2: 28, 3: 10 } }
  },
  {
    id: 'pairs', name: 'Carte 1/2 e 3/4',
    desc: '4 giocatori con le carte 1/2 e 3/4: la prossima carta turno è 1/2, più avanti c\'è l\'altra 1/2',
    players: 4, nemesis: 'Maggoth', phase: 'players', turn: 1, maxTier: 1, pairs: true,
    queue: ['Carriode Colony'],
    deck: ['Drillbeak Wurm', 'Rend', 'Disorient', 'Blind Enigma'],
    // Il 4 ha scelto la 3/4, quindi la prossima 3/4 tocca al 3; nessuno per la 1/2: si sceglie
    turnOrder: { left: ['p12', 'nemesis', 'p34', 'p12', 'nemesis'], drawn: ['p34'], picks: { 0: { player: 'p4', forced: false } },
      pairNext: { p12: null, p34: 'p3' }, round: 1 }
  },
  {
    id: 'pair-memory', name: 'Memoria 1/2 tra i giri',
    desc: '4 giocatori: il giocatore 1 ha giocato una 1/2 nel giro prima; la prossima 1/2 è del 2, senza scelta',
    players: 4, nemesis: 'Maggoth', phase: 'players', turn: 3, maxTier: 1, pairs: true,
    queue: ['Carriode Colony'],
    deck: ['Drillbeak Wurm', 'Rend', 'Disorient', 'Blind Enigma'],
    turnOrder: { left: ['p12', 'nemesis', 'p34', 'p12', 'nemesis'], drawn: ['p34'], picks: { 0: { player: 'p3', forced: false } },
      pairNext: { p12: 'p2', p34: 'p4' }, round: 2 }
  },
  {
    id: 'wild-round', name: 'Wild e fine giro',
    desc: '3 giocatori, ultima carta del giro (il wild è il giocatore 2): "Fine turno · Mischia mazzo"',
    players: 3, nemesis: 'Maggoth', phase: 'players', turn: 4, maxTier: 2,
    queue: [{ name: 'Volcanic Zala', hp: 6 }],
    deck: ['Gore', 'Eliminate', 'Crushing Storm'],
    turnOrder: { left: [], drawn: ['p1', 'nemesis', 'p2', 'nemesis', 'p3', 'wild'], round: 2, wild: 2 }
  },
  {
    id: 'full-stats', name: 'Statistiche piene',
    desc: 'Partita avanzata (turno 8, giro 3) con minion uccisi, poteri, attacchi, Æ spesi e statistiche maghi',
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
    id: 'empty-deck', name: 'Mazzo nemesi vuoto',
    desc: 'Mazzo nemesi vuoto e un minion in gioco: niente pesca, niente vittoria finché vive',
    players: 2, nemesis: 'Maggoth', phase: 'players', turn: 11, maxTier: 3,
    queue: [{ name: 'Volcanic Zala', hp: 4 }],
    deck: [],
    turnOrder: { left: ['nemesis', 'p2', 'p1', 'nemesis'], drawn: ['p1', 'p2'], round: 4 }
  },
  {
    id: 'low-lives', name: 'Vite quasi a zero',
    desc: 'Nemesi e Gravehold a 3 di vita: togli 3 alla nemesi per la Vittoria, a Gravehold per la Sconfitta (Undo torna indietro)',
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
  const found = G.allCards.filter(c => c.name === name && (box === null || c.boxCode === box));
  if (!found.length) throw new Error(I18N_IT.testCardMissing(box ? `${name} (${box})` : name));
  if (found.length > 1) throw new Error(I18N_IT.testCardAmbiguous(name));
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
    aetherSpent: paid.reduce((sum, id) => { const card = G.cardsById.get(id); return sum + (card ? aetherCost(card) : 0); }, 0),
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
  if (!G.allCards.length || !sc) return I18N_IT.testNotReady;
  let state: FotografiaLetta;
  try {
    state = buildScenarioState(sc);
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  if (!G.testRun) G.testRun = { prevSettings: jsonCopy(G.settings) };
  Object.assign(G.testRun, { id: sc.id, name: sc.name, pairs: typeof sc.pairs === 'boolean' ? sc.pairs : null,
    turnCards: Array.isArray(sc.turnCards) ? sc.turnCards.slice() : null });
  clearTransition();
  closeAllModals();
  closeDiscard();
  closeTestScreen();
  G.settings = { players: sc.players, nemesis: sc.nemesis, battleMode: true, mergeCollection: true };
  G.undoStack = [];
  ui.drafts.clear();
  ui.deckBuilding = false;
  ui.deckShown = null;
  ui.deckDark = false;
  ui.pairMinimized = null;
  ui.trackShuffle = false;
  ui.lastDrawnUid = null;
  ui.tierBanner = null;
  G.victoryKey = '';
  restore(state);
  closeStart();
  render();
  prefetchDeckImages();
  (G.resolving ? resolveBtn : nemesisBtn).focus({ preventScroll: true });
  return null;
}

// Fine del test (menu iniziale): tornano le scelte di prima della pagina iniziale. La partita in memoria è quella di
// test, ma "Riprendi partita" ricarica quella salvata e "Nuova partita" ne fa una nuova
export function endTest(): void {
  if (!G.testRun) return;
  G.settings = G.testRun.prevSettings;
  G.testRun = null;
}

export function restartScenario(): void {
  const run = G.testRun;
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
  layer.setAttribute('aria-label', I18N_IT.testTitle);
  const head = el('div', 'collection-head');
  const close = () => {
    layer.remove();
    startLayer.inert = false;
    updateInert();
    if (trigger && trigger.isConnected && !startLayer.hidden) trigger.focus({ preventScroll: true });
  };
  const x = el('button', 'ae-icon-button');
  x.type = 'button';
  x.setAttribute('aria-label', I18N_IT.close);
  x.appendChild(icon('close'));
  x.addEventListener('click', close);
  head.append(el('h2', 'collection-title', I18N_IT.testTitle), x);
  const body = el('div', 'collection-body');
  body.appendChild(el('p', 'start-note', I18N_IT.testHint));
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
        error.textContent = I18N_IT.testFailed(problem);
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
