// ui/componenti/scarti.ts: pila degli scarti (finestra con le carte dalla più recente) e carta degli scarti ingrandita.
// Dipende da: stato/partita.ts (lettura), ui/ (testi, pagina), ui/componenti (componenti, dialoghi). Usato da: eventi
// (pulsante degli scarti), avvio, ui/ripristino.ts (restore), Indietro.

import { I18N_IT } from '../testi.ts';
import { cardArt, el, typeName } from './componenti.ts';
import { button, dialogShell, openModal, restoreFocus, updateInert } from './dialoghi.ts';
import type { Carta } from '../../tipi/dati.ts';
import { partita } from '../../stato/partita.ts';
import { discardBtn, discardClose, discardEmpty, discardGrid, discardLayer, discardTitle } from '../pagina.ts';

// Elemento che aveva il focus all'apertura degli scarti
export let discardTrigger: Element | null = null;

// Scarti dalla più recente alla più vecchia; un tocco apre la carta in sola lettura
export function openDiscard(): void {
  discardTrigger = document.activeElement;
  discardTitle.textContent = I18N_IT.discardTitle(partita.discard.length);
  discardGrid.replaceChildren();
  discardEmpty.hidden = partita.discard.length > 0;
  discardGrid.hidden = partita.discard.length === 0;
  for (let i = partita.discard.length - 1; i >= 0; i--) {
    const data = partita.discard[i];
    const item = el('button', 'ae-discard-item');
    item.type = 'button';
    const label = partita.discard.length === 1 ? I18N_IT.onlyOne
      : i === partita.discard.length - 1 ? I18N_IT.mostRecent : i === 0 ? I18N_IT.leastRecent : '';
    item.setAttribute('aria-label', [data.name, typeName(data), label].filter(Boolean).join(', '));
    item.append(cardArt(data, { thumb: true, lazy: partita.discard.length - i > 12 }), el('span', 'ae-discard-label', label));
    item.addEventListener('click', () => openDiscardZoom(data));
    discardGrid.appendChild(item);
  }
  discardLayer.hidden = false;
  updateInert();
  discardClose.focus();
}

export function closeDiscard(): void {
  if (discardLayer.hidden) return;
  discardLayer.hidden = true;
  discardGrid.replaceChildren();
  updateInert();
  restoreFocus(discardBtn);
}

// Carta degli scarti ingrandita: sola lettura, solo "Chiudi immagine"
export function openDiscardZoom(data: Carta): void {
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

// Al caricamento non c'è niente da fare (main.ts chiama avvio() di ogni modulo)
export function avvio(): void {
}
