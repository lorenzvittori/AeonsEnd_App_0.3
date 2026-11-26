// ui/schermate/mazzo-turni-disegno.ts: il disegno della schermata del mazzo dei turni: carte del mazzo e degli scarti,
// disposizione della riga (misura delle carte, Cima e Fondo, guida, cerchi), riga dei titoli con la cuspide, carte che
// si girano rivelandole. File di supporto di mazzo-turni.ts.
// Livello 5 (ui/schermate/). Dipende da: ui/ base (testi, pagina, dom), ui/componenti/animazioni.ts, mazzo-turni-bozza.ts
// mazzo-turni-riga.ts e mazzo-turni-tempo.ts (supporto). Usato da: mazzo-turni.ts, mazzo-turni-trascina.ts.

import { animDone } from '../componenti/animazioni.ts';
import { el, need, query } from '../dom.ts';
import { emptySetIcon, saveTurnDraft, trackPreviewCopy, turnCardFace, turnCardName, turnDeckMovable, turnDraftCurrent,
  turnDraftKey } from './mazzo-turni-bozza.ts';
import type { Destinazione, Finestra, Selezione } from './mazzo-turni-bozza.ts';
import { inCardBand, spaceItems, TURN_SPREAD } from './mazzo-turni-riga.ts';
import type { OggettoRiga } from './mazzo-turni-riga.ts';
import { layoutTime } from './mazzo-turni-tempo.ts';
import { reducedMotion } from '../pagina.ts';
import { T } from '../testi.ts';

// La cuspide sopra il segmento verticale: larga 14px, alta 8px (SVG 14x8)
const CUSP_W = 14;
const CUSP_H = 8;

// Le carte rivelate (o coperte) si girano: mezza rotazione in 140ms
const FLIP_HALF_MS = 140;

// Larghezza delle carte della riga: al massimo 64px, al minimo 30px; spazio minimo tra due oggetti (pallino della guida,
// 6px, più 2px per lato)
const TURN_W_MAX = 64, TURN_W_MIN = 30;
const TURN_GAP_MIN = 10;

// Riga dei titoli: metà della cuspide, spazio tra scritta e cuspide, spazio attorno alle scritte, tratto di linea minimo
const CUSP_HALF = CUSP_W / 2, HEAD_GAP = 4, LINE_PAD = 6, LINE_MIN = 6;

// Le distanze lette dalla pagina (getBoundingClientRect) si riportano in pixel CSS, quelli degli stili: con uno zoom
// CSS della pagina sarebbero ingrandite (rapporto tra larghezza misurata e larghezza CSS della riga)
export function pageZoom(f: Finestra) {
  const w = f.row.offsetWidth;
  const z = w ? f.row.getBoundingClientRect().width / w : 1;
  return z > 0.1 ? z : 1;
}
export function flipChange(f: Finestra, op: () => void) {
  if (f.drag || f.shuffling || f.closing) return;
  const beforeKnown = f.d.known.slice();
  const oldEls = f.fanEls.slice();
  op();
  f.sel = null;
  draw(f, true);
  if (reducedMotion.matches || !f.lane.animate) return;
  let k = 0;
  f.d.known.forEach((known, i) => {
    if (known === !!beforeKnown[i] || !f.fanEls[i] || !oldEls[i]) return;
    flipCard(f, f.fanEls[i], oldEls[i], k++ * 70);
  });
}
export function flipCard(f: Finestra, card: HTMLElement, oldCard: HTMLElement, delay: number) {
  // copia della carta com'era (senza ascoltatori), sopra la nuova, finché non è di taglio
  const was = oldCard.cloneNode(true);
  if (!(was instanceof HTMLElement)) return;
  was.classList.add('ae-turn-flip-old');
  was.classList.remove('is-selected', 'is-movable');
  ['data-index', 'data-source', 'aria-label', 'role', 'type'].forEach(a => was.removeAttribute(a));
  was.setAttribute('aria-hidden', 'true');
  was.tabIndex = -1;
  was.style.left = card.style.left;
  was.style.zIndex = card.style.zIndex;
  f.lane.appendChild(was);
  const p = 'perspective(500px) ';
  const out = was.animate([{ transform: p + 'rotateY(0deg)' }, { transform: p + 'rotateY(90deg)' }],
    { duration: FLIP_HALF_MS, delay, easing: 'ease-in', fill: 'forwards' });
  card.animate([{ transform: p + 'rotateY(-90deg)' }, { transform: p + 'rotateY(0deg)' }],
    { duration: FLIP_HALF_MS, delay: delay + FLIP_HALF_MS, easing: 'ease-out', fill: 'backwards' });
  animDone([out], delay + FLIP_HALF_MS).then(() => was.remove());
}
export function inPileZone(f: Finestra, x: number, y: number, laneRect: DOMRect) {
  const rr = f.row.getBoundingClientRect();
  // (centro del segmento nella disposizione finale, non dove si trova a metà transizione)
  const split = f.rowGeo ? rr.left + f.rowGeo.split * pageZoom(f) : (() => { const dv = f.divider.getBoundingClientRect(); return dv.left + dv.width / 2; })();
  return x >= rr.left - 24 && x < split && inCardBand(y, laneRect.top, laneRect.bottom);
}
// still: la disposizione non cambia (rivela / copri): gli scarti, ricreati, non devono muoversi con la transizione dal
// margine 0 al margine finale
export function draw(f: Finestra, still = false) {
  if (still) f.pileRow.classList.add('is-still');
  const n = f.d.left.length;
  f.fanEls = f.d.left.map((kind, i) => {
    const known = f.d.known[i];
    const card = known ? turnCardFace(kind, -1, 'button', f.d) : el('span', 'ae-turn-card is-back');
    if (known) {
      if (card instanceof HTMLButtonElement) card.type = 'button';
      // Nota già all'apertura = scurita (60%) e ferma, tranne in cima
      card.classList.toggle('is-old', !!(f.d.old && f.d.old[i]));
      card.classList.toggle('is-movable', turnDeckMovable(f.d, i));
      card.setAttribute('aria-label', T.turnDeckCardLabel(turnCardName(kind, -1, f.d), i + 1, n));
    } else {
      card.setAttribute('role', 'img');
      card.setAttribute('aria-label', T.turnDeckCardLabel(T.turnCovered, i + 1, n));
    }
    card.dataset.source = 'deck';
    card.dataset.index = String(i);
    card.classList.toggle('is-selected', !!f.sel && f.sel.source === 'deck' && f.sel.index === i);
    return card;
  });
  f.lane.replaceChildren(...f.fanEls);
  // Mazzo vuoto: posto tratteggiato largo una carta con il simbolo dell'insieme vuoto ("Mazzo vuoto" resta come nome
  // per i lettori di schermo)
  if (!n) {
    const empty = el('span', 'ae-turn-fan-empty');
    empty.setAttribute('role', 'img');
    empty.setAttribute('aria-label', T.turnDeckEmpty);
    empty.appendChild(emptySetIcon());
    f.lane.appendChild(empty);
  }
  f.revealTop.hidden = !n || f.d.known[0];
  f.insertBar.hidden = true;
  f.lane.append(f.revealTop, f.zoneTop, f.zoneBottom, f.insertBar);
  f.revealAll.disabled = !n;
  // Con una carta sola nel mazzo basta l'occhio sulla carta: niente Rivela tutto
  f.revealAll.hidden = n < 2;
  f.revealAllEye.className = 'ae-icon ae-icon--' + (f.allKnown() ? 'eye-off' : 'eye');
  f.revealAll.title = f.allKnown() ? T.turnCoverAll : T.turnRevealAll;
  f.revealAll.setAttribute('aria-label', f.allKnown() ? T.turnCoverAllLabel : T.turnRevealAllLabel);
  f.revealAll.classList.toggle('is-cover', f.allKnown());
  const cur = turnDraftCurrent(f.d);
  const faces: HTMLElement[] = [];
  const slots = f.d.drawn.map((kind, i) => {
    const face = turnCardFace(kind, i, 'button', f.d);
    const name = turnCardName(kind, i, f.d);
    if (face instanceof HTMLButtonElement) face.type = 'button';
    face.classList.add('is-movable');
    face.setAttribute('aria-label', T.turnPileCardLabel(name, i === cur));
    face.dataset.source = 'pile';
    face.dataset.index = String(i);
    face.classList.toggle('is-selected', !!f.sel && f.sel.source === 'pile' && f.sel.index === i);
    const slot = el('div', 'ae-turn-pile-slot' + (i === cur ? ' is-current' : ''));
    slot.appendChild(face);
    faces.push(face);
    return slot;
  });
  // Scarti vuoti: un posto tratteggiato largo una carta, con il simbolo dell'insieme vuoto
  if (slots.length) f.pileRow.replaceChildren(...slots);
  else {
    const empty = el('span', 'ae-turn-pile-empty');
    empty.setAttribute('role', 'img');
    empty.setAttribute('aria-label', T.turnPileEmpty);
    empty.appendChild(emptySetIcon());
    f.pileRow.replaceChildren(empty);
  }
  f.pileEls = faces;
  [...f.fanEls, ...f.pileEls].forEach(c => {
    if (!c.classList.contains('is-movable')) return;
    c.addEventListener('pointerdown', f.h.onPointerDown);
    c.addEventListener('click', f.h.onCardClick);
  });
  f.fanEls.forEach(c => { if (!c.classList.contains('is-movable')) c.addEventListener('click', f.h.onCardClick); });
  f.shuffleBtn.disabled = n < 2 && !f.d.known.some(Boolean);
  // Con meno di 2 carte nel mazzo non c'è niente da mescolare: il simbolo sparisce e lascia spazio alla scritta
  f.shuffleBtn.hidden = n < 2;
  f.heads.classList.toggle('no-shuffle', n < 2);
  f.resetBtn.disabled = !f.dirty();
  markTargets(f, f.sel);
  f.hint.textContent = f.sel ? T.turnSelected(selName(f, f.sel)) : T.turnHint;
  layoutFan(f);
  if (still) { void f.pileRow.offsetWidth; f.pileRow.classList.remove('is-still'); }
  // Ogni modifica vale subito nel mazzo dei turni; la selezione da sola non cambia niente
  const key = turnDraftKey(f.d);
  if (key !== f.savedKey) { f.savedKey = key; saveTurnDraft(f.d); }
  f.trackHolder.replaceChildren(trackPreviewCopy(f.d));
}
export function selName(f: Finestra, s: Selezione) {
  return s.source === 'deck' ? turnCardName(f.d.left[s.index], -1, f.d) : turnCardName(f.d.drawn[s.index], s.index, f.d);
}
export function zoneD(f: Finestra, w: number) { return Math.round(Math.min(14, w * 0.3)); }
// (larghezza vera, anche con decimali: le carte arrivano al pixel dove finisce la riga)
export function rowWidth(f: Finestra) {
  const w = f.row.getBoundingClientRect().width;
  return (Math.abs(w - f.row.offsetWidth) < 1 ? w : w / pageZoom(f)) || 343;
}
// st: { holding: null | 'pile' | 'deck', selected: carta selezionata, dragDeck: carta del mazzo trascinata, dragIndex:
// sua posizione nel mazzo }
// st.n, st.k: numero di carte del mazzo e degli scarti da supporre (solo per misurare: la carta in rowGeometry, il
// carattere dei titoli in layoutHeads)
export function rowItems(f: Finestra, w: number, st: { holding: Selezione['source'] | null; selected?: Selezione | null; dragDeck?: boolean; dragIndex?: number | null; n?: number; k?: number }): OggettoRiga[] {
  const k = st.k ?? f.d.drawn.length, n = st.n ?? f.d.left.length;
  const zd = zoneD(f, w);
  const tight = !!st.holding;
  // carta come si vede: con una carta in mano le altre all'85% (anche il segnaposto), quella selezionata al 100%
  const sc = (source: Selezione['source'], i: number) => !tight ? 1 : (st.selected && st.selected.source === source && st.selected.index === i ? 1 : 0.85);
  const item = (kind: OggettoRiga['kind'], vis: number, i = -1, on?: OggettoRiga): OggettoRiga => ({ kind, i, vis, left: 0, right: 0, ...(on ? { on } : {}) });
  const items: OggettoRiga[] = [];
  if (k) for (let i = 0; i < k; i++) items.push(item('pile', sc('pile', i) * w, i));
  else items.push(item('pileEmpty', w));
  // Senza scarti il cerchio degli scarti sta al centro del posto tratteggiato
  if (st.holding === 'deck') items.push(k ? item('pileZone', zd) : item('pileZone', zd, -1, items[0]));
  items.push(item('divider', 1));
  // (Cima e Fondo solo se nel mazzo c'è una carta vera oltre a quella in mano, trascinata o selezionata)
  const mReal = n - (st.holding === 'deck' ? 1 : 0);
  const ends = tight && mReal > 0;
  const deckIt = n ? Array.from({ length: n }, (x, i) => item('deck', sc('deck', i) * w, i)) : [item('deckEmpty', (tight ? 0.85 : 1) * w)];
  // Mazzo vuoto con una carta degli scarti in mano: il cerchio sta al centro del posto tratteggiato
  if (tight && !n) items.push(item('top', zd, -1, deckIt[0]));
  // Trascinando la carta in cima (in fondo) il cerchio Cima (Fondo) sta sul suo segnaposto
  const ph = st.dragDeck && st.dragIndex !== null && st.dragIndex !== undefined ? st.dragIndex : -1;
  if (ends) items.push(ph === 0 ? item('top', zd, -1, deckIt[0]) : item('top', zd));
  items.push(...deckIt);
  if (ends) items.push(ph === n - 1 ? item('bottom', zd, -1, deckIt[n - 1]) : item('bottom', zd));
  return items;
}
// k, n: carte negli scarti e nel mazzo (quelle della finestra; altri valori servono a misurare un'altra disposizione)
export function rowGeometry(f: Finestra, k = f.d.drawn.length, n = f.d.left.length) {
  const W = rowWidth(f);
  const states: { holding: Selezione['source'] | null; selected?: Selezione; dragDeck?: boolean; n: number; k: number }[] = [{ holding: null, n, k }];
  if (k) states.push({ holding: 'pile', selected: { source: 'pile', index: 0 }, n, k });
  // Mazzo vuoto o con una carta sola: la carta ha la stessa misura (e le scritte dei titoli lo stesso spazio), come
  // se ci fosse una carta
  const m = Math.max(n, 1);
  states.push({ holding: 'deck', dragDeck: true, n: m, k }, { holding: 'deck', selected: { source: 'deck', index: 0 }, n: m, k });
  let w = TURN_W_MAX;
  while (w > TURN_W_MIN && !states.every(st => spaceItems(rowItems(f, w, st), W) >= TURN_GAP_MIN - 1e-6)) w -= 0.5;
  w = Math.max(TURN_W_MIN, w);
  return { k, n, w, h: w * 88 / 63, W };
}
// Carte del mazzo da mostrare: tutte, tranne quella del mazzo che si sta trascinando (la sua copia segue il dito e le
// altre si stringono senza di lei)
export function shownOrder(f: Finestra) {
  const order = f.d.left.map((k, i) => i);
  if (f.drag && f.drag.source === 'deck') order.splice(f.drag.index, 1);
  return order;
}
// Carte del mazzo come si VEDONO: con una carta del mazzo trascinata, al suo posto resta un segnaposto grigio chiaro
// (la carta stessa, .is-dragging), piccolo come le altre. Le destinazioni restano quelle di shownOrder: un posto
// della fila vista dopo il segnaposto vale uno in meno (prima o dopo il segnaposto = stesso posto)
export function displayOrder(f: Finestra) {
  return f.d.left.map((k, i) => i);
}
export function placeholderAt(f: Finestra) {
  return f.drag && f.drag.source === 'deck' ? f.drag.index : -1;
}
// order: non serve (la fila vista è sempre tutto il mazzo, col segnaposto); lifted: carta sollevata.
// over: destinazione della carta trascinata ({ type: 'top' | 'bottom' | 'pos' | 'pile', index } nella fila VISTA) o null
export function layoutFan(f: Finestra, order: number[] = displayOrder(f), lifted = -1, over: Destinazione | null = null) {
  void order;
  const g = rowGeometry(f);
  const { w, h, W } = g;
  const zd = zoneD(f, w);
  f.row.style.setProperty('--ae-turn-w', w + 'px');
  f.row.style.setProperty('--ae-turn-h', h + 'px');
  // Il segmento verticale sporge del 10% sopra le carte; la riga delle carte scende quanto serve perché il segmento
  // cominci a 16 + 8 (cuspide) + 4 (spazio) = 28px dall'alto della riga dei titoli, alta 32px
  const cuspGap = parseFloat(getComputedStyle(f.divider).getPropertyValue('--ae-cusp-gap')) || 4;
  f.row.style.marginTop = (16 + CUSP_H + cuspGap - 32 + 0.1 * h) + 'px';
  const holding = f.drag ? f.drag.source : f.sel ? f.sel.source : null;
  const tight = !!holding;
  const st = { holding, selected: f.sel, dragDeck: !!f.drag && f.drag.source === 'deck', dragIndex: f.drag ? f.drag.index : null };
  const items = rowItems(f, w, st);
  const gap = spaceItems(items, W);
  const one = (kind: OggettoRiga['kind']) => items.find(it => it.kind === kind) || null;
  // (carta: la scatola è larga w e scalata attorno al centro; il bordo visibile è it.left)
  const boxLeft = (it: OggettoRiga) => it.left - (w - it.vis) / 2;
  const dv = need(one('divider'), 'segmento verticale');
  // Scarti: l'area finisce dove comincia il segmento (niente margini), le carte in flusso con un margine sinistro
  // ciascuna (transizione .2s come le carte del mazzo)
  f.pileArea.style.width = dv.left + 'px';
  f.divider.style.marginLeft = f.divider.style.marginRight = '0px';
  const laneOff = dv.left + 1;
  const pileObjs = items.filter(it => it.kind === 'pile' || it.kind === 'pileEmpty');
  const pileNodes = f.d.drawn.length ? f.pileEls.map(c => c.parentElement) : [query(f.pileRow, '.ae-turn-pile-empty', HTMLElement)];
  let prevRight = 0;
  pileObjs.forEach((it, j) => {
    const node = pileNodes[j];
    if (!node) return;
    const bl = it.kind === 'pile' ? boxLeft(it) : it.left;
    node.style.marginLeft = (bl - prevRight) + 'px';
    prevRight = bl + w;
  });
  // Mazzo (coordinate della corsia = riga − laneOff)
  const deckObjs = items.filter(it => it.kind === 'deck');
  const m = deckObjs.length;
  // (posto della guida nella fila vista: 0 = prima della prima carta, m = dopo l'ultima)
  const overIdx = !over ? -1 : over.type === 'top' ? 0 : over.type === 'bottom' ? m : over.type === 'pos' ? over.index : -1;
  // Guida tra due carte del mazzo: quelle due si scostano di TURN_SPREAD ciascuna (la sinistra a sinistra, la destra a
  // destra) per farle spazio; solo da vedere: posti d'arrivo e centri (rowGeo) restano quelli senza scosto
  const spreadAt = tight && over && over.type === 'pos' && overIdx > 0 && overIdx < m ? overIdx : -1;
  const shiftOf = (kk: number) => spreadAt < 0 ? 0 : kk === spreadAt - 1 ? -TURN_SPREAD : kk === spreadAt ? TURN_SPREAD : 0;
  f.fanEls.forEach(c => c.classList.remove('is-away'));
  deckObjs.forEach((it, kk) => {
    const card = f.fanEls[it.i];
    if (!card) return;
    card.style.left = (boxLeft(it) + shiftOf(kk) - laneOff) + 'px';
    card.style.zIndex = String(1 + kk);
    card.classList.toggle('is-lifted', it.i === lifted);
    if (it.i === 0) {
      // Cerchio dell'occhio in proporzione alla carta (44px con la carta più larga)
      const eyeD = Math.round(Math.min(44, w * 0.6));
      f.revealTop.style.setProperty('--ae-eye-d', eyeD + 'px');
      f.revealTop.style.left = (it.left + it.vis / 2 - laneOff - eyeD / 2) + 'px';
      f.revealTop.style.top = (h / 2 - eyeD / 2) + 'px';
      f.revealTop.style.zIndex = String(2 + g.n);
    }
  });
  // "Rivela tutto": lungo quanto le carte del mazzo A RIPOSO e sotto di loro, fermo anche con una carta in mano
  const rest = rowItems(f, w, { holding: null });
  spaceItems(rest, W);
  const restDeck = rest.filter(it => it.kind === 'deck');
  const restFirst = need(restDeck.length ? restDeck[0] : rest.find(it => it.kind === 'deckEmpty'), 'posto del mazzo');
  const restLast = restDeck.length ? restDeck[restDeck.length - 1] : restFirst;
  f.revealAll.style.width = Math.max(44, restLast.right - restFirst.left) + 'px';
  f.revealAll.style.marginLeft = (restFirst.left - laneOff) + 'px';
  f.lane.classList.toggle('is-squeezed', tight);
  // Con una carta in mano (trascinata o selezionata) tutte le altre carte scendono all'85% (.is-holding)
  f.dialog.classList.toggle('is-holding', tight);
  f.lane.style.setProperty('--ae-lane-scale', '0.85');
  f.revealTop.hidden = !g.n || !!f.d.known[0] || tight;
  f.lane.style.setProperty('--ae-zone-d', zd + 'px');
  f.pileArea.style.setProperty('--ae-zone-d', zd + 'px');
  const top = one('top'), bottom = one('bottom');
  f.zoneTop.hidden = !top;
  f.zoneBottom.hidden = !bottom;
  if (top) Object.assign(f.zoneTop.style, { left: (top.left - laneOff) + 'px', width: zd + 'px' });
  if (bottom) Object.assign(f.zoneBottom.style, { left: (bottom.left - laneOff) + 'px', width: zd + 'px' });
  // Cerchio d'arrivo degli scarti (carta del mazzo in mano) e la sua guida
  const pz = one('pileZone');
  const toPile = !!over && over.type === 'pile';
  f.pileZone.hidden = !pz;
  // (cerchio sul posto vuoto degli scarti: il simbolo ∅ sotto di lui sparisce)
  f.pileArea.classList.toggle('has-zone', !!pz);
  f.pileZone.classList.toggle('is-over', toPile && !!pz);
  if (pz) Object.assign(f.pileZone.style, { left: pz.left + 'px', top: (h / 2 - zd / 2) + 'px' });
  f.pileInsert.hidden = !(toPile && pz);
  if (toPile && pz) Object.assign(f.pileInsert.style, { left: (pz.left + zd / 2 - 3) + 'px', width: '6px', top: '0px', height: h + 'px' });
  layoutTime(f, items, h);
  const mReal = g.n - (st.dragDeck ? 1 : 0);
  f.lane.classList.toggle('is-empty-target', tight && !mReal);
  // Titoli: la cuspide sul centro del segmento, "Scarti" a sinistra, "Mazzo turno" a destra
  const split = dv.left + 0.5;
  f.board.style.setProperty('--ae-split', split + 'px');
  layoutHeads(f, split);
  const empty = one('deckEmpty');
  // (il posto vuoto, come le carte, è largo w e scalato attorno al centro: il bordo visibile è empty.left)
  if (empty) placeEmpty(f, boxLeft(empty) - laneOff, h, w);
  f.rowGeo = { centers: deckObjs.map(it => it.left + it.vis / 2), split, n: m };
  // Guida (linea-pallino-linea): sul cerchio di Cima o Fondo, oppure a metà tra due carte
  f.zoneTop.classList.toggle('is-over', !!top && overIdx === 0);
  f.zoneBottom.classList.toggle('is-over', !!bottom && overIdx === m);
  f.insertBar.hidden = !tight || !over || toPile;
  if (!f.insertBar.hidden) {
    let x: number;
    if (!m) x = empty ? empty.left + w / 2 : laneOff;
    else if (overIdx <= 0) x = top ? top.left + zd / 2 : deckObjs[0].left - gap / 2;
    else if (overIdx >= m) x = bottom ? bottom.left + zd / 2 : deckObjs[m - 1].right + gap / 2;
    else x = (deckObjs[overIdx - 1].right + deckObjs[overIdx].left) / 2;
    // (alta come le carte al 100%, dall'alto al basso della carta)
    Object.assign(f.insertBar.style, { left: (x - laneOff - 3) + 'px', width: '6px', height: h + 'px', top: '0px' });
  }
}
export function fitHeadNoGrow(f: Finestra, node: HTMLElement, maxW: number, allowTwo?: boolean) {
  const prevFs = node.style.fontSize, prevLs = node.style.letterSpacing, prevTwo = node.classList.contains('is-two-lines');
  const prevW = textW(f, node);
  fitHead(f, node, maxW, allowTwo);
  if (f.headsGrowing || f.heads.classList.contains('is-settling') || reducedMotion.matches) return false;
  if (textW(f, node) > prevW + 0.5) {
    node.style.fontSize = prevFs;
    node.style.letterSpacing = prevLs;
    node.classList.toggle('is-two-lines', prevTwo);
    return true;
  }
  return false;
}
export function scheduleHeadsGrow(f: Finestra) {
  clearTimeout(f.headsGrowTimer);
  f.headsGrowTimer = setTimeout(() => {
    if (!f.dialog.isConnected) return;
    f.headsGrowing = true;
    f.heads.classList.add('is-settling');
    layoutHeads(f, f.lastHeadsCx);
    void f.heads.offsetWidth;
    f.heads.classList.remove('is-settling');
    f.headsGrowing = false;
  }, 220);
}
// Posizione del segmento verticale nella disposizione peggiore per "Mazzo turno": a riposo, tutte le carte negli scarti
function worstSplit(f: Finestra): number {
  const g = rowGeometry(f, f.d.drawn.length + f.d.left.length, 0);
  const items = rowItems(f, g.w, { holding: null, k: g.k, n: 0 });
  spaceItems(items, g.W);
  return need(items.find(it => it.kind === 'divider'), 'segmento verticale').left + 0.5;
}
export function layoutHeads(f: Finestra, cx: number) {
  f.lastHeadsCx = cx;
  const W = f.heads.clientWidth || f.board.clientWidth;
  // (fino a 4px prima dell'icona di Mescola, non del suo pulsante, che è più largo)
  const iconEl = f.shuffleBtn.querySelector('.ae-icon');
  const hr = f.heads.getBoundingClientRect();
  // (senza Mescola la scritta arriva al bordo destro della riga delle carte, mai oltre)
  const right = f.shuffleBtn.hidden || !iconEl ? W : Math.min(W, (iconEl.getBoundingClientRect().left - hr.left) / pageZoom(f) - HEAD_GAP);
  // Scarti: tra 0 e la cuspide
  const leftEnd = cx - CUSP_HALF;
  let grow = fitHeadNoGrow(f, f.pileHead, Math.max(0, leftEnd - HEAD_GAP));
  // Con una carta sola nel mazzo (o nessuna) "Mazzo turno" ha lo stesso carattere che a mazzo vuoto, con una carta in
  // mano o no: lo spazio è quello della disposizione peggiore (tutte le carte negli scarti, mazzo vuoto)
  const fitFrom = f.d.left.length < 2 ? worstSplit(f) + CUSP_HALF : 0;
  const tw = textW(f, f.pileHead);
  const x0 = Math.max(0, Math.min((leftEnd - tw) / 2, leftEnd - HEAD_GAP - tw));
  f.pileHead.style.left = x0 + 'px';
  // Mazzo turno: tra la cuspide e Mescola, allineata a destra. Se su una riga non ci sta va su due, "Mazzo" sopra e
  // "Turno" sotto, allineate a destra; poi, se serve, il carattere scende. Il blocco di due righe è centrato sulla
  // linea dei titoli, a 16,5px dall'alto
  const rightStart = cx + CUSP_HALF;
  fitHead(f, f.deckHead, Math.max(0, right - Math.max(rightStart, fitFrom) - HEAD_GAP), true);
  if (grow) scheduleHeadsGrow(f);
  f.deckHead.style.top = f.deckHead.classList.contains('is-two-lines')
    ? (16.5 - f.deckHead.getBoundingClientRect().height / pageZoom(f) / 2) + 'px' : '';
  const tw2 = textW(f, f.deckHead);
  const x2 = Math.max(rightStart + HEAD_GAP, right - tw2);
  f.deckHead.style.left = x2 + 'px';
  // Tratti di linea: [0 → Scarti], [Scarti → cuspide], [cuspide → Mazzo turno]
  const segs = [[0, x0 - LINE_PAD], [x0 + tw + LINE_PAD, leftEnd], [rightStart, x2 - LINE_PAD]];
  segs.forEach(([a, b], i) => {
    const line = f.headLines[i];
    const len = b - a;
    line.hidden = len < LINE_MIN;
    if (!line.hidden) Object.assign(line.style, { left: a + 'px', width: len + 'px' });
  });
}
// Larghezza esatta della scritta in pixel CSS (non scrollWidth, che arrotonda ai pixel interi)
export function textW(f: Finestra, node: Element) { return node.getBoundingClientRect().width / pageZoom(f); }
// Scritta che non deve superare maxW: il carattere scende (fino a 8px) finché ci sta. allowTwo ("Mazzo turno"):
// prima di rimpicciolire si prova su due righe
export function fitHead(f: Finestra, node: HTMLElement, maxW: number, allowTwo?: boolean) {
  node.style.fontSize = '';
  node.style.letterSpacing = '';
  node.classList.remove('is-two-lines');
  if (allowTwo && textW(f, node) > maxW) node.classList.add('is-two-lines');
  let size = parseFloat(getComputedStyle(node).fontSize) || 12;
  for (let i = 0; i < 12 && textW(f, node) > maxW && size > 8; i++) {
    size = Math.max(8, size - 0.5);
    node.style.fontSize = size + 'px';
  }
  // (ultima risorsa, se a 8px non ci sta ancora: senza spazio tra le lettere)
  if (textW(f, node) > maxW) node.style.letterSpacing = '0';
}
// Posto del mazzo vuoto (tratteggiato, con il simbolo ∅): largo e alto come una carta; left = bordo sinistro del posto
// nella corsia, dalla disposizione della riga
export function placeEmpty(f: Finestra, left: number, h: number, w: number) {
  const e = query(f.lane, '.ae-turn-fan-empty', HTMLElement);
  if (!e) return;
  Object.assign(e.style, { left: left + 'px', right: 'auto', width: w + 'px', height: h + 'px', transform: 'none' });
}
// Posto d'inserimento (0 = in cima, n = in fondo) per la carta che sta in x sul mazzo stretto: il numero di carte il
// cui centro (nella disposizione finale, in coordinate della riga) sta a sinistra di x; la riga non si sposta durante
// le transizioni, la corsia sì
export function pileSlotAt(f: Finestra, x: number) {
  const t = f.rowGeo;
  if (!t || !t.n) return 0;
  const rel = (x - f.row.getBoundingClientRect().left) / pageZoom(f);
  return t.centers.filter(c => c < rel).length;
}
// Destinazioni permesse per la carta s (solo quelle si evidenziano): carta del mazzo = la corsia del mazzo; carta
// degli scarti = Cima, Fondo e qualunque posto tra le carte del mazzo
export function markTargets(f: Finestra, s: Selezione | null) {
  const any = !!s;
  f.zoneTop.classList.toggle('is-target', any && s.source === 'pile');
  f.zoneBottom.classList.toggle('is-target', any && s.source === 'pile');
  f.lane.classList.toggle('is-target', any);
  f.dialog.classList.toggle('is-choosing', any);
}
