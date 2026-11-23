// ui/schermate/opzioni.ts: Opzioni, La mia collezione, inizio e ripresa della partita, errori della pagina iniziale.
// Provvisorio: inizio e ripresa andranno con il menu.
// Dipende da: stato/ (condivise, stato, partita, salvataggio), dati/ (dati, collezione, rete), ui/testi.ts,
// ui/componenti (componenti, dialoghi, scarti, pesca-undo, menu-laterale), ui/schermate (menu, turno-nemesi, crea-mazzo,
// test). Usato da: menu iniziale, menu laterale, statistiche, avvio, test.

import { G } from '../../stato/condivise.ts';
import { I18N_IT } from '../testi.ts';
import { byId, nemesisBtn, resolveBtn, retryBtn, startError, startErrorText, startLayer, ui } from '../../stato/stato.ts';
import { battleOf } from '../../dati/dati.ts';
import { collectionCatalog, collectionWaveEnabled, isMiniCode, productName, saveCollection, waveOfNemesis } from '../../dati/collezione.ts';
import { newGame, setTurnPairs, turnPairsOn } from '../../stato/partita.ts';
import { el, icon, queryAll } from '../componenti/componenti.ts';
import { button, closeAllModals, dialogShell, openModal, showToast, updateInert } from '../componenti/dialoghi.ts';
import { closeDiscard } from '../componenti/scarti.ts';
import { renderStartChoices, setStartMode, updateHomeCollection, waveLabel } from './menu.js';
import { clearTransition, readSave, restore } from '../../stato/salvataggio.ts';
import { render } from './turno-nemesi.js';
import { showDeckBuild } from './crea-mazzo.ts';
import { slideToGame } from '../componenti/pesca-undo.ts';
import { backgroundChoiceButton, cardBackChoiceButton } from '../componenti/menu-laterale.ts';
import { prefetchDeckImages } from '../../dati/rete.ts';
import { endTest } from './test.ts';
import type { CodiceProdotto, Nemesi } from '../../tipi/dati.ts';
import type { SalvataggioValido } from '../../tipi/salvataggio.ts';

// Il pulsante "La mia collezione" non è nella pagina "Nuova partita" (sta in Opzioni e nel Menu): si toglie anche da
// un index.html vecchio
export function ensureCollectionButton(): void {
  const row = document.getElementById('collection-row');
  if (row) row.remove();
}

export function collectionSummaryText(): string {
  const owned = G.collection;
  if (!owned) throw new TypeError('collezione non ancora letta');
  const waves = new Set([...owned].map(id => id.split('|')[0]));
  return I18N_IT.collectionSummary(waves.size, owned.size);
}

// Opzioni (dal menu iniziale): La mia collezione (con il riepilogo), Dorso delle carte, Sfondo, Carte turno 1/2 e 3/4
export function openOptions(trigger?: HTMLElement | null): void {
  const layer = el('div', 'collection-screen options-screen');
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-label', I18N_IT.options);
  const head = el('div', 'collection-head');
  const close = () => {
    layer.remove();
    startLayer.inert = false;
    updateInert();
    if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
  };
  const x = el('button', 'ae-icon-button');
  x.type = 'button';
  x.setAttribute('aria-label', I18N_IT.close);
  x.appendChild(icon('close'));
  x.addEventListener('click', close);
  head.append(el('h2', 'collection-title', I18N_IT.options), x);
  const body = el('div', 'collection-body');
  const item = el('button', 'options-item');
  item.type = 'button';
  const summary = el('span', 'options-item-note', collectionSummaryText());
  item.append(el('span', 'options-item-label', I18N_IT.myCollection), summary);
  item.addEventListener('click', () => openCollection(item, () => { summary.textContent = collectionSummaryText(); }));
  // Dorso delle carte: miniatura (piccola, a destra della scritta) e nome del dorso scelto; si tocca per la griglia di
  // tutti i dorsi. Chiusa la griglia, la pagina iniziale resta coperta dalle Opzioni
  const backItem = el('div', 'options-item options-item--row');
  backItem.append(el('span', 'options-item-label', I18N_IT.cardBack),
    cardBackChoiceButton(() => { if (layer.isConnected) startLayer.inert = true; }, { compact: true }));
  // Sfondo: anteprima e nome dello sfondo scelto; si tocca per le anteprime di tutti gli sfondi
  const bgItem = el('div', 'options-item options-item--row');
  bgItem.append(el('span', 'options-item-label', I18N_IT.background),
    backgroundChoiceButton(() => { if (layer.isConnected) startLayer.inert = true; }, { compact: true }));
  // Carte turno 1/2 e 3/4 (wave 4): interruttore, attivo di default
  const pairsItem = el('label', 'options-item options-item--row ae-switch-row options-switch');
  const pairsInput = document.createElement('input');
  pairsInput.type = 'checkbox';
  pairsInput.setAttribute('role', 'switch');
  pairsInput.checked = turnPairsOn();
  pairsInput.addEventListener('change', () => setTurnPairs(pairsInput.checked));
  const pairsSw = el('span', 'ae-switch');
  pairsSw.setAttribute('aria-hidden', 'true');
  const pairsText = el('span', 'options-switch-text');
  pairsText.append(el('span', 'options-item-label', I18N_IT.turnPairsOption), el('span', 'options-item-note', I18N_IT.turnPairsHint));
  pairsItem.append(pairsText, pairsInput, pairsSw);
  body.append(item, backItem, bgItem, pairsItem);
  layer.append(head, body);
  layer.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  document.body.appendChild(layer);
  startLayer.inert = true;
  item.focus();
}

// Interruttore di una riga della collezione (ogni riga ne ha uno)
function inputOf(row: HTMLElement): HTMLInputElement {
  const input = row.querySelector('input');
  if (!input) throw new TypeError('riga della collezione senza interruttore');
  return input;
}

// Schermata "La mia collezione": per ogni wave un interruttore (la wave, cioè la sua scatola base) e sotto le sue
// mini espansioni. Togliendo una wave si tolgono anche le sue mini espansioni. Le scelte valgono solo con
// "Salva collezione"; la X torna indietro senza salvare.
export function openCollection(trigger?: HTMLElement | null, onSaved?: () => void): void {
  const draft = new Set<CodiceProdotto>(G.collection);
  const layer = el('div', 'collection-screen');
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-label', I18N_IT.myCollection);
  const head = el('div', 'collection-head');
  const close = () => {
    layer.remove();
    updateInert();
    // Aperta da Opzioni: la pagina iniziale resta coperta dalle Opzioni
    if (document.querySelector('.options-screen')) startLayer.inert = true;
    if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
  };
  const x = el('button', 'ae-icon-button');
  x.type = 'button';
  x.setAttribute('aria-label', I18N_IT.close);
  x.appendChild(icon('close'));
  x.addEventListener('click', close);
  head.append(el('h2', 'collection-title', I18N_IT.myCollection), x);
  const body = el('div', 'collection-body');
  body.appendChild(el('p', 'start-note', I18N_IT.collectionHint));
  // Seleziona tutto / Deseleziona tutto: spuntano o tolgono tutte le wave (solo quelle che si possono scegliere) e le
  // mini espansioni (valgono con "Salva")
  const bulk = el('div', 'collection-bulk');
  const setAll = (on: boolean) => {
    collectionCatalog().filter(({ wave }) => collectionWaveEnabled(wave))
      .forEach(({ products }) => products.forEach(p => { if (on) draft.add(p.id); else draft.delete(p.id); }));
    queryAll(body, '.collection-wave:not(.is-locked) .collection-item input', HTMLInputElement).forEach(input => {
      input.checked = on;
      if (input.closest('.is-mini')) input.disabled = !on;
    });
    body.querySelectorAll('.collection-wave:not(.is-locked) .collection-item.is-mini').forEach(r => r.classList.toggle('is-disabled', !on));
  };
  bulk.append(button(I18N_IT.selectAll, 'secondary', () => setAll(true)), button(I18N_IT.deselectAll, 'secondary', () => setAll(false)));
  body.appendChild(bulk);

  const toggle = (label: string, id: CodiceProdotto, extraClass: string) => {
    const row = el('label', 'ae-switch-row collection-item' + (extraClass ? ' ' + extraClass : ''));
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('role', 'switch');
    input.checked = draft.has(id);
    input.dataset.id = id;
    const sw = el('span', 'ae-switch');
    sw.setAttribute('aria-hidden', 'true');
    row.append(el('span', '', label), input, sw);
    return row;
  };
  collectionCatalog().forEach(({ wave, products }) => {
    const block = el('section', 'collection-wave');
    const base = products[0];
    const waveRow = toggle(waveLabel(wave), base.id, 'is-wave');
    const minis = products.slice(1).map(m => toggle(m.name, m.id, 'is-mini'));
    const sync = () => {
      const on = draft.has(base.id);
      minis.forEach(r => {
        const input = inputOf(r);
        input.disabled = !on;
        r.classList.toggle('is-disabled', !on);
      });
    };
    const waveInput = inputOf(waveRow);
    waveInput.addEventListener('change', () => {
      if (waveInput.checked) draft.add(base.id);
      else { draft.delete(base.id); products.slice(1).forEach(m => draft.delete(m.id)); minis.forEach(r => { inputOf(r).checked = false; }); }
      sync();
    });
    minis.forEach(r => {
      const input = inputOf(r);
      input.addEventListener('change', () => {
        const id = String(input.dataset.id);
        if (input.checked) draft.add(id); else draft.delete(id);
      });
    });
    block.append(waveRow, ...minis);
    sync();
    // Wave non ancora disponibili: visibili ma spente e non si toccano
    if (!collectionWaveEnabled(wave)) {
      block.classList.add('is-locked');
      [waveRow, ...minis].forEach(r => {
        const input = inputOf(r);
        input.checked = false;
        input.disabled = true;
        r.classList.add('is-disabled');
      });
      const label = waveRow.querySelector('span');
      if (label) label.append(el('span', 'collection-locked-note', I18N_IT.collectionLocked));
    }
    body.appendChild(block);
  });
  const footer = el('div', 'collection-footer');
  const saveBtn = button(I18N_IT.collectionSave, 'primary', () => {
    G.collection = draft;
    saveCollection();
    close();
    renderStartChoices();
    updateHomeCollection();
    if (onSaved) onSaved();
    showToast(I18N_IT.collectionSaved);
  });
  saveBtn.classList.add('ae-button--full');
  footer.appendChild(saveBtn);
  layer.append(head, body, footer);
  layer.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  document.body.appendChild(layer);
  startLayer.inert = true;
  x.focus();
}

export function showStartSkeleton(): void {
  byId('nemesis-list', HTMLDivElement).replaceChildren(...[0, 1, 2, 3].map(() => el('div', 'nemesis-skeleton')));
}

export function openStart(): void {
  // Uscendo da un test (Esci dal test o Menu iniziale della Vittoria) tornano le scelte di prima
  endTest();
  closeAllModals();
  closeDiscard();
  renderStartChoices();
  startLayer.hidden = false;
  updateInert();
  setStartMode('home', true);
}

export function closeStart(): void {
  startLayer.hidden = true;
  updateInert();
}

// Inizia partita: la scelta "Nuova partita" nella finestra sotto il titolo vale già come conferma di sostituire
// la partita salvata, quindi qui non si chiede altro
export function onStartClick(): void {
  startGame();
}

// Inizia: nuova partita con le scelte fatte (la partita salvata viene sostituita)
export function startGame(): void {
  if (!battleOf(G.settings.nemesis)) return;
  clearTransition();
  closeAllModals();
  G.queue = [];
  G.resolving = false;
  G.currentIndex = 0;
  G.newIndex = -1;
  ui.viewedUid = null;
  ui.reveal = null;
  ui.lastDrawnUid = null;
  ui.drafts.clear();
  ui.flyingDiscards = 0;
  G.undoStack = [];
  ui.gameSaved = false;
  newGame();
  // Prima del turno giocatori: i 9 mazzi da cui nasce il mazzo nemesi e il pulsante "Crea mazzo"
  ui.deckBuilding = true;
  ui.deckShown = 0;
  ui.deckDark = true;
  showDeckBuild();
  render();
  slideToGame(() => nemesisBtn.focus());
  prefetchDeckImages();
}

// Riprendi partita: si ricarica lo stato salvato nel browser, compreso l'undo. Se la nemesi della partita non è più
// nella collezione, una finestra lo dice; "Continua" rimette nella collezione il suo prodotto (e la scatola base della
// sua wave) e riprende la partita. Nemesi di una wave non ancora disponibile nella collezione: si riprende e basta
export function resumeGame(): void {
  const saved = readSave();
  if (!saved) return;
  const info = G.nemeses.find(n => n.name === saved.settings.nemesis);
  const owned = G.collection;
  const product = info ? info.boxCode : null;
  const wave = info ? waveOfNemesis(info) : null;
  if (info && product && wave && owned && collectionWaveEnabled(wave) && !owned.has(product)) {
    openMissingNemesis(info, () => {
      owned.add(wave);
      owned.add(product);
      saveCollection();
      renderStartChoices();
      updateHomeCollection();
      resumeSavedGame(saved);
    });
    return;
  }
  resumeSavedGame(saved);
}

export function openMissingNemesis(info: Nemesi, onContinue: () => void): void {
  let close = () => {};
  const cancel = () => close();
  const dialog = dialogShell(I18N_IT.nemesisMissingTitle, '', cancel, { displayTitle: false });
  dialog.classList.add('ae-exit-confirm');
  const product = String(info.boxCode);
  dialog.appendChild(el('p', 'ae-modal-text', I18N_IT.nemesisMissingText(info.name,
    isMiniCode(info.boxCode) ? productName(product) : waveLabel(waveOfNemesis(info)))));
  const footer = el('div', 'ae-modal-footer');
  const go = button(I18N_IT.continueLabel, 'primary', () => { close(); onContinue(); });
  footer.append(button(I18N_IT.cancel, 'secondary', cancel), go);
  dialog.appendChild(footer);
  close = openModal(dialog, { onCancel: cancel, initialFocus: go });
}

export function resumeSavedGame(saved: SalvataggioValido): void {
  try {
    const previousSettings = G.settings;
    G.settings = saved.settings;
    try {
      restore(saved.state);
    } catch (err) {
      G.settings = previousSettings;
      throw err;
    }
    G.undoStack = Array.isArray(saved.undo) ? saved.undo : [];
    ui.gameSaved = true;
    ui.deckDark = false;
    startError.hidden = true;
    closeStart();
    render();
    prefetchDeckImages();
    (G.resolving ? resolveBtn : nemesisBtn).focus();
  } catch (err) {
    console.error(err);
    showStartError(I18N_IT.resumeError, false);
  }
}

export function showStartError(text: string, withRetry: boolean): void {
  startError.hidden = false;
  startErrorText.textContent = text;
  retryBtn.hidden = !withRetry;
}

// Al caricamento non c'è niente da fare (main.ts chiama avvio() di ogni modulo)
export function avvio(): void {
}
