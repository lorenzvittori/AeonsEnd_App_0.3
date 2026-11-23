// ui/componenti/scarti.js: Pila degli scarti.
// Fase A del passaggio a Vite: codice spostato da script.js così com'era. Al caricamento il modulo dichiara solo
// funzioni e costanti; il codice che prima girava al caricamento è in avvio(), chiamata da main.js nell'ordine di prima.

import { G } from '../../stato/condivise.ts';
import { I18N_IT } from '../testi.js';
import { discardBtn, discardClose, discardEmpty, discardGrid, discardLayer, discardTitle } from '../../stato/stato.ts';
import { cardArt, el, typeName } from './componenti.js';
import { button, dialogShell, openModal, restoreFocus, updateInert } from './dialoghi.js';

// --- 5. Pila degli scarti --------------------------------------------------------------------------------------------
export let discardTrigger = null;

// Scarti dalla più recente alla più vecchia; un tocco apre la carta in sola lettura
export function openDiscard() {
  discardTrigger = document.activeElement;
  discardTitle.textContent = I18N_IT.discardTitle(G.discard.length);
  discardGrid.replaceChildren();
  discardEmpty.hidden = G.discard.length > 0;
  discardGrid.hidden = G.discard.length === 0;
  for (let i = G.discard.length - 1; i >= 0; i--) {
    const data = G.discard[i];
    const item = el('button', 'ae-discard-item');
    item.type = 'button';
    const label = G.discard.length === 1 ? I18N_IT.onlyOne
      : i === G.discard.length - 1 ? I18N_IT.mostRecent : i === 0 ? I18N_IT.leastRecent : '';
    item.setAttribute('aria-label', [data.name, typeName(data), label].filter(Boolean).join(', '));
    item.append(cardArt(data, { thumb: true, lazy: G.discard.length - i > 12 }), el('span', 'ae-discard-label', label));
    item.addEventListener('click', () => openDiscardZoom(data));
    discardGrid.appendChild(item);
  }
  discardLayer.hidden = false;
  updateInert();
  discardClose.focus();
}

export function closeDiscard() {
  if (discardLayer.hidden) return;
  discardLayer.hidden = true;
  discardGrid.replaceChildren();
  updateInert();
  restoreFocus(discardBtn);
}

// Carta degli scarti ingrandita: sola lettura, solo "Chiudi immagine"
export function openDiscardZoom(data) {
  let close = () => {};
  const cancel = () => close();
  const dialog = dialogShell(I18N_IT.discardZoomTitle, data.name, cancel, { displayTitle: false });
  const art = cardArt(data);
  art.classList.add('ae-modal-art');
  const footer = el('div', 'ae-modal-footer');
  footer.appendChild(button(I18N_IT.closeImage, 'secondary', cancel));
  dialog.append(art, footer);
  close = openModal(dialog, { onCancel: cancel });
}

// Codice eseguito all'avvio (prima: al caricamento di script.js), nell'ordine di prima
export function avvio() {
}
