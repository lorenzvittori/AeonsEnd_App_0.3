// ui/componenti/animazioni.ts: strumenti delle animazioni e dei gesti comuni a più pezzi: blocco del pulsante
// principale durante un'animazione (lockFor, clearTransition), fine di animazioni Web (animDone), valori che scorrono
// (tween), scorrimento veloce di una fascia (fastScrollTo, scrollItemInto), tocco che diventa trascinamento
// (trackDrag), vibrazione (buzz), scossa dell'app (shakeApp) e le durate del passaggio tra i turni (MORPH_MS, ENTER_MS,
// BG_SLIDE_MS).
// Livello 3 (ui/componenti/). Dipende da: ui/ base (pagina, ridisegno: lockFor alla fine ridisegna). Usato da:
// componenti, finestre, schermate, navigazione.
import { ANCHOR_RATIO, app, DRAG_THRESHOLD, reducedMotion, ui } from '../pagina.ts';
import type { AncoraCoda } from '../pagina.ts';
import { richiediRidisegno } from '../ridisegno.ts';

export function clearTransition(): void {
  if (ui.transitionTimer !== null) clearTimeout(ui.transitionTimer);
  ui.transitionTimer = null;
  ui.isTransitioning = false;
}

// Blocca il pulsante principale per ms millisecondi, poi esegue then
export function lockFor(ms: number, then?: () => void): void {
  if (ui.transitionTimer !== null) clearTimeout(ui.transitionTimer);
  ui.isTransitioning = true;
  ui.transitionTimer = setTimeout(() => {
    ui.transitionTimer = null;
    ui.isTransitioning = false;
    if (then) then();
    richiediRidisegno();
  }, ms);
}

// Fine di un gruppo di animazioni, con un tempo massimo (se il browser non le fa girare, si va avanti lo stesso)
export function animDone(anims: readonly Animation[], ms: number): Promise<unknown> {
  return Promise.race([Promise.all(anims.map(a => a.finished.catch(() => {}))), new Promise(r => setTimeout(r, ms + 150))]);
}

// Piccola animazione numerica (requestAnimationFrame, con riserva setTimeout per il browser di prova)
export function tween(from: number, to: number, ms: number, step: (value: number) => void, done?: () => void): void {
  const t0 = performance.now();
  let finished = false;
  const tick = () => {
    if (finished) return;
    const k = Math.min(1, (performance.now() - t0) / ms);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    step(from + (to - from) * e);
    if (k >= 1) { finished = true; if (done) done(); return; }
    if (typeof window.requestAnimationFrame === 'function') requestAnimationFrame(tick); else setTimeout(tick, 16);
  };
  tick();
  setTimeout(() => { if (!finished) { finished = true; step(to); if (done) done(); } }, ms + 200);
}

// Un'animazione di scorrimento in corso
interface Scorrimento {
  cancelled: boolean;            // interrotta (dito sul contenitore, altra meta)
  to: number;                    // posizione di arrivo
}

// Scorrimento orizzontale animato più veloce di quello del browser (circa il 50% in più: FAST_SCROLL_MS). Durante
// l'animazione lo scroll-snap è spento, altrimenti il browser riaggancerebbe la carta a ogni passo; un dito sul
// contenitore la interrompe. Con "riduci movimento" salta subito.
export const FAST_SCROLL_MS = 260;

export const scrollJobs = new WeakMap<HTMLElement, Scorrimento>();

export const scrollJobWatched = new WeakSet<HTMLElement>();

export function cancelFastScroll(container: HTMLElement): void {
  const job = scrollJobs.get(container);
  if (!job) return;
  job.cancelled = true;
  scrollJobs.delete(container);
  container.style.scrollSnapType = '';
}

export function fastScrollTo(container: HTMLElement, left: number, ms = FAST_SCROLL_MS): void {
  const to = Math.max(0, Math.min(container.scrollWidth - container.clientWidth, left));
  // Stessa meta di un'animazione già in corso (ridisegni, ridimensionamenti): la si lascia finire
  const running = scrollJobs.get(container);
  if (running && Math.abs(running.to - to) < 1) return;
  cancelFastScroll(container);
  const from = container.scrollLeft;
  if (Math.abs(to - from) < 1 || reducedMotion.matches) { container.scrollLeft = to; return; }
  if (!scrollJobWatched.has(container)) {
    scrollJobWatched.add(container);
    container.addEventListener('pointerdown', () => cancelFastScroll(container), { passive: true });
  }
  const job: Scorrimento = { cancelled: false, to };
  scrollJobs.set(container, job);
  container.style.scrollSnapType = 'none';
  tween(from, to, ms, v => { if (!job.cancelled) container.scrollLeft = v; }, () => {
    if (job.cancelled) return;
    container.scrollLeft = to;
    cancelFastScroll(container);
  });
}

export function scrollItemInto(container: HTMLElement, item: HTMLElement, align: AncoraCoda['align']): void {
  const vertical = container.scrollHeight > container.clientHeight + 1 && container.scrollWidth <= container.clientWidth + 1;
  const cRect = container.getBoundingClientRect();
  const iRect = item.getBoundingClientRect();
  if (vertical) {
    const top = iRect.top - cRect.top + container.scrollTop;
    if (align === 'nearest') {
      if (iRect.top < cRect.top) container.scrollTop = top - 16;
      else if (iRect.bottom > cRect.bottom) container.scrollTop = top + iRect.height - container.clientHeight + 16;
    } else {
      container.scrollTop = top + iRect.height / 2 - container.clientHeight / 2;
    }
    return;
  }
  const left = iRect.left - cRect.left + container.scrollLeft;
  if (align === 'nearest') {
    if (iRect.left < cRect.left + 16) container.scrollLeft = left - 16;
    else if (iRect.right > cRect.right - 16) container.scrollLeft = left + iRect.width - container.clientWidth + 16;
    return;
  }
  const ratio = align === 'anchor' ? ANCHOR_RATIO : 0.5;
  container.scrollLeft = left + iRect.width / 2 - container.clientWidth * ratio;
}

// Un tocco che diventa scorrimento (oltre DRAG_THRESHOLD px) non apre la carta
export function trackDrag(container: HTMLElement): void {
  let start: { x: number; y: number } | null = null;
  container.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY }; container.dataset.dragged = ''; });
  container.addEventListener('pointermove', e => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_THRESHOLD) container.dataset.dragged = '1';
  });
  container.addEventListener('pointerup', () => { start = null; });
  container.addEventListener('scroll', () => { if (start) container.dataset.dragged = '1'; }, { passive: true });
}

// Vibrazione breve (solo dove il telefono la supporta: Android; iOS la ignora)
export function buzz(pattern: number | number[]): void {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (err) { /* niente vibrazione */ }
}

// Scossa breve dell'app all'inizio del turno nemesi (niente con riduzione del movimento)
export function shakeApp(): void {
  buzz([60, 40, 60]);
  if (reducedMotion.matches) return;
  app.classList.remove('is-shaking');
  void app.offsetWidth;
  app.classList.add('is-shaking');
  setTimeout(() => app.classList.remove('is-shaking'), 520);
}

// Dal turno nemesi al turno giocatori senza "sparisci e ricompari":
//   - la vista del turno giocatori non fa la dissolvenza (classe is-from-nemesis);
//   - la fascia piccola resta ferma (stesso scorrimento della fascia del turno nemesi);
//   - lo sfondo scorre di nuovo verso il lato sinistro (maga);
//   - la carta appena messa in gioco passa dalla sua misura grande a quella del turno giocatori (FLIP);
//   - le altre carte della coda entrano da sinistra (ENTER_MS); box vita/token e comandi compaiono con una dissolvenza.
// Va chiamata al posto di richiediRidisegno(): misura prima e dopo il disegno.
export const MORPH_MS = 380;

// Entrata da sinistra delle altre carte della coda nel turno giocatori
export const ENTER_MS = 320;

// Durata dello scorrimento dello sfondo tra i due turni (uguale alla transizione di .ae-shell in base.css)
export const BG_SLIDE_MS = 800;
