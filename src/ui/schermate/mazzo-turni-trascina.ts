// ui/schermate/mazzo-turni-trascina.ts: tocchi e trascinamento nella schermata del mazzo dei turni (selezione, rilascio su
// Cima, Fondo, tra due carte o negli scarti) e Mescola con l'animazione. File di supporto di mazzo-turni.ts.
// Livello 5 (ui/schermate/). Dipende da: ui/ base (pagina, dom), ui/componenti/animazioni.ts, mazzo-turni-bozza.ts,
// mazzo-turni-disegno.ts e mazzo-turni-riga.ts (supporto). Usato da: mazzo-turni.ts.

import { animDone } from '../componenti/animazioni.ts';
import { query } from '../dom.ts';
import { TURN_DRAG_PX, turnDraftOps } from './mazzo-turni-bozza.ts';
import type { Destinazione, Finestra, Selezione } from './mazzo-turni-bozza.ts';
import { displayOrder, draw, inPileZone, layoutFan, markTargets, pileSlotAt, placeholderAt, rowGeometry,
  shownOrder } from './mazzo-turni-disegno.ts';
import { inCardBand } from './mazzo-turni-riga.ts';
import { reducedMotion } from '../pagina.ts';

export function dropOn(f: Finestra, target: Destinazione, s: Selezione) {
  let ok = false;
  if (s.source === 'deck' && target.type === 'pile') {
    ok = turnDraftOps.deckToPile(f.d, s.index);
  } else if (s.source === 'deck') {
    const to = target.type === 'pos' ? target.index : target.type === 'bottom' ? f.d.left.length - 1 : 0;
    ok = turnDraftOps.moveInDeck(f.d, s.index, to);
  } else {
    // ('pile' non è una posizione del mazzo: vale 0, la cima)
    ok = turnDraftOps.pileToDeck(f.d, s.index, target.type === 'pos' ? target.index : target.type === 'pile' ? 0 : target.type);
  }
  f.sel = null;
  draw(f);
  return ok;
}
// Carta (del mazzo o degli scarti) da un evento sulla carta stessa
export function eventCard(f: Finestra, e: Event): { card: HTMLElement; source: Selezione['source']; index: number } | null {
  const card = e.currentTarget;
  if (!(card instanceof HTMLElement)) return null;
  return { card, source: card.dataset.source === 'pile' ? 'pile' : 'deck', index: Number(card.dataset.index) };
}
// Tocco / Invio: seleziona la carta; con una carta selezionata, toccare una carta del mazzo la mette lì (carta del
// mazzo: al suo posto; carta degli scarti: nella sua posizione, le altre scendono); toccare di nuovo la stessa carta
// toglie la selezione
export function onCardClick(f: Finestra, e: MouseEvent) {
  if (f.suppressClick) { f.suppressClick = false; return; }
  if (f.shuffling || f.closing) return;
  const ev = eventCard(f, e);
  if (!ev) return;
  const { card, source, index } = ev;
  if (f.sel && f.sel.source === source && f.sel.index === index) { f.sel = null; draw(f); return; }
  // (carta degli scarti selezionata: va al posto della carta toccata, che scende di uno; oppure su Cima o Fondo)
  if (f.sel && source === 'deck') { dropOn(f, { type: 'pos', index }, f.sel); return; }
  // (carta del mazzo selezionata, poi una carta degli scarti: va in fondo agli scarti)
  if (f.sel && f.sel.source === 'deck' && source === 'pile') { dropOn(f, { type: 'pile' }, f.sel); return; }
  if (!card.classList.contains('is-movable')) return;
  f.sel = { source, index };
  draw(f);
  const again = query(f.dialog, `.ae-turn-card[data-source="${source}"][data-index="${index}"]`, HTMLElement);
  if (again) again.focus({ preventScroll: true });
}
// Trascinamento: la carta si solleva e segue il dito appena il dito si sposta (senza tenere premuto)
export function onPointerDown(f: Finestra, e: PointerEvent) {
  if (e.button > 0 || f.drag || f.press || f.shuffling || f.closing) return;
  const ev = eventCard(f, e);
  if (!ev) return;
  f.press = { card: ev.card, source: ev.source, index: ev.index, x: e.clientX, y: e.clientY, id: e.pointerId };
  window.addEventListener('pointermove', f.h.onPointerMove, { passive: false });
  window.addEventListener('pointerup', f.h.onPointerUp);
  window.addEventListener('pointercancel', f.h.onPointerCancel);
}
export function stopListening(f: Finestra) {
  window.removeEventListener('pointermove', f.h.onPointerMove);
  window.removeEventListener('pointerup', f.h.onPointerUp);
  window.removeEventListener('pointercancel', f.h.onPointerCancel);
}
export function startDrag(f: Finestra) {
  if (!f.press) return;
  const { card, source, index } = f.press;
  const r = card.getBoundingClientRect();
  const ghost = card.cloneNode(true);
  if (!(ghost instanceof HTMLElement)) return;
  ghost.classList.add('ae-turn-ghost');
  ghost.classList.remove('is-old', 'is-away', 'is-lifted', 'is-selected');
  ghost.removeAttribute('id');
  // La copia non deve portarsi dietro il livello (z-index) scritto sulla carta del mazzo dalla fila: con quello
  // (1-6 invece di 1000) resterebbe sotto la finestra e la carta del mazzo trascinata non si vedrebbe
  ghost.style.zIndex = '';
  ghost.style.translate = '';
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  document.body.appendChild(ghost);
  // La carta sale sopra il dito (centrata, con il bordo inferiore 16px sopra il dito), così il dito non la copre
  f.drag = { source, index, ghost, dx: r.width / 2, dy: r.height + 16, w: r.width, h: r.height, target: null };
  card.classList.add('is-dragging');
  f.sel = null;
  markTargets(f, { source, index });
  f.dialog.classList.add('is-dragging', 'is-dragging-' + source);
  f.press = null;
  // Presa una carta (degli scarti o del mazzo), il mazzo si stringe e compaiono Cima e Fondo
  layoutFan(f);
  // Piccola vibrazione quando la carta si solleva (solo dopo un tocco vero: altrimenti il browser la blocca)
  const touched = !navigator.userActivation || navigator.userActivation.hasBeenActive;
  if (navigator.vibrate && touched) { try { navigator.vibrate(10); } catch (err) { /* niente vibrazione */ } }
}
export function hit(f: Finestra, rect: DOMRect, x: number, y: number, pad = 12) {
  return x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad;
}
export function onPointerMove(f: Finestra, e: PointerEvent) {
  if (f.press && !f.drag) {
    // Il dito si è spostato: parte il trascinamento; finché è fermo resta un tocco
    if (Math.hypot(e.clientX - f.press.x, e.clientY - f.press.y) < TURN_DRAG_PX) return;
    startDrag(f);
  }
  if (!f.drag) return;
  e.preventDefault();
  f.drag.ghost.style.transform = `translate(${e.clientX - f.drag.dx - parseFloat(f.drag.ghost.style.left)}px, ${e.clientY - f.drag.dy - parseFloat(f.drag.ghost.style.top)}px)`;
  // La carta si porta ovunque nello schermo; il rilascio riesce solo su una destinazione valida. Conta dove sta la
  // carta (il suo centro, sopra il dito), non il dito. Carta del mazzo e carta degli scarti si spostano allo stesso
  // modo: su Cima o Fondo (ai lati) o in mezzo alle altre carte del mazzo (strette), nel posto sotto la carta; il
  // segmento dorato dice dove
  const x = e.clientX - f.drag.dx + f.drag.w / 2;
  const y = e.clientY - f.drag.dy + f.drag.h / 2;
  const order = shownOrder(f);
  const ph = placeholderAt(f);
  let target: Destinazione | null = null;
  let shownPos = -1; // posto nella fila VISTA (con il segnaposto), per la guida e le carte che si allargano
  const laneRect = f.lane.getBoundingClientRect();
  // Carta del mazzo sugli scarti (zona "scarti" = tutta l'area a sinistra del centro del segmento verticale, nella
  // fascia verticale delle zone di rilascio: nessuna fascia morta tra scarti e Cima): va in fondo a destra degli
  // scarti (il turno di quella carta è perso). Tutte le zone valgono solo nella fascia delle carte più 24px sopra e
  // 32px sotto (inCardBand)
  if (f.drag.source === 'deck' && inPileZone(f, x, y, laneRect)) target = { type: 'pile' };
  else if (!inCardBand(y, laneRect.top, laneRect.bottom)) target = null;
  else if (hit(f, f.zoneTop.getBoundingClientRect(), x, y, 6) && !f.zoneTop.hidden) target = { type: 'top' };
  else if (hit(f, f.zoneBottom.getBoundingClientRect(), x, y, 6) && !f.zoneBottom.hidden) target = { type: 'bottom' };
  else if (x >= laneRect.left - 24 && x <= laneRect.right + 24) {
    if (order.length) {
      shownPos = pileSlotAt(f, x);
      target = { type: 'pos', index: ph >= 0 && shownPos > ph ? shownPos - 1 : shownPos };
      // La carta in cima (in fondo) presa e lasciata al suo posto = Cima (Fondo), il cerchio sul segnaposto
      const last = f.d.left.length - 1;
      if (ph === 0 && target.type === 'pos' && target.index === 0 && !f.zoneTop.hidden) { target = { type: 'top' }; shownPos = -1; }
      else if (ph === last && target.type === 'pos' && target.index === last && !f.zoneBottom.hidden) { target = { type: 'bottom' }; shownPos = -1; }
    } else target = { type: 'top' };
  }
  f.drag.target = target;
  f.lane.classList.toggle('is-over', !!target && target.type === 'pos');
  layoutFan(f, displayOrder(f), -1, shownPos >= 0 ? { type: 'pos', index: shownPos } : target);
}
export function endDrag(f: Finestra, apply: boolean) {
  stopListening(f);
  if (f.press) f.press = null;
  if (!f.drag) return;
  const { source, index, target, ghost } = f.drag;
  ghost.remove();
  f.drag = null;
  f.dialog.classList.remove('is-dragging', 'is-dragging-deck', 'is-dragging-pile');
  f.lane.classList.remove('is-over');
  // Il click che segue il rilascio non deve selezionare la carta
  f.suppressClick = true;
  setTimeout(() => { f.suppressClick = false; }, 0);
  if (apply && target) dropOn(f, target, { source, index });
  else draw(f); // fuori zona: la carta torna al suo posto
}
export function onPointerUp(f: Finestra) { endDrag(f, true); }
export function onPointerCancel(f: Finestra) { endDrag(f, false); }
// Mescola con animazione: le carte si raccolgono al centro, si mischiano due volte (metà a sinistra, metà a destra) e
// si riaprono, coperte. Durante l'animazione la finestra non si tocca
export function runShuffle(f: Finestra) {
  if (f.drag || f.shuffling || f.closing) return;
  const g = rowGeometry(f);
  const animate = !reducedMotion.matches && !!f.lane.animate && f.fanEls.length > 1;
  if (!animate) { turnDraftOps.shuffle(f.d); f.sel = null; draw(f); return; }
  f.shuffling = true;
  f.dialog.classList.add('is-shuffling');
  // Le carte sono dritte in fila; si raccolgono al centro della fila (media delle posizioni: la fila è equispaziata)
  const cx = f.fanEls.reduce((s, c) => s + parseFloat(c.style.left || '0'), 0) / Math.max(1, f.fanEls.length);
  const toCenter = (c: HTMLElement) => (cx - parseFloat(c.style.left)) + 'px';
  const gather = f.fanEls.map(c => c.animate([{ translate: '0 0' }, { translate: toCenter(c) + ' 0' }],
    { duration: 220, easing: 'ease-in', fill: 'forwards' }));
  animDone(gather, 220).then(() => {
    if (f.closing || !f.dialog.isConnected) { f.shuffling = false; return; }
    turnDraftOps.shuffle(f.d);
    f.sel = null;
    draw(f);
    const s = Math.max(14, g.w * 0.45);
    const riffle = f.fanEls.map((c, i) => {
      const dx = toCenter(c);
      const side = (i % 2 ? 1 : -1) * s;
      const off = `calc(${dx} + ${side}px) -6px`;
      return c.animate([
        { translate: dx + ' 0', offset: 0 }, { translate: off, offset: .16 }, { translate: dx + ' 0', offset: .32 },
        { translate: off, offset: .48 }, { translate: dx + ' 0', offset: .64 }, { translate: '0 0', offset: 1 }
      ], { duration: 820, easing: 'ease-in-out' });
    });
    return animDone(riffle, 820);
  }).then(() => {
    f.shuffling = false;
    f.dialog.classList.remove('is-shuffling');
  });
}
