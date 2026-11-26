// ui/schermate/mazzo-turni-tempo.ts: la linea del tempo sotto le carte della schermata del mazzo dei turni (nodi e
// segmenti, solo da guardare). File di supporto di mazzo-turni-disegno.ts.
// Livello 5 (ui/schermate/). Dipende da: ui/dom.ts, mazzo-turni-bozza.ts, mazzo-turni-riga.ts (tipi).
// Usato da: mazzo-turni-disegno.ts.

import { el, need } from '../dom.ts';
import { turnPileStates } from './mazzo-turni-bozza.ts';
import type { Finestra } from './mazzo-turni-bozza.ts';
import type { OggettoRiga } from './mazzo-turni-riga.ts';
// Linea del tempo: un nodo sotto ogni carta (scarti poi mazzo, da sinistra a destra), al suo centro. Lo stato viene dalla
// storia dei turni (turnPileStates), non dalla posizione: pieno = turno giocato, anello dorato = turno in corso, X grigia
// = carta negli scarti senza turno, anello grigio = carta nel mazzo. I segmenti uniscono i nodi circolari (le X non li
// interrompono: li attraversano) a TIME_GAP dai loro bordi; colore dorato tra due nodi dorati, grigio tra due grigi,
// sfumato tra uno dorato e uno grigio. Gli elementi si riusano, così si spostano con la transizione delle carte.
// Coordinate della riga (come it.left)
type StatoNodo = 'done' | 'current' | 'skipped' | 'todo';
const TIME_R: Record<StatoNodo, number> = { done: 4, current: 5, todo: 3, skipped: 0 }, TIME_GAP = 5, TIME_BELOW = 8;
function timeLayer(f: Finestra, name: 'segs' | 'nodes'): HTMLElement {
  if (!f.time.children.length) f.time.append(el('div', 'ae-turn-time-segs'), el('div', 'ae-turn-time-nodes'));
  return need(f.time.children[name === 'segs' ? 0 : 1], 'livello della linea del tempo') as HTMLElement;
}
function timePool(layer: HTMLElement, n: number) {
  while (layer.children.length < n) layer.appendChild(el('span', ''));
  while (layer.children.length > n) layer.lastElementChild?.remove();
  return [...layer.children] as HTMLElement[];
}
export function layoutTime(f: Finestra, items: OggettoRiga[], h: number) {
  const cards = items.filter(it => it.kind === 'pile' || it.kind === 'deck');
  const piles = turnPileStates(f.d);
  const states: StatoNodo[] = cards.map(it => it.kind === 'deck' ? 'todo' : piles[it.i] ?? 'skipped');
  const cx = (j: number) => cards[j].left + cards[j].vis / 2;
  const gold = (s: StatoNodo) => s === 'done' || s === 'current';
  f.time.style.top = (h + TIME_BELOW) + 'px';
  timePool(timeLayer(f, 'nodes'), cards.length).forEach((node, j) => {
    const s = states[j];
    node.className = 'ae-turn-time-node is-' + s;
    node.style.left = (cx(j) - (s === 'skipped' ? 2.5 : TIME_R[s])) + 'px';
  });
  // Segmenti: [da, a, colore da, colore a] in coordinate della riga; colore: true = dorato
  const round = states.map((s, j) => (s === 'skipped' ? -1 : j)).filter(j => j >= 0);
  const segs: { from: number; to: number; a: boolean; b: boolean }[] = [];
  if (!round.length) { if (cards.length > 1) segs.push({ from: cx(0), to: cx(cards.length - 1), a: false, b: false }); }
  else {
    const first = round[0], last = round[round.length - 1];
    if (first > 0) segs.push({ from: cx(0), to: cx(first) - TIME_R[states[first]] - TIME_GAP, a: gold(states[first]), b: gold(states[first]) });
    round.forEach((j, q) => {
      const nx = round[q + 1];
      if (nx !== undefined) segs.push({ from: cx(j) + TIME_R[states[j]] + TIME_GAP, to: cx(nx) - TIME_R[states[nx]] - TIME_GAP,
        a: gold(states[j]), b: gold(states[nx]) });
    });
    if (last < cards.length - 1) segs.push({ from: cx(last) + TIME_R[states[last]] + TIME_GAP, to: cx(cards.length - 1),
      a: gold(states[last]), b: gold(states[last]) });
  }
  timePool(timeLayer(f, 'segs'), segs.length).forEach((seg, q) => {
    const s = segs[q];
    seg.className = 'ae-turn-time-seg ' + (s.a && s.b ? 'is-gold' : !s.a && !s.b ? 'is-grey' : s.a ? 'is-gold-grey' : 'is-grey-gold');
    seg.style.left = s.from + 'px';
    seg.style.width = Math.max(0, s.to - s.from) + 'px';
  });
}