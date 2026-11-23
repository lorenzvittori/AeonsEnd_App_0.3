// ui/componenti/dialoghi.js: Dialoghi: un livello alla volta in primo piano.
// Fase A del passaggio a Vite: codice spostato da script.js così com'era. Al caricamento il modulo dichiara solo
// funzioni e costanti; il codice che prima girava al caricamento è in avvio(), chiamata da main.js nell'ordine di prima.

import { I18N_IT } from '../testi.js';
import { app, dialogRoot, discardLayer, liveRegion, startLayer, toastRoot } from '../../stato/stato.js';
import { el, icon } from './componenti.js';

// --- Dialoghi: un livello alla volta in primo piano, il resto è inerte; Tab resta nel dialogo, Esc annulla ---
export const modals = [];

export function topLayer() {
  if (modals.length) return modals[modals.length - 1].backdrop;
  if (!discardLayer.hidden) return discardLayer;
  if (!startLayer.hidden) return startLayer;
  return app;
}

export function updateInert() {
  const top = topLayer();
  [app, startLayer, discardLayer, ...modals.map(m => m.backdrop)].forEach(layer => {
    layer.inert = layer !== top;
  });
}

// Apre un dialogo. onCancel = Esc, X o tocco fuori (closeOnScrim). Restituisce la funzione che lo chiude.
export function openModal(node, { onCancel, initialFocus, closeOnScrim = true }) {
  const backdrop = el('div', 'ae-modal-backdrop');
  backdrop.appendChild(node);
  const record = { backdrop, onCancel, trigger: document.activeElement };
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop && closeOnScrim) record.onCancel();
  });
  dialogRoot.appendChild(backdrop);
  modals.push(record);
  updateInert();
  (initialFocus || focusables(node)[0] || node).focus();
  return () => closeModal(record);
}

export function closeModal(record) {
  const i = modals.indexOf(record);
  if (i < 0) return;
  modals.splice(i, 1);
  record.backdrop.remove();
  updateInert();
  restoreFocus(record.trigger);
}

export function closeAllModals() {
  while (modals.length) closeModal(modals[modals.length - 1]);
}

export function restoreFocus(trigger) {
  if (trigger && trigger.isConnected && !trigger.closest('[inert]')) trigger.focus({ preventScroll: true });
}

export function focusables(root) {
  return Array.from(root.querySelectorAll('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'))
    .filter(n => !n.disabled && !n.hidden && n.offsetParent !== null);
}

// Struttura comune: titolo, tipo, X per chiudere
export let dialogCount = 0;

export function dialogShell(titleText, kindText, onClose, { displayTitle = true } = {}) {
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
  x.setAttribute('aria-label', I18N_IT.close);
  x.appendChild(icon('close'));
  x.addEventListener('click', onClose);
  header.append(titles, x);
  dialog.appendChild(header);
  return dialog;
}

export function button(text, variant, handler) {
  const b = el('button', 'ae-button ae-button--' + variant, text);
  b.type = 'button';
  if (handler) b.addEventListener('click', handler);
  return b;
}

// Toast di conferma (visibile 3 secondi, si chiude anche toccandolo) e annunci per lettori di schermo
export let toastTimer = null;

export function showToast(text) {
  clearTimeout(toastTimer);
  const toast = el('div', 'ae-toast', text);
  toast.addEventListener('click', () => toast.remove());
  toastRoot.replaceChildren(toast);
  toastTimer = setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 160);
  }, 3000);
}

export function announce(text) {
  liveRegion.textContent = '';
  setTimeout(() => { liveRegion.textContent = text; }, 30);
}

// Promessa che si risolve con true quando l'immagine è scaricata, false se non si carica (al massimo 8 secondi)
export const decodedImages = new Map();

export function keepDecoded(src, img) {
  decodedImages.delete(src);
  decodedImages.set(src, img);
  while (decodedImages.size > 12) decodedImages.delete(decodedImages.keys().next().value);
}

export function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    let done = false;
    const finish = ok => { if (!done) { done = true; resolve(ok); } };
    // Scaricata e anche decodificata (pronta da disegnare): così la carta pescata si vede subito quando si gira.
    // L'immagine resta in memoria (decodedImages) finché serve, così il browser non butta la decodifica.
    img.onload = () => {
      keepDecoded(src, img);
      if (img.decode) img.decode().then(() => finish(true), () => finish(true));
      else finish(true);
    };
    img.onerror = () => finish(false);
    img.src = src;
    if (img.complete && img.naturalWidth) img.onload();
    setTimeout(() => finish(false), 8000);
  });
}

// Codice eseguito all'avvio (prima: al caricamento di script.js), nell'ordine di prima
export function avvio() {
}
