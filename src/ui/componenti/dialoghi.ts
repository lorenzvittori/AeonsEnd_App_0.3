// ui/componenti/dialoghi.ts: la pila delle finestre (un livello alla volta in primo piano, il resto inerte; Tab resta
// nella finestra, Esc annulla), struttura comune di una finestra (titolo, X), pulsanti, toast, annunci per i lettori di
// schermo, caricamento delle immagini.
// Livello 3 (ui/componenti/). Dipende da: ui/ base (testi, pagina, dom). Usato da: quasi tutti i moduli di ui/,
// avvio.ts.

import { T } from '../testi.ts';
import { app, dialogRoot, discardLayer, liveRegion, startLayer, toastRoot } from '../pagina.ts';
import { el, icon } from '../dom.ts';

// Un dialogo aperto
export interface Dialogo {
  backdrop: HTMLDivElement;      // sfondo che contiene il dialogo
  onCancel: () => void;          // Esc, X o tocco fuori
  trigger: Element | null;       // elemento che aveva il focus all'apertura (lo riprende alla chiusura)
}

// Opzioni di apertura di un dialogo
export interface OpzioniDialogo {
  onCancel: () => void;          // Esc, X o tocco fuori (closeOnScrim)
  initialFocus?: HTMLElement | null; // elemento con il focus all'apertura (altrimenti il primo che lo può avere)
  closeOnScrim?: boolean;        // un tocco fuori dal dialogo lo annulla (predefinito)
}

export const modals: Dialogo[] = [];

export function topLayer(): HTMLElement {
  if (modals.length) return modals[modals.length - 1].backdrop;
  if (!discardLayer.hidden) return discardLayer;
  if (!startLayer.hidden) return startLayer;
  return app;
}

export function updateInert(): void {
  const top = topLayer();
  [app, startLayer, discardLayer, ...modals.map(m => m.backdrop)].forEach(layer => {
    layer.inert = layer !== top;
  });
}

// Apre un dialogo. onCancel = Esc, X o tocco fuori (closeOnScrim). Restituisce la funzione che lo chiude.
export function openModal(node: HTMLElement, { onCancel, initialFocus, closeOnScrim = true }: OpzioniDialogo): () => void {
  const backdrop = el('div', 'ae-modal-backdrop');
  backdrop.appendChild(node);
  const record: Dialogo = { backdrop, onCancel, trigger: document.activeElement };
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop && closeOnScrim) record.onCancel();
  });
  dialogRoot.appendChild(backdrop);
  modals.push(record);
  updateInert();
  (initialFocus || focusables(node)[0] || node).focus();
  return () => closeModal(record);
}

export function closeModal(record: Dialogo): void {
  const i = modals.indexOf(record);
  if (i < 0) return;
  modals.splice(i, 1);
  record.backdrop.remove();
  updateInert();
  restoreFocus(record.trigger);
}

export function closeAllModals(): void {
  while (modals.length) closeModal(modals[modals.length - 1]);
}

export function restoreFocus(trigger: Element | null | undefined): void {
  if (trigger instanceof HTMLElement && trigger.isConnected && !trigger.closest('[inert]')) trigger.focus({ preventScroll: true });
}

// Elementi che possono avere il focus dentro root (visibili e attivi)
export function focusables(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'))
    .filter(n => !('disabled' in n && n.disabled) && !n.hidden && n.offsetParent !== null);
}

// Struttura comune: titolo, tipo, X per chiudere
export let dialogCount = 0;

export function dialogShell(titleText: string, kindText: string | null | undefined, onClose: () => void,
  { displayTitle = true }: { displayTitle?: boolean } = {}): HTMLDivElement {
  const dialog = el('div', 'ae-modal');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  const titleId = 'dlg-title-' + (++dialogCount);
  dialog.setAttribute('aria-labelledby', titleId);
  const header = el('div', 'ae-modal-header');
  const titles = el('div');
  const title = el('h2', displayTitle ? 'ae-modal-title' : 'ae-modal-title ae-modal-title--ui', titleText);
  title.id = titleId;
  titles.appendChild(title);
  if (kindText) titles.appendChild(el('p', 'ae-modal-kind', kindText));
  const x = el('button', 'ae-icon-button');
  x.type = 'button';
  x.setAttribute('aria-label', T.close);
  x.appendChild(icon('close'));
  x.addEventListener('click', onClose);
  header.append(titles, x);
  dialog.appendChild(header);
  return dialog;
}

export function button(text: string, variant: string, handler?: (e: MouseEvent) => void): HTMLButtonElement {
  const b = el('button', 'ae-button ae-button--' + variant, text);
  b.type = 'button';
  if (handler) b.addEventListener('click', handler);
  return b;
}

// Toast di conferma (visibile 3 secondi, si chiude anche toccandolo) e annunci per lettori di schermo
export let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function showToast(text: string): void {
  clearTimeout(toastTimer);
  const toast = el('div', 'ae-toast', text);
  toast.addEventListener('click', () => toast.remove());
  toastRoot.replaceChildren(toast);
  toastTimer = setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 160);
  }, 3000);
}

export function announce(text: string | null): void {
  liveRegion.textContent = '';
  setTimeout(() => { liveRegion.textContent = text; }, 30);
}

// Immagini scaricate e decodificate tenute in memoria (al massimo 12), così il browser non butta la decodifica
export const decodedImages = new Map<string, HTMLImageElement>();

export function keepDecoded(src: string, img: HTMLImageElement): void {
  decodedImages.delete(src);
  decodedImages.set(src, img);
  while (decodedImages.size > 12) {
    const oldest = decodedImages.keys().next().value;
    if (oldest === undefined) break;
    decodedImages.delete(oldest);
  }
}

// Promessa che si risolve con true quando l'immagine è scaricata, false se non si carica (al massimo 8 secondi)
export function loadImage(src: string): Promise<boolean> {
  return new Promise(resolve => {
    const img = new Image();
    let done = false;
    const finish = (ok: boolean) => { if (!done) { done = true; resolve(ok); } };
    // Scaricata e anche decodificata (pronta da disegnare): così la carta pescata si vede subito quando si gira.
    // L'immagine resta in memoria (decodedImages) finché serve, così il browser non butta la decodifica.
    const onLoad = () => {
      keepDecoded(src, img);
      if (img.decode) img.decode().then(() => finish(true), () => finish(true));
      else finish(true);
    };
    img.onload = onLoad;
    img.onerror = () => finish(false);
    img.src = src;
    if (img.complete && img.naturalWidth) onLoad();
    setTimeout(() => finish(false), 8000);
  });
}

// Al caricamento non c'è niente da fare (main.ts chiama avvio() di ogni modulo)
export function avvio(): void {
}
