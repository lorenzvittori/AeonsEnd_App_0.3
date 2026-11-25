// ui/schermate/crea-mazzo-cursore.ts: il cursore di "Crea mazzo" al posto del pulsante principale: le carte volano dai 9
// mazzi al mazzo in alto mentre lo si trascina, poi la fine della creazione (banner "Partita iniziata", sfondo che torna
// dal nero). File di supporto di crea-mazzo.ts.
// Livello 5 (ui/schermate/). Dipende da: dati/dati.ts (shuffle), stato/partita.ts (lettura), ui/ base (testi, pagina, dom, ridisegno),
// ui/componenti (animazioni, banner, componenti, testata). Usato da: crea-mazzo.ts, navigazione (creazione del cursore,
// disegnaCursore).
import { shuffle } from '../../dati/dati.ts';
import { partita } from '../../stato/partita.ts';
import { buzz, lockFor, tween } from '../componenti/animazioni.ts';
import { showBanner, TIER_BANNER_MS } from '../componenti/banner.ts';
import { dockDeck, renderDockPiles } from '../componenti/testata.ts';
import { el, query, queryAll } from '../dom.ts';
import { app, CARD_BACK, pulsantePrincipale, reducedMotion, ui } from '../pagina.ts';
import { richiediRidisegno } from '../ridisegno.ts';
import { T } from '../testi.ts';

interface CartaInVolo {
  pile: HTMLElement;             // mazzo di partenza
  fanCard: HTMLElement | null;   // carta del ventaglio (Specifiche), o null per i mazzi coperti
  i: number;                     // posizione nell'ordine dei voli
  ghost: HTMLElement | null;     // copia in volo (creata al primo movimento)
  state: number;                 // (non usato dal disegno: 0)
  cx: number;                    // centro di partenza (x), misurato quando nasce la copia
  cy: number;                    // centro di partenza (y)
  w: number;                     // larghezza di partenza
}

// I voli di una schermata "Crea mazzo"
interface VoloMazzo {
  layer: HTMLElement;            // la schermata
  order: CartaInVolo[];          // carte nell'ordine in cui volano
  p: number;                     // avanzamento 0-1
}

// --- "Crea mazzo" con il cursore: il quadratino si trascina da sinistra a destra e le carte vanno nel mazzo in alto
// seguendo il dito. Avanzamento p (0..1): con p = 0 si vedono tutti i mazzi, a metà strada è nel mazzo circa metà delle
// carte, alla fine il mazzo è completo e la partita inizia. Lasciando prima della fine il quadratino torna indietro
// (e le carte tornano nei loro mazzi). Prima il Tier 3 (in fondo al mazzo), poi il 2, poi l'1; dentro ogni Tier le
// carte partono in ordine casuale dai tre mazzi.
// Ogni carta ha una copia (fantasma) che vola dal suo mazzo a quello in alto; DECK_FLY_WINDOW carte sono in volo
// insieme. Il mazzo vero è già fatto (nuovaPartita): l'animazione lo mostra soltanto.
export const DECK_FLY_WINDOW = 3;

// Oltre questa frazione del cursore, al rilascio, il mazzo si completa
export const DECK_SLIDE_DONE = 0.94;

export let deckFlight: VoloMazzo | null = null;

// Prepara i voli (una volta per schermata): ordine delle carte, mazzo di partenza, copie da far volare
export function prepareDeckFlight(): VoloMazzo | null {
  const layer = document.getElementById('deck-build');
  if (!layer) return null;
  if (deckFlight && deckFlight.layer === layer) return deckFlight;
  const order: CartaInVolo[] = [];
  [3, 2, 1].forEach(tier => {
    const ofTier: CartaInVolo[] = [];
    KINDS.forEach(kind => {
      const pile = query(layer, `.deck-build-pile[data-tier="${tier}"][data-kind="${kind}"]`, HTMLElement);
      if (!pile) throw new TypeError(`mazzo Tier ${tier} ${kind} mancante in "Crea mazzo"`);
      const fan = kind === 'specific' ? queryAll(pile, '.deck-build-fan-card', HTMLElement) : null;
      const total = fan ? fan.length : Number(pile.dataset.count);
      for (let i = 0; i < total; i++) ofTier.push({ pile, fanCard: fan ? fan[i] : null, i: 0, ghost: null, state: 0, cx: 0, cy: 0, w: 0 });
    });
    order.push(...shuffle(ofTier));
  });
  order.forEach((c, i) => { c.i = i; c.ghost = null; c.state = 0; });
  deckFlight = { layer, order, p: 0 };
  return deckFlight;
}

// Copia della carta in volo, creata al primo movimento (le misure si prendono allora)
export function deckGhost(c: CartaInVolo): HTMLElement {
  if (c.ghost) return c.ghost;
  const source = c.fanCard || query(c.pile, ':scope > img', HTMLElement);
  if (!source) throw new TypeError('carta di partenza mancante in "Crea mazzo"');
  const from = source.getBoundingClientRect();
  const w = c.fanCard ? source.offsetWidth : from.width;
  const h = c.fanCard ? source.offsetHeight : from.height;
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  const ghost = el('div', 'ae-fly-ghost ae-draw-ghost ae-deck-card');
  const img = document.createElement('img');
  img.alt = '';
  img.src = CARD_BACK;
  ghost.appendChild(img);
  Object.assign(ghost.style, { left: (cx - w / 2) + 'px', top: (cy - h / 2) + 'px', width: w + 'px', height: h + 'px', visibility: 'hidden' });
  document.body.appendChild(ghost);
  c.ghost = ghost;
  c.cx = cx; c.cy = cy; c.w = w;
  return ghost;
}

// Disegna i mazzi e le carte in volo per l'avanzamento p
export function setDeckProgress(p: number): void {
  const flight = prepareDeckFlight();
  if (!flight) return;
  flight.p = p;
  const n = flight.order.length;
  // Le Specifiche si girano (dorso in su) appena il cursore si muove; tornano a faccia in su a cursore fermo all'inizio
  flight.layer.classList.toggle('is-flipping', p > 0);
  const to = dockDeck.getBoundingClientRect();
  const x = p * (n + DECK_FLY_WINDOW - 1);
  let landed = 0;
  const taken = new Map<HTMLElement, number>();
  flight.order.forEach(c => {
    const t = n ? Math.max(0, Math.min(1, (x - c.i) / DECK_FLY_WINDOW)) : 1;
    if (t >= 1) landed++;
    if (t > 0) taken.set(c.pile, (taken.get(c.pile) || 0) + 1);
    if (c.fanCard) c.fanCard.classList.toggle('is-gone', t > 0);
    if (t <= 0 || t >= 1) {
      if (c.ghost) c.ghost.style.visibility = 'hidden';
      return;
    }
    const ghost = deckGhost(c);
    const dx = to.left + to.width / 2 - c.cx;
    const dy = to.top + to.height / 2 - c.cy;
    const s = 1 + (to.width / c.w - 1) * t;
    const arc = Math.sin(Math.PI * t);
    ghost.style.visibility = '';
    ghost.style.transform = `translate(${dx * t}px, ${dy * t - 30 * arc}px) rotate(${(c.i % 2 ? 8 : -8) * arc}deg) scale(${s})`;
  });
  queryAll(flight.layer, '.deck-build-pile', HTMLElement).forEach(pile => {
    const left = Math.max(0, Number(pile.dataset.count) - (taken.get(pile) || 0));
    pile.dataset.left = String(left);
    const count = pile.querySelector('.ae-pile-count');
    if (!count) throw new TypeError('numero del mazzo mancante in "Crea mazzo"');
    count.textContent = String(left);
    pile.classList.toggle('is-empty', left <= 0);
  });
  const before = ui.deckShown || 0;
  const shown = Math.min(partita.deck.length, landed);
  ui.deckShown = shown;
  renderDockPiles();
  if (shown > before) {
    dockDeck.classList.remove('is-bump');
    void dockDeck.offsetWidth;
    dockDeck.classList.add('is-bump');
  }
}

// Fine di "Crea mazzo": la schermata sparisce, banner "Partita iniziata", poi lo sfondo passa dal nero a quello del
// turno giocatori
export const DECK_DARK_FADE_MS = 900;

export function finishDeckBuild(): void {
  const layer = document.getElementById('deck-build');
  if (deckFlight) deckFlight.order.forEach(c => { if (c.ghost) c.ghost.remove(); });
  deckFlight = null;
  ui.deckBuilding = false;
  ui.deckShown = null;
  if (deckSlider) { deckSlider.lock(false); deckSlider.setProgress(0, true); }
  if (layer && layer.animate && !reducedMotion.matches) {
    const fade = layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' });
    fade.onfinish = () => layer.remove();
    setTimeout(() => layer.remove(), 400);
  } else if (layer) {
    layer.remove();
  }
  // Niente carta turno pescata da sola: il pulsante è "Pesca carta turno"
  richiediRidisegno();
  pulsantePrincipale.focus({ preventScroll: true });
  // Banner "Partita iniziata", uguale a quello dei Tier; finito il banner lo sfondo si accende
  showBanner(T.gameStarted);
  setTimeout(() => {
    ui.deckDark = false;
    app.classList.remove('is-deck-dark');
  }, reducedMotion.matches ? 0 : TIER_BANNER_MS);
}

// Completa il mazzo da dove è arrivato il cursore (rilascio vicino alla fine, tastiera), poi la partita inizia
export function runDeckBuild(): void {
  if (!ui.deckBuilding || ui.isTransitioning) return;
  const flight = prepareDeckFlight();
  if (!flight || reducedMotion.matches) { finishDeckBuild(); return; }
  const from = flight.p;
  const ms = Math.max(250, (1 - from) * Math.min(2400, flight.order.length * 70));
  lockFor(ms + 120, finishDeckBuild);
  if (deckSlider) deckSlider.lock(true);
  tween(from, 1, ms, p => { setDeckProgress(p); if (deckSlider) deckSlider.setProgress(p); });
}

// Cursore di "Crea mazzo" nel dock, al posto del pulsante principale: box con il quadratino dorato che si trascina a
// destra. Pulsa finché non lo si tocca. Da tastiera: freccia destra / Invio completano.
// Cursore del mazzo in fondo allo schermo durante "Crea mazzo" (al posto del pulsante principale)
export interface CursoreMazzo {
  box: HTMLElement;              // elemento del cursore
  lock(on: boolean): void;       // blocca o sblocca il trascinamento
  setProgress(p: number, instant?: boolean): void; // posizione 0-1
}

// Il cursore: lo crea all'avvio il menu laterale (createDeckSlider), che lo mette nella riga del pulsante principale
export let deckSlider: CursoreMazzo | null = null;

export function createDeckSlider(): CursoreMazzo {
  deckSlider = buildDeckSlider();
  return deckSlider;
}

export function buildDeckSlider(): CursoreMazzo {
  const box = el('div', 'ae-deck-slider');
  box.setAttribute('role', 'slider');
  box.setAttribute('aria-label', T.slideToBuildLabel);
  box.setAttribute('aria-valuemin', '0');
  box.setAttribute('aria-valuemax', '100');
  box.setAttribute('aria-valuenow', '0');
  box.tabIndex = 0;
  box.hidden = true;
  const fill = el('span', 'ae-deck-slider-fill');
  const label = el('span', 'ae-deck-slider-label', T.slideToBuild);
  const knob = el('span', 'ae-deck-slider-knob');
  knob.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">'
    + '<path d="M6 6l6 6-6 6M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  box.append(fill, label, knob);
  let p = 0;
  let locked = false;
  let drag: { x: number; id: number } | null = null;
  const range = () => Math.max(1, box.clientWidth - knob.offsetWidth - 8);
  const setProgress = (value: number, quiet?: boolean) => {
    p = Math.max(0, Math.min(1, value));
    box.style.setProperty('--p', String(p));
    knob.style.transform = `translateX(${p * range()}px)`;
    fill.style.width = `calc(${p * range()}px + ${knob.offsetWidth || 48}px + 4px)`;
    box.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    if (!quiet) box.classList.toggle('is-started', p > 0);
    if (quiet && p === 0) box.classList.remove('is-started', 'is-dragging');
  };
  const lock = (on: boolean) => { locked = on; if (on) box.classList.add('is-started'); };
  const release = () => {
    if (!drag) return;
    drag = null;
    box.classList.remove('is-dragging');
    if (p >= DECK_SLIDE_DONE) { runDeckBuild(); return; }
    // Prima della fine: il quadratino torna all'inizio e le carte ai loro mazzi
    lock(true);
    tween(p, 0, Math.max(160, p * 450), v => { setDeckProgress(v); setProgress(v); }, () => {
      lock(false);
      setProgress(0, true);
      setDeckProgress(0);
    });
  };
  box.addEventListener('pointerdown', e => {
    if (locked || !ui.deckBuilding || ui.isTransitioning || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const kr = knob.getBoundingClientRect();
    // Si prende il quadratino (o il box: il quadratino salta sotto il dito solo se il tocco è vicino all'inizio)
    if (e.clientX > kr.right + 24) return;
    e.preventDefault();
    drag = { x: e.clientX - p * range(), id: e.pointerId };
    try { box.setPointerCapture(e.pointerId); } catch (_) { /* niente cattura */ }
    box.classList.add('is-dragging', 'is-started');
    prepareDeckFlight();
  });
  box.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const v = (e.clientX - drag.x) / range();
    const before = p;
    setProgress(v);
    setDeckProgress(p);
    if (before < 1 && p >= 1) buzz(30);
  });
  box.addEventListener('pointerup', release);
  box.addEventListener('pointercancel', release);
  box.addEventListener('lostpointercapture', release);
  box.addEventListener('keydown', e => {
    if (locked) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight' || e.key === 'End') {
      e.preventDefault();
      runDeckBuild();
    }
  });
  box.addEventListener('contextmenu', e => e.preventDefault());
  return { box, setProgress, lock };
}

// Durante "Crea mazzo": il cursore al posto del pulsante principale; sfondo nero fino alla fine del banner "Partita
// iniziata"
export function disegnaCursore(): void {
  if (deckSlider) deckSlider.box.hidden = !ui.deckBuilding;
  app.classList.toggle('is-deck-dark', ui.deckDark);
}

export const KINDS = ['basic', 'upgraded', 'specific'] as const;

// Volo delle carte verso il mazzo interrotto ("Crea mazzo" chiusa)
export function azzeraVolo(): void {
  deckFlight = null;
}

// All'avvio il cursore non c'è ancora (lo crea il coordinatore, createDeckSlider)
export function azzeraCursore(): void {
  deckSlider = null;
}
