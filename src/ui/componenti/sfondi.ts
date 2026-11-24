// ui/componenti/sfondi.ts: lo sfondo dell'app e quello del box di Gravehold (scelta con anteprime) e il dorso delle carte
// (griglia dei dorsi): pulsanti con l'anteprima usati dal Menu della partita e dalle Opzioni.
// Livello 3 (ui/componenti/). Dipende da: ui/ base (testi, pagina, dom, ridisegno), ui/componenti (dialoghi, vite).
// Usato da: finestre (menu laterale, opzioni), navigazione (sfondo atteso prima del passaggio alla partita).
import { button, dialogShell, loadImage, openModal } from './dialoghi.ts';
import { el, query } from '../dom.ts';
import { app, CARD_BACK, CARD_BACKS, cssUrl, currentCardBack, impostaDorso, startLayer, ui } from '../pagina.ts';
import type { Sfondo } from '../pagina.ts';
import { richiediRidisegno } from '../ridisegno.ts';
import { I18N_IT } from '../testi.ts';
import { currentGraveholdBg, GRAVEHOLD_BGS, setGraveholdBg } from './vite.ts';

// Una scelta di sfondo: stesso pulsante con anteprima e stessa finestra per lo sfondo dell'app e quello di Gravehold
export interface SceltaSfondo {
  className: string;             // classe in più del pulsante
  title: () => string;           // titolo della finestra
  list: Sfondo[];                // sfondi possibili
  current: () => Sfondo;         // sfondo scelto
  set: (id: string) => void;     // sceglie uno sfondo
  name: (id: string) => string;  // nome mostrato
  chosen: (name: string) => string; // etichetta per i lettori di schermo
}

// Nome di un elemento di un elenco di testi (sfondi, dorsi) per id
function textOf(names: Record<string, string>, id: string): string {
  return names[id];
}

// Sfondo dell'app (maga a sinistra, nemesi a destra): si sceglie nel Menu, la scelta resta salvata nel browser.
// Non fa parte della partita (niente undo).
export const BACKGROUND_KEY = 'aeonsend-app-0.2-background';

export const BACKGROUNDS: Sfondo[] = [
  { id: 'masked', src: 'Assets/ui/decor/battle-bg.webp' },
  { id: 'horned', src: 'Assets/ui/decor/battle-bg-2.webp' },
  { id: 'maw', src: 'Assets/ui/decor/battle-bg-3.webp' }
];

export function currentBackground(): Sfondo {
  let id: string | null = null;
  try { id = localStorage.getItem(BACKGROUND_KEY); } catch (err) { /* si usa quello predefinito */ }
  return BACKGROUNDS.find(b => b.id === id) || BACKGROUNDS[0];
}

export function applyBackground(): void {
  app.style.setProperty('--ae-battle-bg', cssUrl(currentBackground().src));
}

export function setBackground(id: string): void {
  try { localStorage.setItem(BACKGROUND_KEY, id); } catch (err) { console.warn(err); }
  applyBackground();
}

// Scelta dello sfondo di tutta l'app (Menu e Opzioni), assegnata in avvio()
export let APP_BG_CHOICE: SceltaSfondo;

// Scelta dello sfondo di Gravehold, assegnata in avvio()
export let GRAVEHOLD_BG_CHOICE: SceltaSfondo;

// Pulsante con la miniatura e il nome del dorso scelto: apre la griglia dei dorsi (Menu della partita e Opzioni)
// compact: solo la miniatura, senza nome (il nome resta per i lettori di schermo)
export function cardBackChoiceButton(onClosed: (() => void) | null, { compact = false }: { compact?: boolean } = {}): HTMLButtonElement {
  const btn = el('button', 'ae-back-choice' + (compact ? ' ae-back-choice--compact' : ''));
  btn.type = 'button';
  const thumb = el('img', 'ae-back-choice-thumb');
  thumb.alt = '';
  const name = el('span', 'ae-back-choice-name');
  const sync = () => {
    const b = currentCardBack();
    thumb.src = b.thumb;
    name.textContent = textOf(I18N_IT.cardBacks, b.id);
    btn.setAttribute('aria-label', I18N_IT.cardBackChosen(textOf(I18N_IT.cardBacks, b.id)));
  };
  btn.append(thumb, name);
  btn.addEventListener('click', () => openCardBackPicker(sync, onClosed));
  sync();
  return btn;
}

// Pulsante con l'anteprima e il nome dello sfondo scelto: apre la scelta con le anteprime (Menu della partita e Opzioni)
// compact: solo l'anteprima, senza nome (il nome resta per i lettori di schermo); choice = quale scelta (sfondo
// dell'app o di Gravehold; stessa anteprima e stessa finestra)
export function backgroundChoiceButton(onClosed: (() => void) | null,
  { compact = false, choice = APP_BG_CHOICE }: { compact?: boolean; choice?: SceltaSfondo } = {}): HTMLButtonElement {
  const btn = el('button', 'ae-bg-choice' + (compact ? ' ae-bg-choice--compact' : '') + choice.className);
  btn.type = 'button';
  const thumb = el('img', 'ae-bg-choice-thumb');
  thumb.alt = '';
  const name = el('span', 'ae-bg-choice-name');
  const sync = () => {
    const b = choice.current();
    thumb.src = b.src;
    name.textContent = choice.name(b.id);
    btn.setAttribute('aria-label', choice.chosen(choice.name(b.id)));
  };
  btn.append(thumb, name);
  btn.addEventListener('click', () => openBackgroundPicker(sync, onClosed, choice));
  sync();
  return btn;
}

// Scelta dello sfondo: le anteprime di tutti gli sfondi una sotto l'altra; un tocco lo applica subito e chiude
export function openBackgroundPicker(onChosen: (() => void) | null, onClosed: (() => void) | null, choice: SceltaSfondo = APP_BG_CHOICE): void {
  let closeModalFn = () => {};
  const close = () => { closeModalFn(); if (onClosed) onClosed(); };
  const dialog = dialogShell(choice.title(), '', close, { displayTitle: false });
  dialog.classList.add('ae-bg-picker');
  const list = el('div', 'ae-bg-grid');
  const chosen = choice.current().id;
  choice.list.forEach(b => {
    const item = el('button', 'ae-bg-item');
    item.type = 'button';
    item.setAttribute('aria-pressed', String(b.id === chosen));
    const img = el('img');
    img.alt = '';
    img.src = b.src;
    item.append(img, el('span', 'ae-bg-item-name', choice.name(b.id)));
    item.addEventListener('click', () => {
      choice.set(b.id);
      close();
      if (onChosen) onChosen();
    });
    list.appendChild(item);
  });
  const footer = el('div', 'ae-modal-footer');
  footer.appendChild(button(I18N_IT.close, 'secondary', close));
  dialog.append(list, footer);
  closeModalFn = openModal(dialog, { onCancel: close, initialFocus: query(list, '[aria-pressed="true"]', HTMLElement) });
}

// Scelta del dorso delle carte: griglia di miniature; un tocco sceglie il dorso, lo applica subito e chiude.
// onClosed: dopo la chiusura, in ogni caso (le Opzioni lo usano per tenere la pagina iniziale coperta)
export function openCardBackPicker(onChosen: (() => void) | null, onClosed: (() => void) | null): void {
  let closeModalFn = () => {};
  const close = () => { closeModalFn(); if (onClosed) onClosed(); };
  const cancel = () => close();
  const dialog = dialogShell(I18N_IT.cardBack, '', cancel, { displayTitle: false });
  dialog.classList.add('ae-back-picker');
  const grid = el('div', 'ae-back-grid');
  const chosen = currentCardBack().id;
  CARD_BACKS.forEach(b => {
    const item = el('button', 'ae-back-item');
    item.type = 'button';
    item.setAttribute('aria-pressed', String(b.id === chosen));
    const img = el('img');
    img.alt = '';
    img.loading = 'lazy';
    img.src = b.thumb;
    item.append(img, el('span', 'ae-back-item-name', textOf(I18N_IT.cardBacks, b.id)));
    item.addEventListener('click', () => {
      setCardBack(b.id);
      close();
      if (onChosen) onChosen();
      // Il carosello si ridisegna anche se non è cambiato niente, così il dorso da pescare prende quello nuovo (firma del
      // carosello azzerata)
      ui.focusSignature = '';
      if (startLayer.hidden) richiediRidisegno();
    });
    grid.appendChild(item);
  });
  const footer = el('div', 'ae-modal-footer');
  footer.appendChild(button(I18N_IT.close, 'secondary', cancel));
  dialog.append(grid, footer);
  closeModalFn = openModal(dialog, { onCancel: cancel, initialFocus: query(grid, '[aria-pressed="true"]', HTMLElement) });
}

// Dorso scelto: salvato nel browser (ui/pagina.ts, impostaDorso), poi l'immagine si scarica subito
export function setCardBack(id: string): void {
  impostaDorso(id);
  loadImage(CARD_BACK);
}

// Codice eseguito all'avvio, nell'ordine di sempre
export function avvio(): void {
  applyBackground();

  APP_BG_CHOICE = {
    className: '', title: () => I18N_IT.background, list: BACKGROUNDS, current: currentBackground, set: setBackground,
    name: id => textOf(I18N_IT.backgrounds, id), chosen: n => I18N_IT.backgroundChosen(n)
  };

  GRAVEHOLD_BG_CHOICE = {
    className: ' ae-bg-choice--gravehold', title: () => I18N_IT.graveholdBg, list: GRAVEHOLD_BGS, current: currentGraveholdBg,
    set: setGraveholdBg, name: id => textOf(I18N_IT.graveholdBgs, id), chosen: n => I18N_IT.graveholdBgChosen(n)
  };
}
