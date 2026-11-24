// ui/schermate/nuova-partita-anteprima.ts: l'anteprima della nemesi scelta nella pagina Nuova partita: la carta che si
// apre e si chiude, si gira (fronte e retro con setup e storia) e si ingrandisce con le dita. File di supporto di
// nuova-partita.ts.
// Livello 5 (ui/schermate/). Dipende da: stato/ (catalogo, preferenze), ui/ base (pagina, dom, testi). Usato da:
// nuova-partita.ts.
import { catalogo } from '../../stato/catalogo.ts';
import { preferenze } from '../../stato/preferenze.ts';
import { el, pageEl, query } from '../dom.ts';
import { byId, DRAG_THRESHOLD, SWIPE_MIN_DISTANCE } from '../pagina.ts';
import { I18N_IT } from '../testi.ts';

interface Punto { x: number; y: number }

// Carta della nemesi scelta: chiusa di default. Sul pulsante della nemesi scelta c'è una freccia verso il basso che
// la apre subito sotto il pulsante; in cima alla carta una freccia verso l'alto la richiude.
export let nemesisPreviewOpen = false;

// L'anteprima risulta chiusa (senza ridisegnarla): nemesi cambiata, wave cambiata, pagina ridisegnata
export function segnaAnteprimaChiusa(): void {
  nemesisPreviewOpen = false;
}

export const CHEVRON_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">'
  + '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function chevronButton(className: string, label: string, handler: () => void): HTMLButtonElement {
  const b = el('button', 'nemesis-toggle ' + className);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.setAttribute('aria-controls', 'nemesis-preview');
  b.innerHTML = CHEVRON_SVG;
  b.addEventListener('click', handler);
  return b;
}

export function setNemesisPreview(open: boolean): void {
  nemesisPreviewOpen = open;
  renderNemesisPreview();
  const target = open ? query(document, '#nemesis-preview .nemesis-collapse', HTMLElement)
    : query(document, '.nemesis-item.is-selected .nemesis-expand', HTMLElement);
  if (target) target.focus({ preventScroll: true });
  if (open) {
    const preview = document.getElementById('nemesis-preview');
    if (preview) preview.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

export function renderNemesisPreview(): void {
  const list = byId('nemesis-list', HTMLDivElement);
  let preview = document.getElementById('nemesis-preview');
  if (!preview) {
    // index.html vecchio ancora in cache del browser: il riquadro si crea qui
    preview = el('figure', 'nemesis-preview');
    preview.id = 'nemesis-preview';
    const image = el('img');
    image.alt = '';
    image.decoding = 'async';
    preview.appendChild(image);
  }
  if (!preview.querySelector('.nemesis-collapse')) {
    preview.prepend(chevronButton('nemesis-collapse', I18N_IT.hideNemesisCard, () => setNemesisPreview(false)));
  }
  if (!preview.querySelector('.nemesis-flip')) buildNemesisFlip(preview);
  // La carta sta subito dopo il pulsante della nemesi scelta, su tutta la larghezza della lista
  const item = list.querySelector('.nemesis-item.is-selected');
  if (item) item.after(preview); else list.after(preview);

  const nemesis = preferenze.settings.nemesis;
  const art = nemesis ? catalogo.nemesisArt[nemesis] : undefined;
  const open = !!art && nemesisPreviewOpen;
  preview.hidden = !open;
  const expand = item && query(item, '.nemesis-expand', HTMLElement);
  if (expand) {
    expand.hidden = open;
    expand.setAttribute('aria-expanded', String(open));
  }
  if (!open || !art || !nemesis) {
    // Chiusa: la prossima volta si riapre dal fronte e non ingrandita
    resetNemesisZoom();
    nemesisShowBack = false;
    nemesisFlipAngle = 0;
    const inner = pageEl(preview, '.nemesis-flip-inner', HTMLElement);
    inner.style.transition = 'none';
    inner.style.transform = '';
    pageEl(preview, '.nemesis-flip', HTMLElement).classList.remove('is-back');
    return;
  }
  const front = pageEl(preview, '.nemesis-face--front', HTMLImageElement);
  const back = pageEl(preview, '.nemesis-face--back', HTMLImageElement);
  front.alt = I18N_IT.nemesisCard(nemesis);
  const src = encodeURI(art.card);
  if (front.getAttribute('src') !== src) front.src = src;
  // Retro (setup e storia), se c'è: si vede con uno slide sulla carta
  const flip = pageEl(preview, '.nemesis-flip', HTMLElement);
  flip.classList.toggle('has-back', !!art.back);
  if (art.back) {
    back.alt = I18N_IT.nemesisCardBack(nemesis);
    const backSrc = encodeURI(art.back);
    if (back.getAttribute('src') !== backSrc) back.src = backSrc;
  } else {
    back.removeAttribute('src');
    nemesisShowBack = false;
    nemesisFlipAngle = 0;
    pageEl(preview, '.nemesis-flip-inner', HTMLElement).style.transform = '';
  }
  updateNemesisFlip(preview);
}

// Fronte e retro della carta nemesi aperta: uno slide orizzontale (destra o sinistra) la gira
export let nemesisShowBack = false;

export function buildNemesisFlip(preview: HTMLElement): void {
  const flip = el('div', 'nemesis-flip');
  const inner = el('div', 'nemesis-flip-inner');
  let front = preview.querySelector('img');
  if (!front) front = el('img');
  front.className = 'nemesis-face nemesis-face--front';
  front.decoding = 'async';
  const back = el('img', 'nemesis-face nemesis-face--back');
  back.alt = '';
  back.decoding = 'async';
  inner.append(front, back);
  flip.appendChild(inner);
  const dots = el('div', 'nemesis-flip-dots');
  dots.setAttribute('aria-hidden', 'true');
  dots.append(el('span'), el('span'));
  preview.append(flip, dots);

  // Zoom con due dita sul lato che si vede: sopra la carta compare un livello con la stessa immagine, ingrandita dentro
  // il riquadro della carta (fino a NEMESIS_ZOOM_MAX); da ingrandita un dito la sposta e un doppio tocco torna normale.
  // Il livello evita di ingrandire la carta che si gira in 3D (le due facce).
  const zoom: { scale: number; tx: number; ty: number; layer: HTMLDivElement | null; img: HTMLImageElement | null } =
    { scale: 1, tx: 0, ty: 0, layer: null, img: null };
  const pointers = new Map<number, Punto>();
  let pinch: { d: number; s: number; m: Punto; tx: number; ty: number } | null = null;
  let pan: { x: number; y: number; tx: number; ty: number; moved: boolean } | null = null;
  let lastTap: number | null = null;
  const applyZoom = (animate: boolean) => {
    const img = zoom.img;
    if (!img) return;
    const w = flip.offsetWidth, h = flip.offsetHeight;
    const maxX = Math.max(0, (w * zoom.scale - w) / 2), maxY = Math.max(0, (h * zoom.scale - h) / 2);
    zoom.tx = Math.max(-maxX, Math.min(maxX, zoom.tx));
    zoom.ty = Math.max(-maxY, Math.min(maxY, zoom.ty));
    img.style.transition = animate ? 'transform .2s ease-out' : 'none';
    img.style.transform = `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})`;
  };
  const openZoomLayer = () => {
    if (zoom.layer) return;
    const nemesis = preferenze.settings.nemesis;
    const art = nemesis !== null ? catalogo.nemesisArt[nemesis] : undefined;
    if (!art) return;
    const showBack = nemesisShowBack && !!art.back;
    const layer = el('div', 'nemesis-zoom-layer');
    layer.setAttribute('aria-hidden', 'true');
    const img = el('img');
    img.alt = '';
    img.draggable = false;
    img.src = encodeURI(showBack && art.back ? art.back : art.card);
    layer.appendChild(img);
    zoom.layer = layer;
    zoom.img = img;
    flip.appendChild(layer);
    flip.classList.add('is-zoomed');
  };
  const resetZoom = () => {
    if (zoom.layer) zoom.layer.remove();
    zoom.layer = null;
    zoom.img = null;
    zoom.scale = 1;
    zoom.tx = 0;
    zoom.ty = 0;
    pinch = null;
    pan = null;
    flip.classList.remove('is-zoomed');
  };
  resetNemesisZoom = resetZoom;
  // Punto (relativo al centro della carta) che resta sotto le dita / sotto il tocco
  const local = (x: number, y: number): Punto => { const r = flip.getBoundingClientRect(); return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 }; };
  const zoomAt = (scale: number, p: Punto, animate: boolean) => {
    const ix = (p.x - zoom.tx) / zoom.scale, iy = (p.y - zoom.ty) / zoom.scale;
    zoom.scale = Math.max(1, Math.min(NEMESIS_ZOOM_MAX, scale));
    zoom.tx = p.x - ix * zoom.scale;
    zoom.ty = p.y - iy * zoom.scale;
    applyZoom(animate);
  };

  // La carta ruota seguendo il dito (tutta la larghezza della carta = mezzo giro). Al rilascio: oltre
  // SWIPE_MIN_DISTANCE completa il mezzo giro nella direzione del dito, altrimenti torna com'era. Il retro si vede solo
  // così (un tocco non gira la carta) e non mentre la carta è ingrandita.
  let drag: { x: number; y: number; id: number; dx: number; active: boolean } | null = null;
  const setAngle = (deg: number, animate: boolean) => {
    inner.style.transition = animate ? '' : 'none';
    inner.style.transform = `rotateY(${deg}deg)`;
  };
  flip.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      // Secondo dito: niente giro, comincia lo zoom
      if (drag) { setAngle(nemesisFlipAngle, true); drag = null; }
      pointers.forEach((p, id) => { try { flip.setPointerCapture(id); } catch (_) { /* niente cattura */ } });
      openZoomLayer();
      if (!zoom.layer) return;
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: zoom.scale, m: local((a.x + b.x) / 2, (a.y + b.y) / 2), tx: zoom.tx, ty: zoom.ty };
      pan = null;
      return;
    }
    if (pointers.size !== 1) return;
    if (zoom.layer) {
      try { flip.setPointerCapture(e.pointerId); } catch (_) { /* niente cattura */ }
      pan = { x: e.clientX, y: e.clientY, tx: zoom.tx, ty: zoom.ty, moved: false };
      return;
    }
    if (!flip.classList.contains('has-back')) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId, dx: 0, active: false };
  });
  flip.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2 && zoom.layer) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const m = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      // Il punto dell'immagine che era sotto le dita all'inizio resta sotto le dita
      const ix = (pinch.m.x - pinch.tx) / pinch.s, iy = (pinch.m.y - pinch.ty) / pinch.s;
      zoom.scale = Math.max(1, Math.min(NEMESIS_ZOOM_MAX, pinch.s * d / pinch.d));
      zoom.tx = m.x - ix * zoom.scale;
      zoom.ty = m.y - iy * zoom.scale;
      applyZoom(false);
      return;
    }
    if (pan) {
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) pan.moved = true;
      zoom.tx = pan.tx + dx;
      zoom.ty = pan.ty + dy;
      applyZoom(false);
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(dx) < DRAG_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
      drag.active = true;
      try { flip.setPointerCapture(e.pointerId); } catch (_) { /* niente cattura */ }
    }
    drag.dx = dx;
    const width = flip.offsetWidth || 300;
    setAngle(nemesisFlipAngle + Math.max(-180, Math.min(180, dx / width * 180)), false);
  });
  const endZoomGesture = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!zoom.layer) return;
    if (pointers.size === 1) {
      // Da due dita a una: si continua a spostare con quella rimasta
      const [p] = [...pointers.values()];
      pan = { x: p.x, y: p.y, tx: zoom.tx, ty: zoom.ty, moved: true };
      return;
    }
    if (pointers.size) return;
    // Doppio tocco sulla carta ingrandita: torna normale
    if (pan && !pan.moved && e.type === 'pointerup') {
      const now = performance.now();
      if (lastTap && now - lastTap < 320) { lastTap = null; zoomAt(1, { x: 0, y: 0 }, true); }
      else lastTap = now;
    }
    pan = null;
    if (zoom.scale < 1.05) resetZoom();
  };
  const endDrag = (e: PointerEvent, cancelled: boolean) => {
    endZoomGesture(e);
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const { dx, active } = drag;
    drag = null;
    // Un tocco senza trascinare non gira la carta: il retro si vede solo con lo swipe
    if (!active) return;
    if (!cancelled && Math.abs(dx) >= SWIPE_MIN_DISTANCE) {
      nemesisFlipAngle += dx > 0 ? 180 : -180;
      nemesisShowBack = !nemesisShowBack;
    }
    setAngle(nemesisFlipAngle, true);
    updateNemesisFlip(preview);
  };
  flip.addEventListener('pointerup', e => endDrag(e, false));
  flip.addEventListener('pointercancel', e => endDrag(e, true));
}

export let nemesisFlipAngle = 0;

export const NEMESIS_ZOOM_MAX = 4;

// Toglie lo zoom della carta nemesi (carta chiusa o cambiata); la imposta buildNemesisFlip
export let resetNemesisZoom: () => void = () => {};

export function updateNemesisFlip(preview: HTMLElement): void {
  const flip = pageEl(preview, '.nemesis-flip', HTMLElement);
  const showBack = nemesisShowBack && flip.classList.contains('has-back');
  flip.classList.toggle('is-back', showBack);
  pageEl(preview, '.nemesis-face--front', HTMLElement).setAttribute('aria-hidden', String(showBack));
  pageEl(preview, '.nemesis-face--back', HTMLElement).setAttribute('aria-hidden', String(!showBack));
  const dots = pageEl(preview, '.nemesis-flip-dots', HTMLElement);
  dots.hidden = !flip.classList.contains('has-back');
  dots.children[0].classList.toggle('is-on', !showBack);
  dots.children[1].classList.toggle('is-on', showBack);
}
