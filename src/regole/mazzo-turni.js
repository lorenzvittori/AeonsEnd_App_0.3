// regole/mazzo-turni.js: il mazzo dei turni (chi gioca il prossimo turno).
// Riceve `order`, il mazzo dei turni della partita (o la bozza della finestra del mazzo dei turni):
//   { left, known, drawn, round, wild, picks, pairNext, history, waiting }
//   - left: le carte del mazzo, in ordine (left[0] = la carta in cima); known: true/false per carta di left (nota);
//   - drawn: gli scarti dei turni, nell'ordine in cui sono usciti;
//   - round: giri cominciati ("Turno N"); wild: il giocatore (1-3) che è wild nel giro (3 giocatori), altrimenti null;
//   - picks: { posizione in drawn: { player, forced } } per le carte 1/2 e 3/4 (chi le ha giocate; forced = obbligata
//     dalla memoria; nei salvataggi vecchi una stringa = scelta);
//   - pairNext: memoria delle coppie { p12: null | 'p1' | 'p2', p34: null | 'p3' | 'p4' } (a chi tocca la prossima carta
//     della coppia; null = si sceglie);
//   - history: i turni del giro [{ kind, player, forced, pos }] (l'ultimo è il turno in corso; pos = posizione in drawn,
//     null se la carta non è più negli scarti);
//   - waiting: turno annullato in attesa della carta turno (solo salvataggi vecchi).
// Carte: 'p1'..'p4' giocatori, 'wild' (3 giocatori), 'p12' / 'p34' (carte 1/2 e 3/4, 4 giocatori), 'nemesis'.
// Le funzioni che fanno un passo modificano solo `order` (o la bozza `d`) e lo dicono; le altre restituiscono valori
// (carte, giocatori, un mazzo dei turni nuovo) senza cambiare niente. Il caso arriva come `random`.
// Usato da: stato/partita.js, ui/schermate/mazzo-turni.js (bozza), regole/salvataggio.js, test in
// tests/mazzo-turni.test.js.

import { shuffle } from './caso.js';

// --- Carte e coppie ---

// Carte del mazzo per il numero di giocatori: 2 = due a testa, 3 = una a testa più il wild, 4 = una a testa (o, con
// l'opzione delle carte 1/2 e 3/4, due 1/2 e due 3/4); sempre due carte nemesi. pairsOn: booleano o funzione (letta solo
// con 4 giocatori)
export function turnOrderCards(players, pairsOn) {
  const n = Math.max(1, Math.min(4, Number(players) || 2));
  const pairs = () => (typeof pairsOn === 'function' ? pairsOn() : !!pairsOn);
  const mine = n === 1 ? ['p1', 'p1', 'p1', 'p1'] : n === 2 ? ['p1', 'p1', 'p2', 'p2']
    : n === 3 ? ['p1', 'p2', 'p3', 'wild'] : pairs() ? ['p12', 'p12', 'p34', 'p34'] : ['p1', 'p2', 'p3', 'p4'];
  return mine.concat('nemesis', 'nemesis');
}

export function isPairCard(kind) { return kind === 'p12' || kind === 'p34'; }

// I due giocatori di una carta 1/2 o 3/4
export function pairOptions(kind) { return kind === 'p12' ? ['p1', 'p2'] : ['p3', 'p4']; }

export function otherOfPair(kind, player) {
  return pairOptions(kind).find(p => p !== player) || null;
}

// Giocatori della partita: 'p1'..'pN'
export function playerKinds(players) {
  const n = Math.max(1, Math.min(4, Number(players) || 2));
  return Array.from({ length: n }, (_, i) => 'p' + (i + 1));
}

// Memoria delle coppie (copia, null dove manca)
export function emptyPairNext(old) {
  return { p12: old && old.p12 ? old.p12 : null, p34: old && old.p34 ? old.p34 : null };
}

// Chi ha giocato la carta 1/2 o 3/4 in posizione i degli scarti: { player, forced } o null
export function pickOf(order, i) {
  const p = order.picks && order.picks[i];
  if (!p) return null;
  return typeof p === 'string' ? { player: p, forced: false } : (p.player ? p : null);
}

// --- Giri e pesca ---

// Mazzo dei turni di una partita nuova: vuoto, si aspetta "Pesca carta turno"; memoria delle coppie vuota
export function newTurnOrder() {
  return { left: [], drawn: [], round: 0, picks: {}, known: [], waiting: false, pairNext: emptyPairNext(), history: [] };
}

// Giro nuovo: restituisce un mazzo dei turni NUOVO con le carte `cards` mescolate (random), il giro +1, nessuna carta
// nota, scarti e storia vuoti; la memoria delle coppie resta. Wild (3 giocatori): al primo giro a caso (random usato
// prima della mescolata), poi passa al giocatore dopo (1→2→3→1)
export function shuffleTurnOrder(order, players, cards, random) {
  const wild = Number(players) === 3
    ? (order.wild ? (order.wild % 3) + 1 : 1 + Math.floor(random() * 3)) : null;
  const left = shuffle(cards, random);
  return { left, drawn: [], round: (order.round || 0) + 1, wild, picks: {}, known: left.map(() => false), waiting: false,
    pairNext: emptyPairNext(order.pairNext), history: [] };
}

// Turno in corso: l'ultimo della storia del giro; null in attesa della carta turno
export function currentTurn(order) {
  if (order.waiting) return null;
  const h = order.history || [];
  return h.length ? h[h.length - 1] : null;
}

// Il turno in corso è l'ultimo del giro (mazzo dei turni vuoto): alla fine si mescola un giro nuovo
export function turnRoundOver(order) {
  return !!currentTurn(order) && !order.left.length;
}

// Si aspetta la carta turno: turno giocatori senza nessun turno nel giro (o con un turno annullato dei salvataggi vecchi)
export function awaitingTurnCard(order, resolving) {
  return !resolving && (!(order.history || []).length || !!order.waiting);
}

// Pesca la carta in cima. A mazzo vuoto prima un giro nuovo (shuffleTurnOrder con opts.players, opts.cards() e
// opts.random). opts.pick (salvataggi vecchi): la prima carta dall'alto che lo soddisfa. La carta va negli scarti e
// diventa un turno della storia. Carta 1/2 o 3/4: se la memoria della coppia dice a chi tocca, gioca lui (OBBLIGATA,
// in picks e nella storia) e la memoria torna vuota; altrimenti resta da scegliere (choosePairPlayer).
// Modifica `order` (o, a mazzo vuoto, il mazzo nuovo). Restituisce { order, card }.
export function drawTurnCard(order, opts) {
  if (!order.left.length) order = shuffleTurnOrder(order, opts.players, opts.cards(), opts.random);
  let at = 0;
  if (opts.pick) { const i = order.left.findIndex(opts.pick); if (i >= 0) at = i; }
  const card = order.left.splice(at, 1)[0];
  if (Array.isArray(order.known)) order.known.splice(at, 1);
  order.drawn.push(card);
  order.waiting = false;
  const entry = { kind: card, player: null, forced: false, pos: order.drawn.length - 1 };
  if (isPairCard(card)) {
    order.pairNext = emptyPairNext(order.pairNext);
    const next = order.pairNext[card];
    if (next) {
      order.picks = Object.assign({}, order.picks, { [order.drawn.length - 1]: { player: next, forced: true } });
      order.pairNext[card] = null;
      Object.assign(entry, { player: next, forced: true });
    }
  }
  order.history = (order.history || []).concat(entry);
  return { order, card };
}

// Scelta del giocatore per la carta 1/2 o 3/4 del turno in corso: il giocatore va nella storia e, se la carta è negli
// scarti, in picks; la prossima carta della coppia tocca all'altro. Modifica `order`. false se non c'è da scegliere
export function choosePairPlayer(order, player) {
  const cur = currentTurn(order);
  if (!cur || !isPairCard(cur.kind) || cur.player) return false;
  const kind = cur.kind;
  const h = order.history.slice();
  h[h.length - 1] = Object.assign({}, cur, { player, forced: false });
  order.history = h;
  if (cur.pos !== null && cur.pos !== undefined) {
    order.picks = Object.assign({}, order.picks, { [cur.pos]: { player, forced: false } });
  }
  order.pairNext = Object.assign(emptyPairNext(order.pairNext), { [kind]: otherOfPair(kind, player) });
  return true;
}

// --- Storia e giocatori ---

// Storia ricostruita dagli scarti (salvataggi senza storia): un turno per ogni carta negli scarti
export function historyFromPile(order) {
  return (order.drawn || []).map((kind, i) => {
    const pick = isPairCard(kind) ? pickOf(order, i) : null;
    return { kind, player: pick ? pick.player : null, forced: !!(pick && pick.forced), pos: i };
  });
}

// Giocatore di un turno della storia ('p1'..'p4'; wild = il giocatore che è wild nel giro); null per la nemesi o per
// una carta 1/2 o 3/4 non ancora scelta
export function historyPlayer(entry, wild) {
  if (!entry) return null;
  if (entry.kind === 'wild') return wild ? 'p' + wild : null;
  if (isPairCard(entry.kind)) return entry.player || null;
  return entry.kind && entry.kind !== 'nemesis' ? entry.kind : null;
}

// Giocatori dedotti per le carte 1/2 e 3/4 del mazzo (dalla cima) seguendo la memoria delle coppie: la prima carta della
// coppia con la memoria piena è di quel giocatore; dopo una carta da scegliere quelle della stessa coppia non si sanno.
// Un elemento per carta di left (null = non si sa o non è una carta 1/2 o 3/4)
export function predictedPairPlayers(order) {
  const mem = emptyPairNext(order.pairNext);
  const unknown = { p12: false, p34: false };
  return (order.left || []).map(kind => {
    if (!isPairCard(kind) || unknown[kind]) return null;
    if (mem[kind]) { const p = mem[kind]; mem[kind] = null; return p; }
    unknown[kind] = true;
    return null;
  });
}

// Giocatore di una carta: 'p1'..'p4'; wild = il giocatore che è wild nel giro (`wild`); carta 1/2 o 3/4 in posizione i
// degli scarti = chi l'ha giocata (i = -1: nel mazzo, nessuno; i mancante: il turno in corso, dalla storia); null per la
// nemesi o se è da scegliere
export function turnCardPlayer(kind, i, order, wild) {
  if (kind === 'wild') return wild ? 'p' + wild : null;
  if (isPairCard(kind)) {
    if (i === undefined) { const cur = currentTurn(order); return cur && cur.kind === kind ? cur.player || null : null; }
    const pick = i >= 0 ? pickOf(order, i) : null;
    return pick ? pick.player : null;
  }
  return kind && kind !== 'nemesis' ? kind : null;
}

// Carte tolte dagli scarti (posizioni in order.drawn): i giocatori delle carte 1/2 e 3/4 restano sulle carte che
// restano; quelli delle carte tolte si perdono; la storia segue le carte (posizione nuova, o null per le carte tolte).
// Modifica `order`. Restituisce le carte tolte, nell'ordine degli scarti
export function takeFromTurnPile(order, positions) {
  const take = new Set(positions.filter(i => i >= 0 && i < order.drawn.length));
  const keep = [];
  const picks = {};
  order.drawn.forEach((kind, i) => {
    if (take.has(i)) return;
    if (order.picks && order.picks[i]) picks[keep.length] = order.picks[i];
    keep.push(kind);
  });
  const taken = [...take].sort((a, b) => a - b).map(i => order.drawn[i]);
  if (Array.isArray(order.history)) {
    const newPos = {};
    let k = 0;
    order.drawn.forEach((kind, i) => { if (!take.has(i)) newPos[i] = k++; });
    order.history = order.history.map(e => Object.assign({}, e, { pos: e.pos === null || e.pos === undefined || !(e.pos in newPos) ? null : newPos[e.pos] }));
  }
  order.drawn = keep;
  order.picks = picks;
  return taken;
}

// --- Bozza della finestra del mazzo dei turni ---
// La finestra lavora su una bozza `d` = copia di order (left, known, drawn, picks, waiting, pairNext, history) più
// `old` (true per le carte già note all'apertura: si spostano solo quando sono in cima). Le operazioni modificano solo
// `d`; applyTurnDraft la scrive nel mazzo dei turni.

// Bozza da un mazzo dei turni (copie: la bozza non tocca order)
export function turnDraftFrom(order) {
  return { left: order.left.slice(), known: order.left.map((k, i) => !!(order.known && order.known[i])),
    drawn: order.drawn.slice(), picks: JSON.parse(JSON.stringify(order.picks || {})), waiting: !!order.waiting,
    pairNext: emptyPairNext(order.pairNext), history: JSON.parse(JSON.stringify(order.history || [])) };
}

// Firma della bozza (per sapere se è cambiata)
export function turnDraftKey(d) {
  return JSON.stringify([d.left, d.known, d.drawn, d.picks, d.waiting, d.pairNext, d.history]);
}

// Posizione negli scarti della carta del turno in corso (-1 = nessuna, anche se la sua carta è tornata nel mazzo)
export function turnDraftCurrent(d) {
  const cur = currentTurn(d);
  return cur && cur.pos !== null && cur.pos !== undefined ? cur.pos : -1;
}

// Carta del mazzo che si può spostare: nota e, se era già nota all'apertura (d.old), solo quando è in cima
export function turnDeckMovable(d, i) {
  return !!d.known[i] && (!(d.old && d.old[i]) || i === 0);
}

// Operazioni sulla bozza (modificano solo `d`; quelle con un esito restituiscono false se non si possono fare)
export const turnDraftOps = {
  // Rivela la carta in cima
  revealTop(d) { if (d.left.length) d.known[0] = true; },
  // Rivela tutto il mazzo
  revealAll(d) { d.known = d.left.map(() => true); },
  // Copre tutto il mazzo, senza mescolare
  coverAll(d) { d.known = d.left.map(() => false); if (d.old) d.old = d.left.map(() => false); },
  // Carta del mazzo (spostabile) in un altro punto del mazzo: from e to sono posizioni dalla cima
  moveInDeck(d, from, to) {
    if (!turnDeckMovable(d, from) || from === to || to < 0 || to >= d.left.length) return false;
    const [kind] = d.left.splice(from, 1);
    const [known] = d.known.splice(from, 1);
    d.left.splice(to, 0, kind);
    d.known.splice(to, 0, known);
    if (d.old) { const [old] = d.old.splice(from, 1); d.old.splice(to, 0, old); }
    return true;
  },
  // Carta degli scarti nel mazzo: in cima ('top'), in fondo ('bottom') o in una posizione dalla cima (numero). Resta
  // nota e torna senza giocatore (takeFromTurnPile); il turno giocato con quella carta resta nella storia (se è il turno
  // in corso, continua); la memoria delle coppie non cambia
  pileToDeck(d, pos, where) {
    if (pos < 0 || pos >= d.drawn.length) return false;
    const [kind] = takeFromTurnPile(d, [pos]);
    const at = where === 'top' ? 0 : where === 'bottom' ? d.left.length : Math.max(0, Math.min(d.left.length, Number(where) || 0));
    d.left.splice(at, 0, kind);
    d.known.splice(at, 0, true);
    if (d.old) d.old.splice(at, 0, false);
    return true;
  },
  // Mescola il mazzo (random) e copre tutto
  shuffle(d, random) { d.left = shuffle(d.left, random); d.known = d.left.map(() => false); if (d.old) d.old = d.left.map(() => false); },
  // Carta del mazzo (spostabile) negli scarti, in fondo: non è un turno (la storia non cambia, il turno di quella carta
  // è perso, nessun giocatore per le carte 1/2 e 3/4)
  deckToPile(d, from) {
    if (!turnDeckMovable(d, from)) return false;
    const [kind] = d.left.splice(from, 1);
    d.known.splice(from, 1);
    if (d.old) d.old.splice(from, 1);
    d.drawn.push(kind);
    return true;
  }
};

// Scrive la bozza nel mazzo dei turni (copie). Modifica `order`
export function applyTurnDraft(order, d) {
  order.left = d.left.slice();
  order.known = d.known.slice();
  order.drawn = d.drawn.slice();
  order.picks = JSON.parse(JSON.stringify(d.picks));
  order.pairNext = emptyPairNext(d.pairNext);
  order.history = JSON.parse(JSON.stringify(d.history || []));
}

// --- Salvataggi ---

// Mazzo dei turni letto da una fotografia (salvataggio o undo). opts = { players, resolving, turn, random, cards() }.
// Campi mancanti dei salvataggi vecchi: giro dai turni nemesi, wild a caso (random), nessuna carta nota, picks a
// stringhe e memoria delle coppie ricostruita dagli scarti (la seconda carta della coppia diventa obbligata), storia
// dagli scarti. Senza mazzo dei turni valido: giro nuovo con il turno in corso già pescato (nemesi nel turno nemesi,
// un giocatore nel turno giocatori). Restituisce il mazzo dei turni (nuovo); non cambia `saved`
export function restoreTurnOrder(saved, opts) {
  const resolving = opts.resolving;
  if (saved && Array.isArray(saved.left) && Array.isArray(saved.drawn)
    && (saved.drawn.length || (Array.isArray(saved.history) && saved.history.length) || !resolving)) {
    const order = { left: saved.left.slice(), drawn: saved.drawn.slice(),
      round: typeof saved.round === 'number' ? saved.round : Math.max(1, opts.turn),
      wild: Number(opts.players) === 3
        ? (saved.wild >= 1 && saved.wild <= 3 ? saved.wild : 1 + Math.floor(opts.random() * 3)) : null,
      picks: saved.picks && typeof saved.picks === 'object' ? Object.assign({}, saved.picks) : {} };
    const known = Array.isArray(saved.known) && saved.known.length === order.left.length ? saved.known : [];
    order.known = order.left.map((k, i) => !!known[i]);
    order.waiting = !!saved.waiting && !resolving && order.drawn.length > 0;
    if (saved.pairNext && typeof saved.pairNext === 'object') {
      const picks = {};
      Object.keys(order.picks).forEach(i => { const p = pickOf(order, Number(i)); if (p) picks[i] = { player: p.player, forced: !!p.forced }; });
      order.picks = picks;
      order.pairNext = emptyPairNext(saved.pairNext);
    } else {
      const picks = {};
      const next = { p12: null, p34: null };
      order.drawn.forEach((kind, i) => {
        if (!isPairCard(kind)) return;
        const p = pickOf(order, i);
        if (p) { picks[i] = { player: p.player, forced: false }; next[kind] = otherOfPair(kind, p.player); }
        else if (next[kind]) { picks[i] = { player: next[kind], forced: true }; next[kind] = null; }
      });
      order.picks = picks;
      order.pairNext = next;
    }
    order.history = Array.isArray(saved.history)
      ? saved.history.filter(e => e && e.kind).map(e => ({ kind: e.kind, player: e.player || null, forced: !!e.forced,
        pos: typeof e.pos === 'number' && e.pos >= 0 && e.pos < order.drawn.length ? e.pos : null }))
      : historyFromPile(order);
    return order;
  }
  const order = { left: [], drawn: [], round: Math.max(1, opts.turn) - 1, known: [], waiting: false, pairNext: emptyPairNext(), history: [] };
  return drawTurnCard(order, { players: opts.players, cards: opts.cards, random: opts.random,
    pick: c => (resolving ? c === 'nemesis' : c !== 'nemesis') }).order;
}
