// ui/schermate/menu.ts: menu iniziale e pagina Nuova partita (giocatori, opzioni del mazzo, wave, nemesi con la sua
// carta). Provvisorio: Nuova partita andrà in un file suo.
// Dipende da: stato/ (catalogo, preferenze, partita, salvataggio), dati/ (dati, collezione), ui/ (testi, pagina), ui/componenti
// (componenti, dialoghi), ui/schermate (opzioni, test). Usato da: avvio, opzioni, crea-mazzo (scelte), Indietro.

import { I18N_IT } from '../testi.ts';
import { battleOf } from '../../dati/dati.ts';
import { collectionCatalog, isMiniCode, isPlayable, loadCollection, ownsProduct, productName, productOfNemesis, waveOfCode, waveOfNemesis } from '../../dati/collezione.ts';
import { deckShortfall, mergeActive, mergeLockedWave } from '../../stato/partita.ts';
import { el, icon, need, query } from '../componenti/componenti.ts';
import { button, showToast } from '../componenti/dialoghi.ts';
import { ensureCollectionButton, openCollection, openOptions, resumeGame } from './opzioni.ts';
import { readSave } from '../../stato/salvataggio.ts';
import { openTestScreen } from './test.ts';
import { catalogo, impostaSceltePagina } from '../../stato/catalogo.ts';
import { preferenze, loadDeckOptions, saveDeckOptions } from '../../stato/preferenze.ts';
import { DRAG_THRESHOLD, SWIPE_MIN_DISTANCE, byId, reducedMotion, resumeBtn, startBtn, startLayer } from '../pagina.ts';

// Un punto dello schermo
interface Punto { x: number; y: number }

// Elemento della pagina iniziale che c'è sempre (creato da index.html o dall'app)
function pageEl<T extends HTMLElement>(root: ParentNode, selector: string, type: abstract new () => T): T {
  return need(query(root, selector, type), selector);
}

// --- Pagina iniziale e nuova partita ---
export function renderPlayers(): void {
  const container = byId('choices-players', HTMLDivElement);
  const options = need(catalogo.startOptions, 'scelte della pagina iniziale');
  container.replaceChildren(...options.players.map(value => {
    const b = el('button', '', String(value));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(value === preferenze.settings.players));
    b.setAttribute('aria-label', I18N_IT.players(value));
    b.addEventListener('click', () => {
      preferenze.settings.players = value;
      renderPlayers();
      // Le opzioni del mazzo dipendono anche dai giocatori (blocco di "Unisci" e riga di avviso)
      if (catalogo.startOptions && document.getElementById('deck-options')) renderDeckOptions();
      pageEl(container, '[aria-pressed="true"]', HTMLElement).focus();
    });
    return b;
  }));
}

// Carta della nemesi scelta: chiusa di default. Sul pulsante della nemesi scelta c'è una freccia verso il basso che
// la apre subito sotto il pulsante; in cima alla carta una freccia verso l'alto la richiude.
export let nemesisPreviewOpen = false;

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

// Wave scelte nella pagina Nuova partita (anche più di una): si vedono le nemesi di tutte
export let selectedWaves: string[] = [];

// Numero della wave in cifre romane per mostrarla ("4 - The New Age" → "IV - The New Age"); il valore resta quello di
// nemesis.json
export function toRoman(n: number): string {
  const map: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  map.forEach(([v, s]) => { while (n >= v) { out += s; n -= v; } });
  return out;
}

// Nome della wave dal suo codice: "4" -> "IV - The New Age" (String: una wave mancante si legge "null", come prima)
export function waveLabel(wave: string | null): string {
  return toRoman(Number(wave)) + ' - ' + productName(String(wave));
}

// Nemesi delle wave scelte: prima le disponibili (pulsanti), le altre in un elenco chiuso e non interattivo
export function renderBosses(): void {
  const list = byId('nemesis-list', HTMLDivElement);
  // Per wave (nell'ordine delle wave); in ogni wave prima le nemesi della scatola base, poi quelle delle mini espansioni,
  // in ognuno dei due gruppi per battaglia
  const byBattle = (n: { battle: number | null }) => (n.battle === null || n.battle === undefined ? 99 : n.battle);
  const inSelectedWaves = (wave: string | null) => wave !== null && selectedWaves.includes(wave);
  const ofWave = catalogo.nemeses.filter(n => n.boxCode && inSelectedWaves(waveOfNemesis(n)))
    .map((n, i) => ({ n, i }))
    .sort((a, b) => (Number(waveOfNemesis(a.n)) - Number(waveOfNemesis(b.n))) || (Number(isMiniCode(a.n.boxCode)) - Number(isMiniCode(b.n.boxCode)))
      || (byBattle(a.n) - byBattle(b.n)) || (a.i - b.i))
    .map(x => x.n);
  const playable = ofWave.filter(isPlayable);
  const others = ofWave.filter(n => !isPlayable(n));

  if (!playable.some(n => n.name === preferenze.settings.nemesis)) preferenze.settings.nemesis = playable.length ? playable[0].name : null;

  list.replaceChildren(...playable.map(info => {
    const b = el('button', 'nemesis-option');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(info.name === preferenze.settings.nemesis));
    const tags = el('span', 'nemesis-tags');
    tags.appendChild(el('span', '', info.battle ? I18N_IT.battle(info.battle) : I18N_IT.battleMissing));
    const art = catalogo.nemesisArt[info.name];
    if (art) {
      // Parte dell'illustrazione a destra del pulsante (come nella wiki)
      b.classList.add('has-art');
      const portrait = el('span', 'nemesis-art');
      portrait.setAttribute('aria-hidden', 'true');
      portrait.style.backgroundImage = `url("${encodeURI(String(art.portrait))}")`;
      b.appendChild(portrait);
    }
    b.append(el('span', 'nemesis-name', info.name), tags);
    // Mini espansione: etichetta dorata piccola in basso a destra
    if (isMiniCode(info.boxCode)) b.appendChild(el('span', 'nemesis-expansion', productName(String(info.boxCode))));
    b.addEventListener('click', () => {
      // Toccare di nuovo la nemesi già scelta apre o chiude la sua carta (come le frecce)
      if (preferenze.settings.nemesis === info.name) {
        if (art) {
          setNemesisPreview(!nemesisPreviewOpen);
          b.focus({ preventScroll: true });
        }
        return;
      }
      preferenze.settings.nemesis = info.name;
      nemesisPreviewOpen = false;
      renderBosses();
      const selected = query(list, '.nemesis-item.is-selected .nemesis-option', HTMLElement);
      if (selected) selected.focus({ preventScroll: true });
    });
    const item = el('div', 'nemesis-item');
    item.appendChild(b);
    if (info.name === preferenze.settings.nemesis) {
      item.classList.add('is-selected');
      // Freccia verso il basso al centro del pulsante scelto: apre la carta della nemesi
      if (art) item.appendChild(chevronButton('nemesis-expand', I18N_IT.showNemesisCard(info.name), () => setNemesisPreview(true)));
    }
    return item;
  }));
  renderNemesisPreview();
  need(document.getElementById('nemesis-empty'), '#nemesis-empty').hidden = playable.length > 0;

  // Nemesi non disponibili: box piccoli con solo il nome, barrati da una X rossa sottile, non cliccabili.
  // Stanno subito sotto i pulsanti delle disponibili (il vecchio elenco a scomparsa non si usa più).
  const oldOther = document.getElementById('nemesis-other');
  if (oldOther) oldOther.hidden = true;
  let unavailable = document.getElementById('nemesis-unavailable');
  if (!unavailable) {
    unavailable = el('ul', 'nemesis-unavailable');
    unavailable.id = 'nemesis-unavailable';
    unavailable.setAttribute('aria-label', I18N_IT.unavailableNemeses);
    list.after(unavailable);
  }
  unavailable.hidden = others.length === 0;
  unavailable.replaceChildren(...others.map(info => {
    // Nemesi che l'app ha (battaglia e carte) ma il cui prodotto non è nella collezione: niente "!", la scritta
    // "Non in collezione" a destra. Le altre (senza battaglia o senza carte) restano con il "!" rosso.
    // (String: una nemesi senza prodotto si cerca come "null", che non è nella collezione)
    const notOwned = info.battle !== null && !ownsProduct(String(productOfNemesis(info)))
      && catalogo.allCards.some(c => c.category === 'Specific' && c.nemesis === info.name);
    const li = el('li', 'nemesis-locked' + (notOwned ? ' is-not-owned' : ''));
    li.setAttribute('aria-label', notOwned ? I18N_IT.notInCollectionNemesis(info.name) : I18N_IT.unavailableNemesis(info.name));
    li.appendChild(el('span', '', info.name));
    if (notOwned) li.appendChild(el('span', 'nemesis-locked-note', I18N_IT.notInCollection));
    return li;
  }));
  updateStartActions();
}

export function renderStartChoices(): void {
  nemesisPreviewOpen = false;
  const options = need(catalogo.startOptions, 'scelte della pagina iniziale');
  options.waves = ownedWaves();
  ensureCollectionButton();
  renderPlayers();
  const current = catalogo.nemeses.find(n => n.name === preferenze.settings.nemesis);
  // Wave scelte: quelle di prima ancora nella collezione; se nessuna, la wave della nemesi scelta (o la prima)
  selectedWaves = selectedWaves.filter(w => options.waves.includes(w));
  if (!selectedWaves.length) {
    const currentWave = current ? waveOfNemesis(current) : null;
    selectedWaves = [currentWave !== null && options.waves.includes(currentWave) ? currentWave : options.waves[0]]
      .filter((w): w is string => !!w);
  }
  ensureWaveGroup();
  renderWavePills();
  renderBosses();
}

// Pagina iniziale in due modi:
//   'home':  menu iniziale. Se c'è una partita salvata, la finestra "Partita in corso" (nemesi, giocatori, Riprendi
//            partita); sotto, sempre, "Nuova partita" e "Opzioni" (La mia collezione).
//   'setup': scelte della nuova partita (giocatori, wave, nemesi) e "Inizia partita"; in alto la X (menu iniziale).
export let startMode: 'home' | 'setup' = 'home';

// Finestra "Partita in corso" sotto il titolo e, sotto, i pulsanti del menu iniziale. Creati qui, così funzionano
// anche con un index.html vecchio ancora in cache.
export function startChoicePanel(): HTMLElement {
  const existing = document.getElementById('start-choice');
  if (existing) return existing;
  const panel = el('section', 'start-choice');
  panel.id = 'start-choice';
  panel.setAttribute('aria-labelledby', 'start-choice-title');
  const head = el('div', 'start-choice-head');
  const title = el('h2', 'start-choice-title', I18N_IT.savedGameTitle);
  title.id = 'start-choice-title';
  head.append(title, el('p', 'start-choice-info'));
  const resume = button(I18N_IT.resumeGame, 'primary', resumeGame);
  resume.classList.add('ae-button--full', 'start-choice-resume');
  panel.append(head, resume);
  pageEl(document, '.start-title', HTMLElement).after(panel);
  return panel;
}

export function startHomeActions(): HTMLElement {
  const existing = document.getElementById('start-home');
  if (existing) return existing;
  const box = el('div', 'start-home');
  box.id = 'start-home';
  const fresh = button(I18N_IT.newGame, 'primary', () => setStartMode('setup', true));
  fresh.classList.add('ae-button--full', 'start-home-new');
  // Collezione vuota: "Inserisci collezione" apre La mia collezione; "Nuova partita" è oscurato
  const addCollection = button(I18N_IT.addCollection, 'primary', () => openCollection(addCollection, () => {
    const next = query(startHomeActions(), '.start-home-new', HTMLButtonElement);
    if (next && !next.disabled) next.focus({ preventScroll: true });
  }));
  addCollection.classList.add('ae-button--full', 'start-home-collection');
  const options = button(I18N_IT.options, 'secondary', () => openOptions(options));
  options.classList.add('ae-button--full', 'start-home-options');
  // Modalità test: scenari che partono in un momento preciso della partita
  const test = button(I18N_IT.testMenu, 'secondary', () => openTestScreen(test));
  test.classList.add('ae-button--full', 'start-home-test');
  box.append(addCollection, fresh, options, test);
  startChoicePanel().after(box);
  return box;
}

export function updateHomeCollection(): void {
  const box = document.getElementById('start-home');
  if (!box) return;
  const empty = !preferenze.collection || preferenze.collection.size === 0;
  pageEl(box, '.start-home-collection', HTMLElement).hidden = !empty;
  const fresh = pageEl(box, '.start-home-new', HTMLButtonElement);
  fresh.disabled = empty;
  fresh.title = empty ? I18N_IT.collectionEmptyHint : '';
  // Con la collezione vuota il pulsante principale è "Inserisci collezione" (altrimenti principale solo senza partita
  // salvata, come in setStartMode)
  const primary = !empty && !readSave();
  fresh.classList.toggle('ae-button--primary', primary);
  fresh.classList.toggle('ae-button--secondary', !primary);
}

// Testata della pagina "Nuova partita": titolo e X (torna al menu iniziale). Resta ferma in alto mentre la pagina scorre
// sotto, e sotto di lei il contenuto sfuma nel nero (style.css .start-setup-head)
export function startSetupHead(): HTMLElement {
  const existing = document.getElementById('start-setup-head');
  if (existing) return existing;
  const head = el('div', 'start-setup-head');
  head.id = 'start-setup-head';
  const x = el('button', 'ae-icon-button start-setup-close');
  x.type = 'button';
  x.setAttribute('aria-label', I18N_IT.backToMenu);
  x.appendChild(icon('close'));
  x.addEventListener('click', () => setStartMode('home', true));
  head.append(el('h1', 'start-setup-title', I18N_IT.newGameTitle), x);
  pageEl(document, '.start-box', HTMLElement).prepend(head);
  return head;
}

export function setStartMode(mode: string, focus?: boolean): void {
  const saved = readSave();
  startMode = mode === 'setup' ? 'setup' : 'home';
  // Pagina Nuova partita: le opzioni del mazzo ripartono dalla preferenza del browser
  if (startMode === 'setup') Object.assign(preferenze.settings, loadDeckOptions());
  const panel = startChoicePanel();
  const home = startHomeActions();
  const isHome = startMode === 'home';
  panel.hidden = !isHome || !saved;
  home.hidden = !isHome;
  startSetupHead().hidden = isHome;
  // Il vecchio Menu della pagina Nuova partita (sostituito dalla X) si toglie anche da una pagina già aperta
  const oldMenu = document.getElementById('start-menu-btn');
  if (oldMenu) oldMenu.remove();
  startLayer.classList.toggle('is-setup', !isHome);
  need(panel.parentElement, 'contenitore della pagina iniziale').classList.toggle('is-choosing', isHome);
  // Con una partita in corso "Nuova partita" è secondario (il principale è Riprendi partita)
  const fresh = pageEl(home, '.start-home-new', HTMLButtonElement);
  fresh.classList.toggle('ae-button--primary', !saved);
  fresh.classList.toggle('ae-button--secondary', !!saved);
  updateHomeCollection();
  if (saved) {
    const head = pageEl(panel, '.start-choice-head', HTMLElement);
    pageEl(head, '.start-choice-info', HTMLElement).textContent =
      [saved.settings.nemesis, I18N_IT.players(saved.settings.players)].filter(Boolean).join(' · ');
    const old = head.querySelector('.nemesis-art');
    if (old) old.remove();
    const nemesis = saved.settings.nemesis;
    const art = nemesis !== null ? catalogo.nemesisArt[nemesis] : undefined;
    head.classList.toggle('has-art', !!art);
    if (art) {
      const portrait = el('span', 'nemesis-art');
      portrait.setAttribute('aria-hidden', 'true');
      portrait.style.backgroundImage = `url("${encodeURI(String(art.portrait))}")`;
      head.prepend(portrait);
    }
  }
  startLayer.scrollTop = 0;
  updateStartActions();
  if (focus) {
    const target = isHome ? (saved ? query(panel, '.start-choice-resume', HTMLElement)
      : fresh.disabled ? query(home, '.start-home-collection', HTMLElement) : fresh) : query(document, '#choices-players button', HTMLElement);
    if (target) target.focus({ preventScroll: true });
  }
}

// In 'setup' il pulsante principale è "Inizia partita"
export function updateStartActions(): void {
  resumeBtn.hidden = true;
  resumeBtn.className = 'ae-button ae-button--full ae-button--secondary start-resume-alt';
  startBtn.textContent = I18N_IT.startNew;
  startBtn.className = 'ae-button ae-button--full ae-button--primary';
  startBtn.disabled = !preferenze.settings.nemesis || !battleOf(preferenze.settings.nemesis);
  startBtn.title = startBtn.disabled ? I18N_IT.chooseNemesis : '';
  renderDeckOptions();
}

// Opzioni del mazzo: due interruttori sopra la wave ("Modalità battaglia", "Unisci le carte della collezione"), con il
// blocco di "Unisci" (mergeLockedWave) e, prima di "Inizia partita", una riga se il mazzo esce più corto
export function deckOptionsGroup(): HTMLElement {
  const existing = document.getElementById('deck-options');
  if (existing) return existing;
  const group = el('section', 'start-group start-deck-options');
  group.id = 'deck-options';
  group.setAttribute('aria-labelledby', 'deck-options-label');
  const label = el('h2', 'start-label', I18N_IT.deckOptions);
  label.id = 'deck-options-label';
  const row = (key: 'battleMode' | 'mergeCollection', text: string, note: string) => {
    const r = el('label', 'ae-switch-row deck-option');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('role', 'switch');
    input.dataset.option = key;
    const sw = el('span', 'ae-switch');
    sw.setAttribute('aria-hidden', 'true');
    const texts = el('span', 'deck-option-text');
    texts.append(el('span', 'deck-option-label', text), el('span', 'deck-option-note', note));
    r.append(texts, input, sw);
    input.addEventListener('change', () => {
      if (input.disabled) return;
      preferenze.settings[key] = input.checked;
      saveDeckOptions();
      renderDeckOptions();
    });
    return r;
  };
  const lockNote = el('p', 'start-note deck-option-lock');
  lockNote.id = 'deck-option-lock';
  group.append(label, row('battleMode', I18N_IT.battleMode, I18N_IT.battleModeNote),
    row('mergeCollection', I18N_IT.mergeCollection, I18N_IT.mergeCollectionNote), lockNote);
  ensureWaveGroup().before(group);
  return group;
}

export function renderDeckOptions(): void {
  if (!catalogo.deckSetup || !catalogo.nemeses.length) return;
  const group = deckOptionsGroup();
  const battle = pageEl(group, '[data-option="battleMode"]', HTMLInputElement);
  const merge = pageEl(group, '[data-option="mergeCollection"]', HTMLInputElement);
  const lockNote = pageEl(group, '.deck-option-lock', HTMLElement);
  battle.checked = preferenze.settings.battleMode !== false;
  const locked = mergeLockedWave();
  merge.checked = mergeActive();
  merge.disabled = !!locked;
  need(merge.closest('.ae-switch-row'), 'riga di "Unisci"').classList.toggle('is-locked', !!locked);
  merge.setAttribute('aria-describedby', locked ? lockNote.id : '');
  lockNote.hidden = !locked;
  lockNote.textContent = locked ? I18N_IT.mergeLocked(waveLabel(locked).split(' - ')[0]) : '';
  // Riga di avviso prima di "Inizia partita": il mazzo esce più corto di deck-setup.json
  let warn = document.getElementById('deck-short');
  if (!warn) {
    warn = el('p', 'start-note deck-short');
    warn.id = 'deck-short';
    warn.setAttribute('role', 'status');
    startBtn.before(warn);
  }
  const short = preferenze.settings.nemesis ? deckShortfall() : null;
  warn.hidden = !short;
  warn.textContent = short ? I18N_IT.deckShort(short.have, short.want) : '';
}

// Wave nella scelta della nemesi: solo quelle della collezione (se nessuna, tutte)
export function ownedWaves(): string[] {
  const all = collectionCatalog().map(w => w.wave);
  const owned = all.filter(w => [...need(preferenze.collection, 'collezione')].some(id => waveOfCode(id) === w));
  return owned.length ? owned : all;
}

export function buildStartPage(): void {
  loadCollection();
  const setup = need(catalogo.deckSetup, 'deck-setup.json');
  const options = { players: Object.keys(setup.battles[0].players).map(Number), waves: ownedWaves() };
  impostaSceltePagina(options);
  const firstPlayable = catalogo.nemeses.find(isPlayable);
  preferenze.settings = Object.assign({ players: options.players[0], nemesis: firstPlayable ? firstPlayable.name : null }, loadDeckOptions());
  renderStartChoices();
}

// Wave: gruppo a sé ("Wave"), sopra la Nemesi, con un menu a tendina in cui si spuntano una o più wave (in cifre
// romane). Accanto al titolo "Nemesi" il dado sceglie una nemesi a caso. Creati qui, così valgono anche con un
// index.html vecchio (il vecchio <select> della wave resta nascosto e non si usa più).
export function ensureWaveGroup(): HTMLElement {
  const existing = document.getElementById('wave-group');
  if (existing) return existing;
  const select = document.getElementById('wave-select');
  const group = el('section', 'start-group start-wave');
  group.id = 'wave-group';
  group.setAttribute('aria-labelledby', 'wave-label');
  const label = el('h2', 'start-label', I18N_IT.wave);
  label.id = 'wave-label';
  const dropdown = el('div', 'wave-dropdown');
  dropdown.id = 'wave-pills';
  const toggle = el('button', 'wave-dropdown-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-haspopup', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'wave-menu');
  toggle.append(el('span', 'wave-dropdown-text'));
  toggle.insertAdjacentHTML('beforeend', CHEVRON_SVG);
  const menu = el('div', 'wave-menu');
  menu.id = 'wave-menu';
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-label', I18N_IT.wavesLabel);
  menu.hidden = true;
  const setOpen = (open: boolean) => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    dropdown.classList.toggle('is-open', open);
  };
  // (hidden nei tipi del DOM può essere anche 'until-found'; qui è sempre true o false)
  toggle.addEventListener('click', () => setOpen(Boolean(menu.hidden)));
  // Un tocco fuori dal menu (o Esc) lo chiude
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !dropdown.contains(e.target instanceof Node ? e.target : null)) setOpen(false); });
  dropdown.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { e.stopPropagation(); setOpen(false); toggle.focus(); } });
  dropdown.append(toggle, menu);
  group.append(label, dropdown);
  const nemesisGroup = need(byId('nemesis-list', HTMLDivElement).closest('.start-group'), 'gruppo della nemesi');
  nemesisGroup.before(group);
  nemesisGroup.classList.add('start-nemesis');
  // Titolo "Nemesi" con a destra il dado (nemesi a caso tra tutte quelle della collezione)
  const nemesisLabel = document.getElementById('nemesis-label');
  if (nemesisLabel && !document.getElementById('nemesis-random')) {
    const row = el('div', 'start-label-row');
    nemesisLabel.before(row);
    row.appendChild(nemesisLabel);
    const dice = el('button', 'ae-icon-button nemesis-random');
    dice.id = 'nemesis-random';
    dice.type = 'button';
    dice.setAttribute('aria-label', I18N_IT.randomNemesis);
    dice.title = I18N_IT.randomNemesis;
    dice.innerHTML = DICE_SVG;
    dice.addEventListener('click', pickRandomNemesis);
    row.appendChild(dice);
  }
  if (select) {
    select.hidden = true;
    group.appendChild(select);
    const oldLabel = document.querySelector('label[for="wave-select"]');
    if (oldLabel) oldLabel.remove();
  }
  return group;
}

export const DICE_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">'
  + '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5" fill="none" stroke="currentColor" stroke-width="2"/>'
  + '<circle cx="8.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.6" fill="currentColor"/>'
  + '<circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.6" fill="currentColor"/>'
  + '<circle cx="8.5" cy="15.5" r="1.6" fill="currentColor"/></svg>';

// Menu a tendina delle wave: testo con le wave scelte e, aperto, una casella per wave. Resta sempre almeno una wave.
export function renderWavePills(): void {
  const dropdown = byId('wave-pills', HTMLDivElement);
  const text = pageEl(dropdown, '.wave-dropdown-text', HTMLElement);
  const menu = pageEl(dropdown, '.wave-menu', HTMLElement);
  const options = need(catalogo.startOptions, 'scelte della pagina iniziale');
  const chosen = options.waves.filter(w => selectedWaves.includes(w));
  text.textContent = !chosen.length ? I18N_IT.wavesNone
    : chosen.length === 1 ? waveLabel(chosen[0]) : I18N_IT.wavesMore(waveLabel(chosen[0]), chosen.length - 1);
  menu.replaceChildren(...options.waves.map(wave => {
    const row = el('label', 'wave-option');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = selectedWaves.includes(wave);
    input.addEventListener('change', () => {
      if (input.checked) selectedWaves.push(wave);
      else if (selectedWaves.length > 1) selectedWaves = selectedWaves.filter(w => w !== wave);
      else input.checked = true;
      nemesisPreviewOpen = false;
      renderWavePills();
      renderBosses();
    });
    row.append(input, el('span', 'wave-option-box'), el('span', 'wave-option-name', waveLabel(wave)));
    return row;
  }));
}

// Dado: una nemesi a caso tra tutte quelle giocabili della collezione (se possibile diversa da quella scelta); la sua
// wave si aggiunge alle wave scelte e la pagina scorre fino a lei
export function pickRandomNemesis(): void {
  const all = catalogo.nemeses.filter(isPlayable);
  if (!all.length) return;
  const pool = all.length > 1 ? all.filter(n => n.name !== preferenze.settings.nemesis) : all;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  // (una nemesi giocabile ha sempre un prodotto, quindi una wave)
  const wave = waveOfNemesis(pick);
  if (wave !== null && !selectedWaves.includes(wave)) selectedWaves.push(wave);
  preferenze.settings.nemesis = pick.name;
  nemesisPreviewOpen = false;
  renderWavePills();
  renderBosses();
  const selected = document.querySelector('.nemesis-item.is-selected');
  if (selected) selected.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  showToast(pick.name);
}

// Al caricamento non c'è niente da fare (main.ts chiama avvio() di ogni modulo)
export function avvio(): void {
}
